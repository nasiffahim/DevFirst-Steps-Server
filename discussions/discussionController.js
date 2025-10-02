import { ObjectId } from "mongodb";


// create post
export const createPost= async(req,res,discussion)=>{
 try {
    const {
      title,
      preview,
      category,
      content,
      status,
      tags,
      author,
     email
    } = req.body;

    const newPost = {
      title,
      preview,
      category,
      content,
      status: status || "active",
      tags,
      author,
      email,          // store the URL directly
      votes: { up: 0, down: 0 },
      replies: 0,
      timestamp: new Date(),
    };

    const result = await discussion.insertOne(newPost);
    res.status(201).json({ message: "Post created", postId: result.insertedId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create post" });
  }

}

// Get all discussions
export const getDiscussions = async (req, res, discussion) => {
  
  const discussions = await discussion.find({}).toArray();
  res.json(discussions);
};


// Vote a discussion
export const voteDiscussion = async (req, res, discussion) => {
  try {
    const { id } = req.params;
    const { type, userEmail } = req.body;

    if (!id || !type || !userEmail) {
      return res.status(400).json({ error: "Missing discussion ID, vote type, or user" });
    }

    if (!["up", "down"].includes(type)) {
      return res.status(400).json({ error: "Invalid vote type. Use 'up' or 'down'" });
    }

    const discussionDoc = await discussion.findOne({ _id: new ObjectId(id) });
    if (!discussionDoc) {
      return res.status(404).json({ error: "Discussion not found" });
    }

    const currentVotes = discussionDoc.votes || { up: 0, down: 0 };
    const voters = discussionDoc.voters || {}; // { userEmail: "up" }

    const previousVote = voters[userEmail];

    if (previousVote === type) {
      // Same vote again → remove it
      currentVotes[type] = Math.max(0, currentVotes[type] - 1);
      delete voters[userEmail];
    } else {
      // Switching or new vote
      if (previousVote) {
        currentVotes[previousVote] = Math.max(0, currentVotes[previousVote] - 1);
      }
      currentVotes[type] = (currentVotes[type] || 0) + 1;
      voters[userEmail] = type;
    }

    await discussion.updateOne(
      { _id: new ObjectId(id) },
      { $set: { votes: currentVotes, voters } }
    );

    res.json({
      message: "Vote updated successfully",
      votes: currentVotes,
      userVote: voters[userEmail] || null,
    });

  } catch (error) {
    console.error("Error updating vote:", error);
    res.status(500).json({ error: "Failed to update vote" });
  }
};


// Get vote status for a user
export const getVoteStatus = async (req, res, discussion) => {
  try {
    const { id } = req.params;
    const { userEmail } = req.query;

    if (!id || !userEmail) {
      return res.status(400).json({ error: "Missing discussion ID or userEmail" });
    }

    const discussionDoc = await discussion.findOne({ _id: new ObjectId(id) });
    if (!discussionDoc) {
      return res.status(404).json({ error: "Discussion not found" });
    }

    const votes = discussionDoc.votes || { up: 0, down: 0 };
    const userVote = discussionDoc.voters?.[userEmail] || null;

    res.json({ userVote, votes });

  } catch (error) {
    console.error("Error fetching vote status:", error);
    res.status(500).json({ error: "Failed to fetch vote status" });
  }
}; 
// Vote on discussion - MongoDB Native Version

//  4 card status
export const getStats = async (req, res, discussion, comment, user) => {
  try {
    // Fetch data concurrently using Promise.all for better performance
    const [totalDiscussions, totalUsers, solvedDiscussions, totalRepliesAgg] = await Promise.all([
      discussion.countDocuments(),
      user.countDocuments(),
      discussion.countDocuments({ status: "solved" }),
      comment.aggregate([{ $group: { _id: null, totalReplies: { $sum: 1 } } }]).toArray()
    ]);

    const totalReplies = totalRepliesAgg[0]?.totalReplies || 0;

    // Build stats data
    const statsData = [
      { icon: "MessageSquare", label: "Discussions", value: totalDiscussions, color:"#d1d5db"},
      { icon: "Users", label: "Members", value: totalUsers, color:"#fde68a"}, // dynamic value now
      { icon: "TrendingUp", label: "Total Replies", value: totalReplies, color:"#28a355ff"},
      { icon: "CheckCircle", label: "Solved Discussions", value: solvedDiscussions, color:"#7c3aed" },
    ];

    res.json({ stats: statsData, timestamp: new Date().toISOString() }); // Added timestamp for context
   
  } catch (error) {
    // Handle specific errors if needed
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
};


// Get a single discussion by ID
export const getDiscussionById = async (req, res, discussion) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid discussion ID" });
    }

    const discussionDoc = await discussion.findOne({ _id: new ObjectId(id) });

    if (!discussionDoc) {
      return res.status(404).json({ error: "Discussion not found" });
    }

    res.json(discussionDoc);
  } catch (error) {
    console.error("Error fetching discussion:", error);
    res.status(500).json({ error: "Failed to fetch discussion" });
  }
};


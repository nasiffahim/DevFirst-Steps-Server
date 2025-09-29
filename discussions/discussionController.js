
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
      views: 0,
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

// Vote on discussion


// Vote on discussion - MongoDB Native Version

 import { ObjectId } from "mongodb";

export const voteDiscussion = async (req, res, discussion) => {
  try {
    const { id } = req.params;
    const { type, userEmail } = req.body; // pass userEmail from frontend

    if (!id || !type || !userEmail) {
      return res.status(400).json({ error: "Missing discussion ID, vote type, or user" });
    }

    if (!["up", "down"].includes(type)) {
      return res.status(400).json({ error: "Invalid vote type. Use 'up' or 'down'" });
    }

    // Find discussion
    const discussions = await discussion.findOne({ _id: new ObjectId(id) });
    if (!discussions) {
      return res.status(404).json({ error: "Discussion not found" });
    }

    // Ensure votes field exists
    const currentVotes = discussions.votes || { up: 0, down: 0 };
    const voters = discussions.voters || {}; // store users like { userEmail: "up" }

    const existingVote = voters[userEmail];

    // Toggle logic
    if (existingVote === type) {
      // User clicked same vote again → remove their vote
      currentVotes[type] = Math.max(0, currentVotes[type] - 1);
      delete voters[userEmail];
    } else {
      // If switching vote
      if (existingVote) {
        currentVotes[existingVote] = Math.max(0, currentVotes[existingVote] - 1);
      }
      // Apply new vote
      currentVotes[type] = (currentVotes[type] || 0) + 1;
      voters[userEmail] = type;
    }

    // Update DB
    const result = await discussion.updateOne(
      { _id: new ObjectId(id) },
      { $set: { votes: currentVotes, voters } }
    );

    res.json({
      message: "Vote updated successfully",
      votes: currentVotes,
      userVote: voters[userEmail] || null, // return user’s current vote
    });

  } catch (error) {
    console.error("Error updating vote:", error);
    res.status(500).json({ error: "Failed to update vote" });
  }
};



//   user like check
export const getVoteStatus = async (req, res, discussion) => {
  try {
    const { id } = req.params;
    const { userEmail } = req.query;

    if (!id || !userEmail) {
      return res.status(400).json({ error: "Missing discussion ID or userEmail" });
    }

    const discussions = await discussion.findOne({ _id: new ObjectId(id) });
    if (!discussions) {
      return res.status(404).json({ error: "Discussion not found" });
    }

    const voters = discussions.voters || {};
    const votes = discussions.votes || { up: 0, down: 0 };

    res.json({
      userVote: voters[userEmail] || null,
      votes,
    });

  } catch (error) {
    console.error("Error fetching vote status:", error);
    res.status(500).json({ error: "Failed to fetch vote status" });
  }
};

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
      { icon: "MessageSquare", label: "Discussions", value: totalDiscussions,color:"bg-gray-600"},
      { icon: "Users", label: "Members", value: totalUsers,color:"bg-amber-200"}, // dynamic value now
      { icon: "TrendingUp", label: "Total Replies", value: totalReplies, color:"bg-green-400"},
      { icon: "CheckCircle", label: "Solved Discussions", value: solvedDiscussions,color:"bg-violet-400" },
    ];

    res.json({ stats: statsData, timestamp: new Date().toISOString() }); // Added timestamp for context
  } catch (error) {
    // Handle specific errors if needed
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
};

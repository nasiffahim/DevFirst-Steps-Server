 import { ObjectId } from "mongodb";
// Get comments for a discussion (with replies)
export const getComments = async (req, res, comment) => {
  try {
    const comments = await comment
      .find({ discussionId: req.params.discussionId })
      .toArray();

    // Nested replies
    const commentMap = {};
    comments.forEach((c) => (commentMap[c._id] = { ...c, replies: [] }));

    const rootComments = [];
    comments.forEach((c) => {
      if (c.parentId) {
        commentMap[c.parentId]?.replies.push(commentMap[c._id]);
      } else {
        rootComments.push(commentMap[c._id]);
      }
    });

    res.json(rootComments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
};

// Add a comment
export const addComment = async (req, res, comment) => {
  try {
    const { discussionId } = req.params;
    console.log(req.body);
    
    const { text, userEmail, parentId, username } = req.body;

    if (!text || !userEmail |username) {
      return res.status(400).json({ error: "Missing fields" });
    }


    const newComment = {
      discussionId,
      text,
      userEmail,
       username,
      parentId: parentId || null,
      timestamp: new Date(),
    };

    await comment.insertOne(newComment);
    res.json({ message: "Comment added", comment: newComment });
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ error: "Failed to add comment" });
  }
};

// Delete a comment
export const deleteComment = async (req, res, comment) => {
  try {
    const { commentId } = req.params;

    const result = await comment.deleteOne({ _id: new ObjectId(commentId) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Comment not found" });
    }

    res.json({ message: "Comment deleted" });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ error: "Failed to delete comment" });
  }
};

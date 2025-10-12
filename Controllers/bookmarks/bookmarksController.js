// controllers/bookmarkController.js
const { ObjectId } = require("mongodb");

module.exports = (bookmarks) => {
  // Check if bookmarked
  const checkBookmark = async (req, res) => {
    try {
      const { projectId } = req.params;
      const { email } = req.query;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const numericProjectId = Number(projectId);

      if (isNaN(numericProjectId)) {
        return res.status(400).json({ message: "Invalid projectId" });
      }

      const existing = await bookmarks.findOne({ email, projectId: numericProjectId });
      res.json({ isBookmarked: !!existing });
    } catch (error) {
      res.status(500).json({ message: "Error checking bookmark", error: error.message });
    }
  };

  // Get all bookmarks by email
  const getBookmarks = async (req, res) => {
    try {
      const { email } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 12;

      const total = await bookmarks.countDocuments({ email });
      const pages = Math.ceil(total / limit);

      const result = await bookmarks
        .find({ email })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();

      res.json({
        data: result,
        pagination: {
          total,
          pages,
          current: page,
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Error fetching bookmarks", error: error.message });
    }
  };

  // Add a bookmark
  const addBookmark = async (req, res) => {
    try {
      const { email, projectId, ...rest } = req.body;

      if (!email || !projectId) {
        return res.status(400).json({ message: "Email and projectId are required" });
      }

      const numericId = Number(projectId);

      // Prevent duplicates
      const existing = await bookmarks.findOne({ email, projectId: numericId });
      if (existing) {
        return res.status(200).json({ message: "Already bookmarked" });
      }

      const newBookmark = {
        email,
        projectId: numericId,
        ...rest,
        createdAt: new Date(),
      };

      const result = await bookmarks.insertOne(newBookmark);
      res.status(201).json({ message: "Bookmark added successfully!", result });
    } catch (error) {
      res.status(500).json({ message: "Error adding bookmark", error: error.message });
    }
  };

  // Delete bookmark
  const deleteBookmark = async (req, res) => {
    try {
      const { projectId } = req.params;
      const { email } = req.query;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const numericId = Number(projectId);

      const result = await bookmarks.deleteOne({
        email,
        projectId: numericId,
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({ message: "Bookmark not found" });
      }

      res.json({ message: "Bookmark removed successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error removing bookmark", error: error.message });
    }
  };

  return {
    checkBookmark,
    getBookmarks,
    addBookmark,
    deleteBookmark,
  };
};

const { ObjectId } = require("mongodb");

// Controller functions for user blogs
const UserBlogController = (blogs) => {
  // Add new blog
  const addBlog = async (req, res) => {
    try {
      const blog = req.body;
      blog.createdAt = new Date();
      const result = await blogs.insertOne(blog);
      res.status(201).json({ message: "blog added successfully!", result });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error adding blog", error: error.message });
    }
  };

  // Get blog by ID
  const getBlogById = async (req, res) => {
    try {
      const { id } = req.params;
      const blog = await blogs.findOne({ _id: new ObjectId(id) });

      if (!blog) {
        return res.status(404).json({ message: "Blog not found" });
      }

      res.json(blog);
    } catch (error) {
      res.status(500).json({
        message: "Error fetching blog",
        error: error.message,
      });
    }
  };

  // Update blog by ID
  const updateBlog = async (req, res) => {
    const { id } = req.params;
    const updatedBlog = req.body;

    try {
      // Prevent _id overwrite
      delete updatedBlog._id;

      const result = await blogs.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedBlog }
      );

      if (result.modifiedCount === 0) {
        return res
          .status(404)
          .json({ message: "Blog not found or no changes made" });
      }

      res.status(200).json({ message: "Blog updated successfully" });
    } catch (error) {
      console.error("Error updating blog:", error);
      res.status(500).json({ message: "Error updating blog", error: error.message });
    }
  };

  // Delete blog by ID
  const deleteBlog = async (req, res) => {
    const { id } = req.params;

    try {
      const result = await blogs.deleteOne({ _id: new ObjectId(id) });

      if (result.deletedCount === 0) {
        return res.status(404).json({ message: "Blog not found" });
      }

      res.status(200).json({ message: "Blog deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting blog", error: error.message });
    }
  };

  // Get all blogs
  const getAllBlogs = async (req, res) => {
    try {
      const result = await blogs.find().toArray();
      res.json(result);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error fetching blogs", error: error.message });
    }
  };

  return {
    addBlog,
    getBlogById,
    updateBlog,
    deleteBlog,
    getAllBlogs,
  };
};

module.exports = UserBlogController;
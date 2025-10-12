const { ObjectId } = require("mongodb");

// Controller functions for user projects
const UserProjectController = (projects) => {
  // Add new project
  const addProject = async (req, res) => {
    try {
      const project = req.body;
      project.createdAt = new Date();
      const result = await projects.insertOne(project);
      res
        .status(201)
        .json({ message: "Project added successfully!", result });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error adding project", error: error.message });
    }
  };

  // Get all projects
  const getAllUserProjects = async (req, res) => {
    try {
      const result = await projects.find().toArray();
      res.json(result);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error fetching projects", error: error.message });
    }
  };

  // Get projects by user email
  const getProjectsByEmail = async (req, res) => {
    try {
      const email = req.params.email;
      const result = await projects.find({ createdBy: email }).toArray();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        message: "Error fetching user projects",
        error: error.message,
      });
    }
  };

  // Get project details by ID
  const getUserProjectById = async (req, res) => {
    try {
      const { id } = req.params;
      const project = await projects.findOne({ _id: new ObjectId(id) });

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.json(project);
    } catch (error) {
      console.error("Error fetching user project:", error);
      res
        .status(500)
        .json({ message: "Error fetching project", error: error.message });
    }
  };

  // Get single project by ID for update
  const getProjectForUpdate = async (req, res) => {
    try {
      const { id } = req.params;
      const project = await projects.findOne({ _id: new ObjectId(id) });
      if (!project)
        return res.status(404).json({ message: "Project not found" });
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  };

  // Update project by ID
  const updateProject = async (req, res) => {
    try {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: false };
      const updatedProject = req.body;
      const updatedDoc = { $set: updatedProject };
      const result = await projects.updateOne(filter, updatedDoc, options);
      res.send(result);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error updating project", error: error.message });
    }
  };

  // Delete project by ID
  const deleteProject = async (req, res) => {
    try {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await projects.deleteOne(query);
      res.send(result);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error deleting project", error: error.message });
    }
  };

  return {
    addProject,
    getAllUserProjects,
    getProjectsByEmail,
    getUserProjectById,
    getProjectForUpdate,
    updateProject,
    deleteProject,
  };
};

module.exports = UserProjectController;
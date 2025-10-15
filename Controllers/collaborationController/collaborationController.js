const { ObjectId } = require("mongodb");

// collaborationController.js
module.exports = (collaborations, joinRequests, users) => {
  // 1️⃣ Create a new collaboration post
  const createCollaboration = async (req, res) => {
    try {
      const { title,ownerName, description, githubRepo, skills, projectType, teamSize, collaborationType, contactPreference, ownerEmail,ownerPhoto } = req.body;

      if (!title || !description || !ownerEmail) {
        return res.status(400).json({ message: "Title, description, and ownerEmail are required." });
      }

      const newCollab = {
        title,
        description,
        githubRepo,
        skills,
        projectType,
        teamSize,
        collaborationType,
        contactPreference,
        ownerEmail,
        members: [{ name: ownerName, email: ownerEmail, avatar: ownerPhoto, role: "Owner" }],
        createdAt: new Date(),
      };

      const result = await collaborations.insertOne(newCollab);
      res.status(201).json({ message: "Collaboration created successfully!", id: result.insertedId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error while creating collaboration." });
    }
  };

  // 2️⃣ Get all collaborations
  const getAllCollaborations = async (req, res) => {
    try {
      const result = await collaborations.find({}).sort({ createdAt: -1 }).toArray();
      res.send(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch collaborations." });
    }
  };

  // 3️⃣ ✅ Get single collaboration by ID
  const getSingleCollaboration = async (req, res) => {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid collaboration ID." });
      }

      const project = await collaborations.findOne({ _id: new ObjectId(id) });

      if (!project) {
        return res.status(404).json({ message: "Collaboration not found." });
      }

      res.status(200).json(project);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error fetching collaboration details." });
    }
  };

 // 4️⃣ Send join request
const sendJoinRequest = async (req, res) => {
  try {
    const { projectId, userEmail, name, role, message, photoURL } = req.body;

    if (!projectId || !userEmail || !name || !role) {
      return res
        .status(400)
        .json({ message: "Project ID, user email, name, and role are required." });
    }

    // Check if the user already has a pending or accepted request for this project
    const existing = await joinRequests.findOne({
      projectId: new ObjectId(projectId),
      userEmail,
      status: { $in: ["pending", "accepted"] }, // include accepted to avoid duplicates
    });

    if (existing)
      return res
        .status(400)
        .json({ message: "You have already sent a join request for this project." });

    const request = {
      projectId: new ObjectId(projectId),
      userEmail,
      name,
      role,
      message: message || "",
      photoURL: photoURL || "",
      status: "pending",
      reason: "",
      createdAt: new Date(),
    };

    await joinRequests.insertOne(request);
    res.status(201).json({ message: "Join request sent successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error sending join request." });
  }
};


  // 5️⃣ Get join requests for project owner
  const getJoinRequestsForOwner = async (req, res) => {
    try {
      const { ownerEmail } = req.query;

      const ownedProjects = await collaborations.find({ ownerEmail }).project({ _id: 1 }).toArray();
      const projectIds = ownedProjects.map((p) => p._id);

      const requests = await joinRequests.find({ projectId: { $in: projectIds } }).sort({ createdAt: -1 }).toArray();

      res.send(requests);
    } catch (err) {
      res.status(500).json({ message: "Error fetching join requests." });
    }
  };

  // 6️⃣ Accept request
  const acceptJoinRequest = async (req, res) => {
    try {
      const { requestId } = req.params;

      const request = await joinRequests.findOne({ _id: new ObjectId(requestId) });
      if (!request) return res.status(404).json({ message: "Request not found." });

      await collaborations.updateOne(
        { _id: request.projectId },
        { $addToSet: { members: request.userEmail } }
      );

      await joinRequests.updateOne(
        { _id: new ObjectId(requestId) },
        { $set: { status: "accepted" } }
      );

      res.json({ message: "Request accepted successfully!" });
    } catch (err) {
      res.status(500).json({ message: "Error accepting request." });
    }
  };

  // 7️⃣ Reject request with reason
  const rejectJoinRequest = async (req, res) => {
    try {
      const { requestId } = req.params;
      const { reason } = req.body;

      if (!reason) return res.status(400).json({ message: "Rejection reason is required." });

      await joinRequests.updateOne(
        { _id: new ObjectId(requestId) },
        { $set: { status: "rejected", reason } }
      );

      res.json({ message: "Request rejected successfully!" });
    } catch (err) {
      res.status(500).json({ message: "Error rejecting request." });
    }
  };

  // 8️⃣ Get my requests (as user)
  const getUserJoinRequests = async (req, res) => {
    try {
      const { userEmail } = req.query;
      const result = await joinRequests.find({ userEmail }).sort({ createdAt: -1 }).toArray();
      res.send(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch your requests." });
    }
  };

  // Export all controllers
  return {
    createCollaboration,
    getAllCollaborations,
    getSingleCollaboration, 
    sendJoinRequest,
    getJoinRequestsForOwner,
    acceptJoinRequest,
    rejectJoinRequest,
    getUserJoinRequests,
  };
};

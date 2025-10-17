const { ObjectId } = require("mongodb");

// collaborationController.js
module.exports = (collaborations, joinRequests, users) => {
  // 1️⃣ Create a new collaboration post
  const createCollaboration = async (req, res) => {
    try {
      const {
        title,
        ownerName,
        description,
        githubRepo,
        skills,
        projectType,
        teamSize,
        collaborationType,
        contactPreference,
        ownerEmail,
        ownerPhoto,
      } = req.body;

      if (!title || !description || !ownerEmail) {
        return res
          .status(400)
          .json({
            message: "Title, description, and ownerEmail are required.",
          });
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
        members: [
          {
            name: ownerName,
            email: ownerEmail,
            avatar: ownerPhoto,
            role: "Owner",
          },
        ],
        createdAt: new Date(),
      };

      const result = await collaborations.insertOne(newCollab);
      res
        .status(201)
        .json({
          message: "Collaboration created successfully!",
          id: result.insertedId,
        });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ message: "Server error while creating collaboration." });
    }
  };

  // 2️⃣ Get all collaborations
  const getAllCollaborations = async (req, res) => {
    try {
      const result = await collaborations
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
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
      res
        .status(500)
        .json({ message: "Error fetching collaboration details." });
    }
  };
  // Check if a user owns any project
  const checkUserOwnsProject = async (req, res) => {
    try {
      const { userEmail } = req.query;
      if (!userEmail) {
        return res.status(400).json({ message: "User email is required." });
      }

      // Find if user owns at least one project
      const ownedProject = await collaborations.findOne({
        ownerEmail: userEmail,
      });

      const isOwner = !!ownedProject; // true if a project exists, false otherwise

      res.status(200).json({ isOwner });
    } catch (err) {
      console.error("❌ Error checking ownership:", err);
      res.status(500).json({ message: "Internal server error." });
    }
  };
  // 4️⃣ Send join request
  const sendJoinRequest = async (req, res) => {
    try {
      const { projectId, userEmail, name, role, message, photoURL } = req.body;

      if (!projectId || !userEmail || !name || !role) {
        return res
          .status(400)
          .json({
            message: "Project ID, user email, name, and role are required.",
          });
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
          .json({
            message: "You have already sent a join request for this project.",
          });

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

      const ownedProjects = await collaborations
        .find({ ownerEmail })
        .project({ _id: 1 })
        .toArray();
      const projectIds = ownedProjects.map((p) => p._id);

      const requests = await joinRequests
        .find({ projectId: { $in: projectIds } })
        .sort({ createdAt: -1 })
        .toArray();

      res.send(requests);
    } catch (err) {
      res.status(500).json({ message: "Error fetching join requests." });
    }
  };

  const getOwnedProjectsWithRequests = async (req, res) => {
    try {
      const { ownerEmail } = req.query;
      if (!ownerEmail)
        return res.status(400).json({ message: "Owner email is required." });

      // Find all projects owned by this user
      const ownedProjects = await collaborations
        .find({ ownerEmail })
        .sort({ createdAt: -1 })
        .toArray();

      // For each project, get join requests
      const projectsWithRequests = await Promise.all(
        ownedProjects.map(async (project) => {
          const requests = await joinRequests
            .find({ projectId: project._id })
            .sort({ createdAt: -1 })
            .toArray();

          return {
            ...project,
            joinRequests: requests,
          };
        })
      );

      res.status(200).json(projectsWithRequests);
    } catch (err) {
      console.error("Error fetching owned projects:", err);
      res.status(500).json({ message: "Error fetching owned projects." });
    }
  };

  // 6️⃣ Accept request
  const acceptJoinRequest = async (req, res) => {
    try {
      const { requestId } = req.params;

      // Find the join request
      const request = await joinRequests.findOne({
        _id: new ObjectId(requestId),
      });
      if (!request)
        return res.status(404).json({ message: "Request not found." });

      // Build the member object from the request
      const newMember = {
        name: request.name,
        email: request.userEmail,
        avatar: request.photoURL || "",
        role: request.role,
        joinedAt: new Date(),
      };

      // Add the member to the project's members array
      await collaborations.updateOne(
        { _id: request.projectId },
        { $addToSet: { members: newMember } }
      );

      // Update request status
      await joinRequests.updateOne(
        { _id: new ObjectId(requestId) },
        { $set: { status: "accepted" } }
      );

      res.json({ message: "Request accepted successfully!" });
    } catch (err) {
      console.error("Error accepting join request:", err);
      res.status(500).json({ message: "Error accepting request." });
    }
  };

  // 7️⃣ Reject request with reason
  const rejectJoinRequest = async (req, res) => {
    try {
      const { requestId } = req.params;
      const { reason } = req.body;

      if (!reason)
        return res
          .status(400)
          .json({ message: "Rejection reason is required." });

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
      const result = await joinRequests
        .find({ userEmail })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch your requests." });
    }
  };

  // 9️⃣ Get all collaborations related to the user (My Teams)
  const getMyTeams = async (req, res) => {
    try {
      const { userEmail } = req.query;
      if (!userEmail) {
        return res.status(400).json({ message: "User email is required." });
      }

      // --- Fetch user info ---
      const user = await users.findOne({ email: userEmail });
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      // --- 1️⃣ Projects user owns or is member of ---
      const ownedOrMemberProjects = await collaborations
        .find({
          $or: [{ "owner.email": userEmail }, { "members.email": userEmail }],
        })
        .toArray();

      // --- 2️⃣ Join requests by this user ---
      const userJoinRequests = await joinRequests.find({ userEmail }).toArray();

      // --- Separate into pending & rejected ---
      const pendingRequests = [];
      const rejectedRequests = [];

      for (const reqItem of userJoinRequests) {
        const project = await collaborations.findOne({
          _id: new ObjectId(reqItem.projectId),
        });
        if (!project) continue;

        const projectData = {
          _id: project._id,
          title: project.title,
          description: project.description,
          owner: project.owner,
          skills: project.skills,
          members: project.members || [],
          status: reqItem.status, // 'pending' | 'rejected' | 'approved'
          reason: reqItem.reason || null,
        };

        if (reqItem.status === "pending") {
          pendingRequests.push(projectData);
        } else if (reqItem.status === "rejected") {
          rejectedRequests.push(projectData);
        }
      }

      // --- Format joined/owned section ---
      const joinedProjects = ownedOrMemberProjects.map((proj) => ({
        _id: proj._id,
        title: proj.title,
        description: proj.description,
        skills: proj.skills,
        members: proj.members || [],
        owner: proj.owner || { name: "", email: proj.ownerEmail },
        status: proj.owner?.email === userEmail ? "owner" : "member",
      }));

      // --- Return structured data ---
      res.json({
        joined: joinedProjects,
        pending: pendingRequests,
        rejected: rejectedRequests,
      });
    } catch (err) {
      console.error("❌ Error in getMyTeams:", err);
      res.status(500).json({ message: "Internal server error." });
    }
  };

  const getJoinRequestDetail = async (req, res) => {
    try {
      const { requestId } = req.params;
      console.log(requestId);
      if (!ObjectId.isValid(requestId)) {
        return res.status(400).json({ message: "Invalid request ID" });
      }

      const joinReq = await joinRequests.findOne({
        _id: new ObjectId(requestId),
      });
      if (!joinReq)
        return res.status(404).json({ message: "Join request not found" });

      const project = await collaborations.findOne({ _id: joinReq.projectId });
      if (!project)
        return res.status(404).json({ message: "Project not found from" });

      res.json({
        request: joinReq,
        project: {
          _id: project._id,
          title: project.title,
          description: project.description,
          skills: project.skills,
          members: project.members || [],
          owner: project.owner,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error fetching request detail" });
    }
  };
  const getJoinRequestsByProject = async (req, res) => {
    try {
      const { projectId } = req.params;

      if (!ObjectId.isValid(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      // find all join requests related to this project
      const requests = await joinRequests
        .find({ projectId: new ObjectId(projectId) })
        .toArray();

      if (!requests.length) {
        return res
          .status(404)
          .json({ message: "No join requests found for this project" });
      }

      res.status(200).json({ count: requests.length, requests });
    } catch (err) {
      console.error("Error fetching join requests:", err);
      res.status(500).json({ message: "Server error fetching join requests" });
    }
  };
  const deleteProject = async (req, res) => {
    try {
      const { projectId } = req.params;

      if (!ObjectId.isValid(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      // Use the injected 'collaborations' collection
      const project = await collaborations.findOne({
        _id: new ObjectId(projectId),
      });
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      await collaborations.deleteOne({ _id: new ObjectId(projectId) });

      res.status(200).json({ message: "Project deleted successfully" });
    } catch (err) {
      console.error("Error deleting project:", err);
      res.status(500).json({ message: "Server error deleting project" });
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
    getMyTeams,
    checkUserOwnsProject,
    getOwnedProjectsWithRequests,
    getJoinRequestDetail,
    getJoinRequestsByProject,
    deleteProject,
  };
};

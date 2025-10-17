const { ObjectId } = require("mongodb");
// Mentor Application Controller
const SessionController = (sessionApplication, user, sessions) => {
  // apply user for session schedule
  const applyForSession = async (req, res) => {
    try {
      const { title, description, skills, menteeEmail, mentorName, mentorEmail } = req.body;

      // Validation
      if (!menteeEmail || !title || !description || !skills || !mentorName || !mentorEmail) {
        return res.status(400).json({ message: "All fields are required." });
      }

      // Optional: check if same user already has a pending session
      const existing = await sessionApplication.findOne({ menteeEmail, title });
      if (existing) {
        return res
          .status(400)
          .json({ message: "You already requested this session." });
      }

      const sessionRequest = {
        menteeEmail,        
        title,
        description,
        skills,
        mentorName,
        mentorEmail,
        status: "pending",
        createdAt: new Date(),
      };

      await sessionApplication.insertOne(sessionRequest);

      res
        .status(201)
        .json({ message: "Session request submitted successfully!" });
    } catch (error) {
      console.error("Error submitting session request:", error);
      res.status(500).json({
        message: "Error submitting session request",
        error: error.message,
      });
    }
  };

  // get user all application session request
 const getAllSessionApplications = async (req, res) => {
  try {
    const { email } = req.query;
    
    // If no email provided, return empty array or error
    if (!email) {
      return res.status(400).json({
        message: "Email parameter is required"
      });
    }
    
    // Filter by mentorEmail
    const result = await sessionApplication.find({ mentorEmail: email }).toArray();
    
    // If no requests found
    if (result.length === 0) {
      return res.json({
        message: "No requests found",
        data: []
      });
    }
    
    res.json(result);
      } catch (error) {
        res.status(500).json({
          message: "Error fetching applications",
          error: error.message,
        });
      }
    };

  //  PATCH (Approve/Reject a request)
  const updateSessionStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      // ✅ Validation
      if (!status || !["approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Invalid status value" });
      }

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status,
          updatedAt: new Date(),
        },
      };

      const result = await sessionApplication.updateOne(filter, updateDoc);

      if (result.modifiedCount === 0) {
        return res.status(404).json({ message: "Session request not found" });
      }

      res.status(200).json({
        success: true,
        message: `Session request ${status} successfully.`,
      });
    } catch (error) {
      console.error("Error updating session request:", error);
      res.status(500).json({
        message: "Error updating session request",
        error: error.message,
      });
    }
  };

  // schedule session  added

  const addScheduleSession = async (req, res) => {
    try {
      const payload = req.body;
      payload.createdAt = new Date();
      const result = await sessions.insertOne(payload);
      res.status(201).json({ message: "Session added successfully!", result });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error adding session", error: error.message });
    }
  };

  // get my session
  const getMySessions = async (req, res) => {
    try {
      const { email } = req.query;
      const result = await sessions.find({ menteeEmail: email }).toArray();
      res.json(result);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error fetching Session", error: error.message });
    }
  };


  // Delete my session
  const deleteMySession=async(req,res)=>{
    try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await sessions.deleteOne(query);
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .json({ message: "Error deleting session", error: error.message });
      }
  }

  return {
    applyForSession,
    getAllSessionApplications,
    updateSessionStatus,
    addScheduleSession,
    getMySessions,
    deleteMySession
  };
};
module.exports = SessionController;

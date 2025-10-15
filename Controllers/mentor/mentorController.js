const { ObjectId } = require("mongodb");

// Mentor Application Controller
const MentorController = (mentorApplications, users) => {
  
  // Apply to become mentor
  const applyForMentor = async (req, res) => {
    try {
      const { expertise, experience, availability, motivation } = req.body;
      const email = req.decoded?.email;

      if (!email || !expertise || !experience || !availability || !motivation) {
        return res.status(400).json({ message: "All fields are required." });
      }

      const existing = await mentorApplications.findOne({ email });
      if (existing) {
        return res.status(400).json({ message: "You have already applied." });
      }

      const application = {
        email,
        expertise,
        experience,
        availability,
        motivation,
        status: "pending",
        appliedAt: new Date(),
      };

      await mentorApplications.insertOne(application);
      res.status(201).json({ message: "Application submitted successfully!" });
    } catch (error) {
      res.status(500).json({ message: "Error submitting application", error: error.message });
    }
  };

  // Get all applications (Admin only)
  const getAllMentorApplications = async (req, res) => {
    try {
      const result = await mentorApplications.find().toArray();
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Error fetching applications", error: error.message });
    }
  };

  // ✅ Approve or Reject mentor (REPLACE your old one with this)
 const updateMentorStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // "approved" or "rejected"

    // Validate status
    const validStatuses = ["approved", "rejected"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const app = await mentorApplications.findOne({ _id: new ObjectId(id) });
    if (!app) return res.status(404).json({ message: "Application not found" });

    // Update the mentor application
    await mentorApplications.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status } }
    );

    // If approved, update user's role AND add mentor details
    if (status === "approved") {
      await users.updateOne(
        { email: app.email },
        { 
          $set: { 
            role: "mentor",
            expertise: app.expertise,
            experience: app.experience,
            availability: app.availability,
            motivation: app.motivation,
            photo: app.photo || "" // optional: add if you have photo
          }
        }
      );
    }

    res.json({ message: `Mentor ${status} successfully.` });
  } catch (error) {
    console.error("Error updating mentor status:", error);
    res.status(500).json({ message: "Error updating mentor status", error: error.message });
  }
};


  // Get user’s own mentor application
  const getUserApplication = async (req, res) => {
    try {
      const email = req.decoded?.email;
      const application = await mentorApplications.findOne({ email });
      if (!application) return res.status(404).json({ message: "No application found." });
      res.json(application);
    } catch (error) {
      res.status(500).json({ message: "Error fetching your application", error: error.message });
    }
  };

  
// Get all approved mentors
const getApprovedMentors = async (req, res) => {
  try {
    // Find users whose role is mentor
    const mentors = await users.find({ role: "mentor" }).toArray();
    res.json(mentors);
  } catch (error) {
    console.error("Error fetching approved mentors:", error);
    res.status(500).json({
      message: "Failed to fetch approved mentors",
      error: error.message,
    });
  }
};


  return { applyForMentor, getAllMentorApplications, updateMentorStatus, getUserApplication,getApprovedMentors };
};

module.exports = MentorController;

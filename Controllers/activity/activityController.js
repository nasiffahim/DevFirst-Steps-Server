// controllers/activityController.js

// Activity points configuration
const activityPoints = {
  "project-addition": 20,
  "blog-posting": 15,
  "discussion-participation": 5,
};

// Badge calculation helper
function calculateBadge(points) {
  if (points >= 100) return "Gold";
  if (points >= 50) return "Silver";
  if (points >= 20) return "Bronze";
  return "Newbie";
}

// Update Activity Controller
const updateActivity = (users) => async (req, res) => {
  try {
    const { email, activityType } = req.body;

    // Validate input
    if (!email || !activityType || !activityPoints[activityType]) {
      return res.status(400).json({ message: "Invalid request data" });
    }

    // Find user
    const user = await users.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Calculate new points + badge
    const newPoints = (user.points || 0) + activityPoints[activityType];
    const newBadge = calculateBadge(newPoints);

    // Update user data
    await users.updateOne(
      { email },
      { $set: { points: newPoints, badge: newBadge } }
    );

    res.status(200).json({
      message: "✅ Activity updated successfully",
      points: newPoints,
      badge: newBadge,
    });
  } catch (error) {
    console.error("❌ Error updating activity:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Leaderboard Controller
const getLeaderboard = (users) => async (req, res) => {
  try {
    const leaderboard = await users
      .find(
        { email: { $ne: "admin@devfirststeps.com" } },
        { projection: { name: 1, email: 1, points: 1, badge: 1 } }
      )
      .sort({ points: -1 })
      .limit(10)
      .toArray();

    res.status(200).json(leaderboard);
  } catch (error) {
    console.error("❌ Error fetching leaderboard:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  updateActivity,
  getLeaderboard,
};
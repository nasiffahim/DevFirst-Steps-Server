// Controllers/User/UserController.js

module.exports = (users, bookmarks, projects, blogs) => {
  // Get Logged-in User Info
  const getSingleUser = async (req, res) => {
    try {
      const { emailParams } = req.query;

      if (!emailParams) {
        return res.status(400).json({ message: "Email is required" });
      }

      const userData = await users.findOne({ email: emailParams });

      if (!userData) {
        return res.status(404).json({ message: "User not found" });
      }

      res.status(200).json(userData);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  };

  // Update User Info
  const updateUser = async (req, res) => {
    try {
      const { email } = req.query;
      const updateData = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const result = await users.updateOne(
        { email },
        { $set: updateData }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      res.status(200).json({
        message: "User updated successfully",
        modifiedCount: result.modifiedCount,
      });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  };

  // Get User Role, Points and Badge
  const getUserRole = async (req, res) => {
    try {
      const { email } = req.query;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await users.findOne({ email });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.status(200).json({
        email: user.email,
        role: user.role,
        points: user.points ?? 0,
        badge: user.badge ?? null,
      });
    } catch (error) {
      console.error("Error fetching user role:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  };

  // Get User Dashboard
  const getUserDashboard = async (req, res) => {
    try {
      const email = req.query.email || req.user?.email;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // --- Fetch user data ---
      const userData = await users.findOne({ email });

      // --- Count documents in parallel ---
      const [bookmarkCount, projectCount, blogCount, matchCount] = await Promise.all([
        bookmarks.countDocuments({ email }),
        projects.countDocuments({ AuthorEmail: email }),
        blogs.countDocuments({ AuthorEmail: email }),
        (async () => {
          if (!userData?.skills?.length) return 0;
          const skillRegex = userData.skills.map((s) => new RegExp(s, "i"));
          return projects.countDocuments({ tech: { $in: skillRegex } });
        })(),
      ]);

      // --- Fetch latest user-created projects & blogs ---
      const [latestProjects, latestBlogs] = await Promise.all([
        projects
          .find({ AuthorEmail: email })
          .sort({ createdAt: -1 })
          .limit(3)
          .toArray(),
        blogs
          .find({ AuthorEmail: email })
          .sort({ createdAt: -1 })
          .limit(3)
          .toArray(),
      ]);

      // --- Build response ---
      const dashboardData = {
        user: {
          name: userData?.name || "User",
          email,
          badge: userData?.badge || "Newbie",
          points: userData?.points || 0,
        },
        stats: {
          bookmarks: bookmarkCount || 0,
          projects: projectCount || 0,
          blogs: blogCount || 0,
          projectMatches: matchCount || 0,
        },
        latest: {
          projects: latestProjects || [],
          blogs: latestBlogs || [],
        },
      };

      res.status(200).json(dashboardData);
    } catch (error) {
      console.error("❌ Error fetching user dashboard:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  };

  return {
    getSingleUser,
    updateUser,
    getUserRole,
    getUserDashboard,
  };
};
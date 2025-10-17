import axios from "axios";

// Existing function
export const allUsers = async (req, res, User) => {
  try {
    // Fetch all users except those with the role "admin"
    const users = await User.find({ role: { $ne: "admin" } }).toArray();

    // Send response with status 200 (OK)
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// New admin overview function
export const adminOverview = async (req, res, collections) => {
  try {
    const { users, projects, blogs } = collections;

    // 1. Total users (from DB)
    const totalUsers = await users.countDocuments();

    // 2. DB Projects
    const dbProjectsCount = await projects.countDocuments();

    // 3. GitHub Projects (fetch latest popular open source repos)
    const githubUrl = `https://api.github.com/search/repositories?q=stars:>100+forks:>50&sort=stars&order=desc&per_page=30`;
    const { data: githubData } = await axios.get(githubUrl, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, // required for higher rate limit
      },
    });

    const githubProjectsCount = githubData.total_count || 0;

    // 4. Pending approval projects (from DB)
    const pendingApprovalCount = await projects.countDocuments({
      status: "pending",
    });

    // 5. Reported projects (from DB)
    const reportedProjectsCount = await projects.countDocuments({
      reported: true,
    });

    // 6. Projects by tech (DB)
    const dbProjectsByTech = await projects
      .aggregate([
        { $unwind: "$tech" }, // assumes "tech" is an array
        { $group: { _id: "$tech", count: { $sum: 1 } } },
      ])
      .toArray();

    // Convert DB aggregation into map
    const dbMap = dbProjectsByTech.reduce((acc, item) => {
      acc[item._id || "Unknown"] = item.count;
      return acc;
    }, {});

    // 7. Projects by tech (GitHub -> language field)
    const githubProjectsByTech = githubData.items.reduce((acc, repo) => {
      const lang = repo.language || "Unknown";
      acc[lang] = (acc[lang] || 0) + 1;
      return acc;
    }, {});

    // 8. Merge DB + GitHub results
    const mergedTechStats = {};
    for (const [tech, count] of Object.entries(dbMap)) {
      mergedTechStats[tech] = (mergedTechStats[tech] || 0) + count;
    }
    for (const [tech, count] of Object.entries(githubProjectsByTech)) {
      mergedTechStats[tech] = (mergedTechStats[tech] || 0) + count;
    }

    // Convert merged result to array
    const projectsByTech = Object.entries(mergedTechStats).map(
      ([tech, count]) => ({
        tech,
        count,
      })
    );

    // 9. Projects by category (DB only)
    const projectsByCategoryCursor = await projects
      .aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }])
      .toArray();

    // 10. Recent DB projects
    const recentProjects = await projects
      .find()
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    // 11. Recent DB blogs
    const recentBlogs = await blogs
      .find({}, { projection: { thumbnail: 0 } })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    // ✅ Final Response
    res.status(200).json({
      totalUsers,
      totalProjects: dbProjectsCount + githubProjectsCount,
      dbProjects: dbProjectsCount,
      githubProjects: githubProjectsCount,
      pendingApproval: pendingApprovalCount,
      reportedProjects: reportedProjectsCount,
      projectsByTech, // 👈 combined DB + GitHub
      projectsByCategory: projectsByCategoryCursor,
      recentProjects,
      recentBlogs,
    });
  } catch (error) {
    console.error("Admin overview error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
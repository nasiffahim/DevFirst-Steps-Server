const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require("mongodb");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const { default: axiosRetry } = require("axios-retry");
require("dotenv").config();

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

const { registerUser, loginUser } = require("./controllers/authController");
const {
  createPost,
  getDiscussions,
  getTopDiscussions,
  getDiscussionById,
  voteDiscussion,
  getStats,
  getVoteStatus,
} = require("./discussions/discussionController");
const {
  getComments,
  addComment,
  deleteComment,
} = require("./discussions/commentController");
const bookmarkController = require("./bookmarks/bookmarksController");
const {
  allPost,
  removePost,
  singlePost,
  updatePost,
} = require("./myPost/allPost");
const { verifyToken } = require("./middleware/verifyToken");
const { Support } = require("./chat/ChatController");
const { allUsers } = require("./adminDashboardControlloer/adminDashboard");

//Middlware
app.use(
  cors({
    origin: ["http://localhost:3000", "https://dev-first-steps.vercel.app"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      error.code === "ETIMEDOUT"
    );
  },
});

const client = new MongoClient(process.env.DB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const db = client.db("dev_first_stepsDB");
    const users = db.collection("user");
    const projects = db.collection("add-projects");
    const blogs = db.collection("add-blogs");
    const discussion = db.collection("discussions");
    const comment = db.collection("comment");
    const bookmarks = db.collection("bookmarks");

    // All Open Source Projects API ------ Github Free API with token

    app.get("/all_projects", async (req, res) => {
      try {
        const {
          query = "",
          lang = "",
          topics = "",
          stars = "100",
          forks = "10",
          sort = "stars",
          order = "desc",
          page = "1",
          perPage = "9",
        } = req.query;

        // console.log("Request params:", { query, lang, topics, stars, forks });

        let searchQuery = "";

        // Build search query using keywords for consistency
        if (query) {
          searchQuery += `${query} `;
        }

        // Convert language filters to keyword search instead of language: filter
        if (lang) {
          searchQuery += `${lang} `;
        }

        // Convert topics to keywords
        if (topics) {
          const topicList = topics.split(",");
          searchQuery += topicList.map((t) => t.trim()).join(" ") + " ";
        }

        searchQuery += `stars:>${stars} forks:>${forks}`;

        // console.log("Final GitHub search query:", searchQuery.trim());

        const githubUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(
          searchQuery.trim()
        )}&sort=${sort}&order=${order}&page=${page}&per_page=${perPage}`;

        // console.log("GitHub URL:", githubUrl);

        const { data } = await axios.get(githubUrl, {
          timeout: 10000,
          headers: {
            Accept: "application/vnd.github.v3+json",
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          },
        });

        // console.log("Results found:", data.total_count);
        res.json(data);
      } catch (err) {
        console.error("Error fetching projects:", err.message);
        res.status(500).json({ error: "Server error" });
      }
    });

    // Project Details API
    app.get("/project/:id", async (req, res) => {
      try {
        const { id } = req.params;

        console.log("Fetching project details for ID:", id);

        // First, try to get the repository details directly from GitHub API
        const githubUrl = `https://api.github.com/repositories/${id}`;

        console.log("GitHub URL:", githubUrl);

        const { data } = await axios.get(githubUrl, {
          headers: {
            Accept: "application/vnd.github.v3+json",
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          },
        });

        console.log("Project details found:", data.name);
        res.json(data);
      } catch (err) {
        console.error("Error fetching project details:", err.message);

        // If the direct repository API fails, try searching for it
        try {
          const searchUrl = `https://api.github.com/search/repositories?q=repo:${req.params.id}`;
          const { data } = await axios.get(searchUrl, {
            headers: {
              Accept: "application/vnd.github.v3+json",
              Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            },
          });

          if (data.items && data.items.length > 0) {
            res.json(data.items[0]);
          } else {
            res.status(404).json({ error: "Project not found" });
          }
        } catch (searchErr) {
          console.error("Search fallback also failed:", searchErr.message);
          res.status(500).json({ error: "Failed to fetch project details" });
        }
      }
    });

    app.post("/jwt", (req, res) => {
      const { email } = req.body;

      if (!email) {
        return res.status(400).send("Email is required");
      }
      const token = jwt.sign({ email }, process.env.JWT_ACCESS_SECRET, {
        expiresIn: "2h",
      });

      res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
      });

      res.send({ success: true });
    });

    // register user endpoint
    app.post("/user_create", (req, res) => registerUser(req, res, users));
    // login social endpoint
    app.post("/login", (req, res) => loginUser(req, res, users));

    // Discussion app
    app.post("/create_post", (req, res) => createPost(req, res, discussion));
    // add discussion
    app.get("/api/discussions", (req, res) =>
      getDiscussions(req, res, discussion)
    );
    // get top discussion
    app.get("/api/top-discussions", (req, res) =>
      getTopDiscussions(req, res, discussion)
    );
    // get discussion by ID
    app.get("/api/discussions/:id", (req, res) =>
      getDiscussionById(req, res, discussion)
    );
    // stats count
    app.get("/api/discussions/:id/vote-status", (req, res) =>
      getVoteStatus(req, res, discussion)
    );
    // user vote
    app.patch("/api/discussions/:id/vote", (req, res) =>
      voteDiscussion(req, res, discussion)
    );

    // user like match
    app.get("/api/stats", (req, res) =>
      getStats(req, res, discussion, comment, users)
    );
    // Comment
    app.get("/api/comments/:discussionId", (req, res) =>
      getComments(req, res, comment)
    );
    // add comment
    app.post("/api/comments/:discussionId", (req, res) =>
      addComment(req, res, comment)
    );
    // remove replay
    app.delete("/api/comments/:commentId", (req, res) =>
      deleteComment(req, res, comment)
    );
    // add all userPost
    app.get("/api/my/posts", verifyToken, async (req, res) => {
      allPost(req, res, discussion, comment);
    });
    //  remove  single post
    app.delete("/remove/posts/:id", verifyToken, async (req, res) => {
      await removePost(req, res, discussion);
    });
    //  single post
    app.get("/api/posts/:id", (req, res) => singlePost(req, res, discussion));
    //  update post
    app.patch("/edit/post/:id", (req, res) => updatePost(req, res, discussion));
    // gpt api message
    app.post("/chat", (req, res) => Support(req, res));
    // only all user
    app.get("/all/users", verifyToken, async (req, res) => {
      allUsers(req, res, users);
    });

    // Bookmark Projects
    const { checkBookmark, getBookmarks, addBookmark, deleteBookmark } =
      bookmarkController(bookmarks);

    // ✅ Routes
    app.get("/bookmarks/check/:projectId", checkBookmark);
    app.get("/bookmarks/:email", getBookmarks);
    app.post("/bookmarks", addBookmark);
    app.delete("/bookmarks/:projectId", deleteBookmark);

    app.get("/single_user", async (req, res) => {
      try {
        const { emailParams } = req.query;
        console.log(emailParams);

        if (!emailParams) {
          return res.status(400).json({ message: "Email is required" });
        }
        // Search  user in MongoDB
        const userData = await users.findOne({ email: emailParams });

        if (!userData) {
          return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json(userData);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
      }
    });

    // ------------ update user profile  API
    // Update user info
    app.put("/update_user", verifyToken, async (req, res) => {
      try {
        const { email } = req.query; // email in query params
        const updateData = req.body; // fields to update

        if (!email) {
          return res.status(400).json({ message: "Email is required" });
        }

        // Update the user in MongoDB
        const result = await users.updateOne(
          { email: email },
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
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
      }
    });

    // ------------ Admin Overview API
    app.get("/admin-overview", async (req, res) => {
      try {
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
    });

    // Get user role by email
    app.get("/user-role", async (req, res) => {
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
    });

    // Activity points
    const activityPoints = {
      "project-addition": 20,
      "blog-posting": 15,
      "discussion-participation": 5,
    };

    // Badge calculation
    function calculateBadge(points) {
      if (points >= 100) return "Gold";
      if (points >= 50) return "Silver";
      if (points >= 20) return "Bronze";
      return "Newbie";
    }

    //  Update Activity API

    app.post("/update-activity", async (req, res) => {
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
    });

    //  Leaderboard API
    app.get("/leaderboard", async (req, res) => {
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
    });

    // Add new project

    app.post("/add-projects", async (req, res) => {
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
    });

    //Get all projects

    app.get("/my-projects", async (req, res) => {
      try {
        const result = await projects.find().toArray();
        res.json(result);
      } catch (error) {
        res
          .status(500)
          .json({ message: "Error fetching projects", error: error.message });
      }
    });
    //Get projects by user email and show in my projects
    app.get("/add-projects/:email", async (req, res) => {
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
    });

    // Add new blogs

    app.post("/add-blogs", async (req, res) => {
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
    });

    //Get all blogs

    app.get("/all-blogs", async (req, res) => {
      try {
        const result = await blogs.find().toArray();
        res.json(result);
      } catch (error) {
        res
          .status(500)
          .json({ message: "Error fetching blogs", error: error.message });
      }
    });

    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("DevFirst Steps Server Running!!!");
});

app.listen(port, () => {
  console.log(`DevFirst Steps server running on port ${port}`);
});

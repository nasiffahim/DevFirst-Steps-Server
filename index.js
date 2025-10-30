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
const { ObjectId } = require("mongodb");

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

const {
  registerUser,
  loginUser,
} = require("./Controllers/auth/authController.js");
const {
  getAllProjects,
  getProjectById,
  getSkillMatchedProjects,
} = require("./Controllers/allProjects/ProjectsController.js");
const {
  getBeginnerProjects,
  getBeginnerProjectsByLabel,
  getActiveBeginnerProjects,
  getTrendingBeginnerProjects,
  getBeginnerIssues,
} = require("./Controllers/beginnerProjects/beginnerProject.js");
const {
  createPost,
  getDiscussions,
  getTopDiscussions,
  getDiscussionById,
  voteDiscussion,
  getStats,
  getVoteStatus,
} = require("./Controllers/discussions/discussionController.js");
const {
  getComments,
  addComment,
  deleteComment,
} = require("./Controllers/discussions/commentController.js");
const bookmarkController = require("./Controllers/bookmarks/bookmarksController.js");
const {
  allPost,
  removePost,
  singlePost,
  updatePost,
} = require("./Controllers/myPost/allPost.js");
const { verifyToken } = require("./middleware/verifyToken");
const { Support } = require("./Controllers/chat/ChatController.js");
const UserController = require("./Controllers/User/UserController.js");
const {
  allUsers,
  adminOverview,
} = require("./Controllers/admin/adminController.js");
const {
  updateActivity,
  getLeaderboard,
} = require("./Controllers/activity/activityController.js");
const UserProjectController = require("./Controllers/userProjects/userProjectController.js");
const UserBlogController = require("./Controllers/userBlogs/userBlogController.js");
const { learning } = require("./Controllers/learning/learning.js");
const MentorController = require("./Controllers/mentor/mentorController.js");
const SessionController = require("./Controllers/session/sessionController.js");
const { aiSuggestion } = require("./Controllers/aiSuggestion/aiSuggestion.js");
const { project_get } = require("./Controllers/porject-git/projectGit.js");
const { getRepositoryHealth } = require("./Controllers/healthMetrics/HealthMetricsController.js");
const { getContributionScore } = require("./Controllers/contributionScore/contributionScoreController.js");

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
    const learnings = db.collection("learnings");
    const mentorApplications = db.collection("mentor_applications");
    const mentors = db.collection("mentors");
    const collaborations = db.collection("collaborations");
    const joinRequests = db.collection("join_requests");
    const sessions = db.collection("session");

    const sessionApplication = db.collection("session-applications");

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

    // Auth APIs

    // register user endpoint
    app.post("/user_create", (req, res) => registerUser(req, res, users));
    // login social endpoint
    app.post("/login", (req, res) => loginUser(req, res, users));

    // Open Source Projects APIs

    // All Open Source Projects API ------ Github Free API with token
    app.get("/all_projects", getAllProjects);
    // Project details by ID
    app.get("/project/:id", getProjectById);
    // Repository Health Metrics
    app.get("/health/:owner/:repo", getRepositoryHealth);
    // Contribution Score Metrics
    app.get("/contribution-score/:owner/:repo/:username", getContributionScore);
    // Skill matcher
    app.get("/skill_matcher", getSkillMatchedProjects);

    // Beginner Friendly Projects APIs
    // All Beginner Friendly Projects API
    app.get("/projects/beginners/all", getBeginnerProjects);
    // Beginner projects with labels
    app.get("/projects/beginners/label", getBeginnerProjectsByLabel);
    // Get Active Beginner Projects
    app.get("/projects/beginners/active", getActiveBeginnerProjects);
    // Get Trending Beginner Projects
    app.get("/projects/beginners/trending", getTrendingBeginnerProjects);
    // Get Beginner Issues for a specific repository
    app.get("/projects/:owner/:repo/beginner-issues", getBeginnerIssues);

    // Discussions & Comments APIs

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
    // all language learning stack
    app.get("/learning/path", (req, res) => learning(req, res, learnings));

    // Open AI Chat GPT Integration
    app.post("/get-projects", (req, res) => aiSuggestion(req, res));
    // gpt api message
    app.post("/chat", (req, res) => Support(req, res));

    app.get("/project/git/:names",(req,res)=> project_get(req,res));
    
    // Project Bookmark APIs

    // Bookmark Projects
    const { checkBookmark, getBookmarks, addBookmark, deleteBookmark } =
      bookmarkController(bookmarks);
    // Check if a project is bookmarked by a user
    app.get("/bookmarks/check/:projectId", checkBookmark);
    // Get all bookmarks for a user
    app.get("/bookmarks/:email", getBookmarks);
    // Add a new bookmark
    app.post("/bookmarks", addBookmark);
    // Delete a bookmark
    app.delete("/bookmarks/:projectId", deleteBookmark);

    // User Profile & Management APIs

    // User Profile APIs
    const { getSingleUser, updateUser, getUserRole, getUserDashboard } =
      UserController(users, bookmarks, projects, blogs);
    // Logged in user info  API
    app.get("/single_user", getSingleUser);
    // Update user info  API
    app.put("/update_user", updateUser);
    // Get user role, badge & points by email  API
    app.get("/user-role", getUserRole);
    // User Dashboard API
    app.get("/api/user/dashboard", getUserDashboard);

    // Admin APIs

    // Admin overview route
    app.get("/admin-overview", async (req, res) => {
      adminOverview(req, res, { users, projects, blogs });
    });
    // All users route with token verification
    app.get("/all/users", verifyToken, async (req, res) => {
      allUsers(req, res, users);
    });

    // Activity Points & Leaderboard

    //Update Activity API
    app.post("/update-activity", updateActivity(users));
    // Leaderboard API
    app.get("/leaderboard", getLeaderboard(users));

    // User Specific Projects & Blogs APIs

    // User Project APIs
    const {
      addProject,
      getAllUserProjects,
      getProjectsByEmail,
      getUserProjectById,
      getProjectForUpdate,
      updateProject,
      deleteProject,
    } = UserProjectController(projects);

    // Add new project
    app.post("/add-projects", addProject);
    // Get all user projects
    app.get("/my-projects", getAllUserProjects);
    // Get projects by user email
    app.get("/add-projects/:email", getProjectsByEmail);
    // Get project details by ID
    app.get("/my-projects/:id", getUserProjectById);
    // Get single project by ID for update
    app.get("/update-project/:id", getProjectForUpdate);
    // Update project by ID
    app.put("/update-project/:id", updateProject);
    // Delete project by ID
    app.delete("/my-projects/:id", deleteProject);

    // User Blogs APIs
    const {
      addBlog,
      getBlogById,
      updateBlog,
      deleteBlog,
      getAllBlogs,
      getUserBlogs,
    } = UserBlogController(blogs);

    // Add new blogs
    app.post("/add-blogs", verifyToken, addBlog);
    // Get all blogs
    app.get("/all-blogs", getAllBlogs);
    // Get blogs of logged-in user
    app.get("/my-blogs", verifyToken, getUserBlogs);
    // Get blog details by ID
    app.get("/my-blogs/:id", getBlogById);
    // Update a blog by ID
    app.put("/my-blogs/:id", updateBlog);
    // Delete a blog by ID
    app.delete("/my-blogs/:id", deleteBlog);

    // Mentor Application APIs
    const {
      applyForMentor,
      getAllMentorApplications,
      updateMentorStatus,
      getUserApplication,
      getApprovedMentors,
      mentorsDetailsPage,
    } = MentorController(mentorApplications, users);

    // Apply for mentor (User)
    app.post("/apply-mentor", verifyToken, applyForMentor);

    // Get all mentor applications (Admin)
    app.get(
      "/admin/mentor-applications",
      verifyToken,
      getAllMentorApplications
    );

    // Approve / Reject mentor (Admin)
    app.patch(
      "/admin/mentor-applications/:id",
      verifyToken,
      updateMentorStatus
    );

    // Get logged-in user's mentor application
    app.get("/my-mentor-application", verifyToken, getUserApplication);

    // GET all approved mentors
    app.get("/mentors", getApprovedMentors);

    // Collaboration Controller
    const CollaborationController =
      require("./Controllers/collaborationController/collaborationController.js")(
        collaborations,
        joinRequests,
        users
      );

    // Collaboration APIs
    app.post(
      "/collaboration/create",
      CollaborationController.createCollaboration
    );
    app.get("/collaboration/all", CollaborationController.getAllCollaborations);
    app.get(
      "/collaboration/manage-projects",
      CollaborationController.getOwnedProjectsWithRequests
    );
    app.get(
      "/collaboration/commitPercentage",
      CollaborationController.getUserCommitPercentage
    );
    app.get(
      "/collaboration/join-requests-by-project/:projectId",
      CollaborationController.getJoinRequestsByProject
    );

    app.get(
      "/collaboration/join-request-for-project/:requestId",
      CollaborationController.getJoinRequestDetail
    );
    app.delete(
      "/collaboration/delete-project/:projectId",
      CollaborationController.deleteProject
    );

    app.get(
      "/collaboration/check-owner",
      CollaborationController.checkUserOwnsProject
    );

    // ✅ Place all static routes before the ":id" route
    app.post("/collaboration/join", CollaborationController.sendJoinRequest);
    app.get("/collaboration/my-teams", CollaborationController.getMyTeams);
    // app.get(
    //   "/collaboration/my-requests",
    //   CollaborationController.getUserJoinRequests
    // );
    app.get(
      "/collaboration/requests",
      CollaborationController.getJoinRequestsForOwner
    );

    app.patch(
      "/collaboration/request/:requestId/accept",
      CollaborationController.acceptJoinRequest
    );
    app.patch(
      "/collaboration/request/:requestId/reject",
      CollaborationController.rejectJoinRequest
    );

    // Single collaboration details
    app.get(
      "/collaboration/:id",
      CollaborationController.getSingleCollaboration
    );

    // mentor details
    app.get("/mentors/:id", mentorsDetailsPage);

    // session application APIS
    const {
      applyForSession,
      getAllSessionApplications,
      updateSessionStatus,
      addScheduleSession,
      getMySessions,
      deleteMySession,
      getAllScheduledSessions,
    } = SessionController(sessionApplication, users, sessions);

    // apply user for session schedule
    app.post("/session-requests", applyForSession);

    // get user all request session
    app.get("/session-requests", getAllSessionApplications);

    // ✅ PATCH (Approve/Reject a request)
    app.patch("/session-requests/:id", updateSessionStatus);

    // schedule session  added
    app.post("/schedule-session", addScheduleSession);

    // GET all scheduled sessions for a mentor or mentee
    app.get("/schedule-session", getAllScheduledSessions);

    // get my session
    app.get("/my-schedule-session", getMySessions);

    // Delete my session
    app.delete("/my-schedule-session/:id", deleteMySession);

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

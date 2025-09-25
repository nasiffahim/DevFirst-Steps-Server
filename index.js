const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');
const  cookieParser = require('cookie-parser');
const  jwt = require('jsonwebtoken');
const axios = require('axios');
const { default: axiosRetry } = require('axios-retry');
require('dotenv').config();

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser())


//Middlware

app.use(cors({
  origin: ["http://localhost:3000"], 
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
}));


axiosRetry(axios, {
  retries: 3, // retry up to 3 times
  retryDelay: axiosRetry.exponentialDelay, // wait 2s, then 4s, then 8s...
  retryCondition: (error) => {
    // retry on network errors or 5xx responses
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.code === "ETIMEDOUT";
  },
});


// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.tur8sdy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version


const client = new MongoClient(process.env.DB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});



async function run() {
  try {

    const db = client.db("dev_first_stepsDB");
    const users = db.collection("user");
    const projects =db.collection("add-projects")
    const blogs =db.collection("add-blogs")

    const verifyToken = (req, res, next) => {
      const token = req?.cookies?.token;
      if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
      }
      jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, decoded) => {
        if (err) {
          return res.status(403).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      });
    }


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

        console.log("Request params:", { query, lang, topics, stars, forks });

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
          searchQuery += topicList.map(t => t.trim()).join(' ') + ' ';
        }
        
        searchQuery += `stars:>${stars} forks:>${forks}`;

        console.log("Final GitHub search query:", searchQuery.trim());

        const githubUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(
          searchQuery.trim()
        )}&sort=${sort}&order=${order}&page=${page}&per_page=${perPage}`;

        console.log("GitHub URL:", githubUrl);

        const { data } = await axios.get(githubUrl, {
          timeout: 10000,
          headers: {
            Accept: "application/vnd.github.v3+json",
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          },
        });

        console.log("Results found:", data.total_count);
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

    app.post('/jwt',(req, res) => {
    
      const { email } = req.body;

      if (!email) {

        return res.status(400).send('Email is required');
      }
      const token = jwt.sign(
        { email }, 
        process.env.JWT_ACCESS_SECRET,  { expiresIn: '2h' }
      );


      res.cookie('token', token, {
        httpOnly: true,
        secure: true, 
        sameSite:"none"
      
      });

      res.send({ success: true });
    });


    app.post("/user_create", async (req, res) => {
      console.log(req.body);
      
      const { uid, email, fullName, image, role = "user", work = null } = req.body;

      if (!uid || !email || !fullName) {
        return res.status(400).json({ error: "UID, email, and fullName are required" });
      }

      const existingUser = await users.findOne({ email });

      if (existingUser) {
        return res.status(200).json({
          error: "User already registered",
          user: {
            id: existingUser._id.toString(),
            email: existingUser.email,
            username: existingUser.username,
            image: existingUser.image,
            role: existingUser.role,
            work: existingUser.work,
          },
        });
      }

      const newUser = {
        uid,
        email,
        username: fullName,
        image: image || null,
        role,
        work,
        createdAt: new Date(),
      };

      const result = await users.insertOne(newUser);

      return res.status(201).json({
        success: true,
        message: "User registered successfully",
        user: {
          id: result.insertedId.toString(),
          email,
          uid,
          username: fullName,
          image,
          role,
          work,
        },
      });
    });


    app.post("/login", async (req, res) => {
      try {
        const {
          uid,
          email,
          fullName,
          image = null,
          role = "user",
          work = null,
        } = req.body;

        if (!email || !uid) {
          return res.status(400).json({ error: "Email and UID are required" });
        }

        // Look for existing user by email
        let userDoc = await users.findOne({ email });

        if (userDoc) {
          return res.json({
            success: true,
            message: "User already exists",
            user: {
              id: userDoc._id.toString(),
              email: userDoc.email,
              username: userDoc.username,
              image: userDoc.image,
              role: userDoc.role,
              work: userDoc.work,
            },
          });
        }

        // Create username from fullName by removing spaces & lowercasing, fallback to email prefix
        let username = "";
        if (fullName && typeof fullName === "string") {
          username = fullName.trim().toLowerCase().replace(/\s+/g, "");
        } else if (email) {
          username = email.split("@")[0]; // use prefix of email as username fallback
        } else {
          username = "user" + Math.floor(Math.random() * 10000); // fallback username if all else fails
        }

        // Create new user object
        const newUser = {
          uid,
          email,
          username,
          image,
          role,
          work,
          createdAt: new Date(),
        };

        // Insert new user into DB
        const result = await users.insertOne(newUser);
        userDoc = { ...newUser, _id: result.insertedId };

        return res.json({
          success: true,
          message: "User profile created successfully",
          user: {
            id: userDoc._id.toString(),
            email: userDoc.email,
            username: userDoc.username,
            image: userDoc.image,
            role: userDoc.role,
            work: userDoc.work,
          },
        });
      } catch (error) {
        console.error("findOrCreateUser error:", error);
        return res.status(500).json({ error: "An error occurred while processing user data" });
    }
    });
    
    
    app.get("/single_user",async (req, res) => {
      try {
        const {emailParams} = req.query;
        console.log(emailParams);
        
        if (!emailParams) {
          return res.status(400).json({ message: "Email is required" });
        }
        // Search  user in MongoDB
        const userData = await users.findOne({ email:emailParams });

        if (!userData) {
          return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json(userData);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
      }
    });
        
        
    // Get Admin Dashboard Overview
    app.get("/admin-overview", async (req, res) => {
      try {
        // 1. Total users
        const totalUsers = await users.countDocuments();

        // 2. Total projects
        const totalProjects = await projects.countDocuments();

        // 3. Projects per user
        const projectsPerUserCursor = await projects.aggregate([
          { $group: { _id: "$createdBy", projectCount: { $sum: 1 } } }
        ]).toArray();

        // 4. Projects by category 
        const projectsByCategoryCursor = await projects.aggregate([
          { $group: { _id: "$category", count: { $sum: 1 } } }
        ]).toArray();

        // 5. Optional: Recent activity (latest 5 projects)
        const recentProjects = await projects.find()
          .sort({ createdAt: -1 })
          .limit(5)
          .toArray();

        res.status(200).json({
          totalUsers,
          totalProjects,
          projectsPerUser: projectsPerUserCursor,
          projectsByCategory: projectsByCategoryCursor,
          recentProjects
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

        res.status(200).json({ email: user.email, role: user.role });
      } catch (error) {
        console.error("Error fetching user role:", error);
        res.status(500).json({ message: "Server error", error: error.message });
      }
    });

    // Add new project

    app.post("/add-projects", async(req,res)=>{
      try{
        const project =req.body;
        project.createdAt =new Date()
        const result =await projects.insertOne(project);
        res.status(201).json({message: "Project added successfully!", result})
      }
      catch(error){
        res.status(500).json({ message: "Error adding project", error: error.message })

      }
    })

    //Get all projects

    app.get("/add-projects", async(req,res)=>{
      try{
        const result = await projects.find().toArray();
        res.json(result)
      }
      catch(error){
        res.status(500).json({ message: "Error fetching projects", error: error.message });
        
    }
    })

    // Add new blogs

    app.post("/add-blogs", async(req,res)=>{
      try{
        const blog =req.body;
        blog.createdAt =new Date()
        const result =await blogs.insertOne(blog);
        res.status(201).json({message: "blog added successfully!", result})
      }
      catch(error){
        res.status(500).json({ message: "Error adding blog", error: error.message })

      }
    })

    //Get all blogs

    app.get("/all-blogs", async(req,res)=>{
      try{
        const result = await blogs.find().toArray();
        res.json(result)
      }
      catch(error){
        res.status(500).json({ message: "Error fetching blogs", error: error.message });
        
    }
    })

    //Get projects by user email and show in my projects 

    app.get("/add-projects/:email", async (req,res)=>{
      try{
        const email = req.params.email;
      const result = await projects.find({ createdBy: email }).toArray();
      res.json(result)
      }
      catch(error){
        res.status(500).json({ message: "Error fetching user projects", error: error.message });

      }
    })



     await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('DevFirst Steps Server Running!!!');
});

app.listen(port, () => {
  console.log(`DevFirst Steps server running on port ${port}`);
});
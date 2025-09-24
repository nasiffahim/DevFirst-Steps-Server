require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');
const  cookieParser = require('cookie-parser');
const  jwt = require('jsonwebtoken');
const axios = require('axios');

app.use(express.json());
app.use(cookieParser())


//Middlware

app.use(cors({
  origin: ["http://localhost:3000"], 
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
}));



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

    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection

// const db = client.db("source");
const db = client.db("Allproduct");
const users = db.collection("user");
const projects =db.collection("add-projects")

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  console.log(token,"ok");
  
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



app.get("/all_rep", async (req, res) => {
  try {
    // Default query values
 const lang = req.query.lang || "Python";   // programming language
    const stars = Number(req.query.stars) || 500;          // minimum stars
    const forks =  Number(req.query.forks )|| 50;           // minimum forks
    const sort = req.query.sort || "stars";        // sort field (stars, forks, updated)
    const order = req.query.order || "desc";       // sorting order

    // GitHub API request
    const response = await axios.get(
      `https://api.github.com/search/repositories?q=language:${lang}+stars:>${stars}+forks:>${forks}&sort=${sort}&order=${order}`
    );

    // Axios does not have `.ok` like fetch
    // So we check using response.status
    if (response.status !== 200) {
      return res.status(response.status).json({ message: "GitHub API error" });
    }
    // Extract data from response
    const data = response.data;
    // Send only the repositories (items) to the frontend
    res.json(data.items);
  } catch (error) {
    // Log error for debugging
    console.error(error.response?.data || error.message);

    // Send error response
    res.status(500).json({
      message: "Failed to fetch repositories",
      error: error.message,
    });
  }
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
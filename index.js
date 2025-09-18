const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;// change   5000
const { MongoClient, ServerApiVersion, Long } = require('mongodb');
const axios = require('axios');
require('dotenv').config();

//Middlware

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.tur8sdy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
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

const db = client.db("source");
const users = db.collection("users");



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

app.post("/user_create",async (req, res) => {
  try {
    const { name, email, image } = req.body;
console.log(name,email,image);

    if (!name || !email || !image) {
      return res.status(400).json({ message: "All fields are required" });
    } 


    // Check if user already exists
    const existingUser = await users.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Insert new user
    const newUser = { name, email, image };
    await users.insertOne(newUser);

    res.status(201).json({
      message: "User created successfully",
      user: newUser,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
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
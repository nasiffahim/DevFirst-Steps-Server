const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;// change   5000
const { MongoClient, ServerApiVersion } = require('mongodb');
const { default: axios } = require('axios');
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



 
 app.get("/all", async (req, res) => {
  try {
      //  req query default value
    const lang = req.query.lang || "javascript";
    const stars = req.query.stars || 100;  
    const fork = req.query.fork || 10;    
 // git api get sending Frontend
    const response = await axios(
      `https://api.github.com/search/repositories?q=language:${lang}+stars:>${stars}+forks:>${fork}&sort=stars&order=desc`,
       {
        headers: {
          "User-Agent": "my-app"
        }
      }
    );
    if (!response.ok) {
      return res.status(response.status).json({ message: "GitHub API error" });
    }
     const data = response.data;
     res.json(data.items);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({
      message: "Failed to fetch repositories",
      error: error.message,
    });
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
  res.send('Open Source Server Running!!!');
});

app.listen(port, () => {
  console.log(`DevFirst Steps server running on port ${port}`);
});
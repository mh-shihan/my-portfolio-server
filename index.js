const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// parser
app.use(
  cors({
    origin: ["http://localhost:5173"], // Your frontend URL
    credentials: true,
  })
);
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.88ffpvi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const database = client.db("my_portfolio_db");
    const technologyCollection = database.collection("technologies");
    const projectCollection = database.collection("projects");
    const feedbackCollection = database.collection("feedbacks");
    const messageCollection = database.collection("messages");
    const certificateCollection = database.collection("certificates");

    app.get("/technologies", async (req, res) => {
      const result = await technologyCollection.find().toArray();
      res.send(result);
    });

    app.get("/projects", async (req, res) => {
      const projects = await projectCollection.find().toArray();
      res.send(projects);
    });

    app.get("/feedbacks", async (req, res) => {
      const feedbacks = await feedbackCollection.find().toArray();
      res.send(feedbacks);
    });

    app.get("/certificates", async (req, res) => {
      const result = await certificateCollection.find().toArray();
      res.send(result);
    });

    app.get("/projects/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const project = await projectCollection.findOne(query);
      res.send(project);
    });

    app.post("/feedbacks", async (req, res) => {
      try {
        const feedback = req.body;
        const result = await feedbackCollection.insertOne(feedback);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    app.post("/messages", async (req, res) => {
      const message = req.body;
      const result = await messageCollection.insertOne(message);
      res.send(result);
    });

    app.post("/certificates", async (req, res) => {
      const certificate = req.body;
      const result = await certificateCollection.insertOne(certificate);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
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
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`MY PORTFOLIO SERVER IS LISTENING ON PORT ${port}`);
});

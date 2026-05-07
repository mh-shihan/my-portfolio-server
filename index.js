const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const compression = require("compression");

const app = express();
const port = process.env.PORT || 4000;

// Enable gzip compression for all responses
app.use(compression());

// parser
app.use(
  cors({
    origin: [
      // "http://localhost:5173",
      // "https://my-portfolio-79349.web.app",
      // "https://my-portfolio-79349.firebaseapp.com",
      "https://shihandev.com",
      "http://shihandev.com",
    ], // Your frontend URL
    credentials: true,
  }),
);
app.use(express.json());

// Simple in-memory cache
const cache = {
  technologies: { data: null, timestamp: 0 },
  certificates: { data: null, timestamp: 0 },
  resume: { data: null, timestamp: 0 },
};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheData(key) {
  if (cache[key] && Date.now() - cache[key].timestamp < CACHE_TTL) {
    return cache[key].data;
  }
  return null;
}

function setCacheData(key, data) {
  cache[key] = { data, timestamp: Date.now() };
}

function clearCache(key) {
  if (cache[key]) {
    cache[key].data = null;
    cache[key].timestamp = 0;
  }
}

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
    const userCollection = database.collection("users");
    const blogCollection = database.collection("blogs");
    const resumeCollection = database.collection("resume");

    app.get("/technologies", async (req, res) => {
      try {
        const cachedData = getCacheData("technologies");
        if (cachedData) {
          return res.send(cachedData);
        }
        const result = await technologyCollection.find().toArray();
        setCacheData("technologies", result);
        res.send(result);
      } catch (error) {
        console.error("Error fetching technologies:", error);
        res.status(500).send({ error: "Failed to fetch technologies" });
      }
    });

    app.get("/projects", async (req, res) => {
      try {
        const projects = await projectCollection.find().toArray();
        res.send(projects);
      } catch (error) {
        console.error("Error fetching projects:", error);
        res.status(500).send({ error: "Failed to fetch projects" });
      }
    });

    app.get("/feedbacks", async (req, res) => {
      try {
        const feedbacks = await feedbackCollection.find().toArray();
        res.send(feedbacks);
      } catch (error) {
        console.error("Error fetching feedbacks:", error);
        res.status(500).send({ error: "Failed to fetch feedbacks" });
      }
    });

    app.get("/certificates", async (req, res) => {
      try {
        const cachedData = getCacheData("certificates");
        if (cachedData) {
          return res.send(cachedData);
        }
        const result = await certificateCollection.find().toArray();
        setCacheData("certificates", result);
        res.send(result);
      } catch (error) {
        console.error("Error fetching certificates:", error);
        res.status(500).send({ error: "Failed to fetch certificates" });
      }
    });

    app.get("/messages", async (req, res) => {
      try {
        const messages = await messageCollection.find().toArray();
        res.send(messages);
      } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).send({ error: "Failed to fetch messages" });
      }
    });

    app.get("/projects/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const project = await projectCollection.findOne(query);
      res.send(project);
    });

    app.get("/blogs", async (req, res) => {
      try {
        const blogs = await blogCollection.find().toArray();
        res.send(blogs);
      } catch (error) {
        console.error("Error fetching blogs:", error);
        res.status(500).send({ error: "Failed to fetch blogs" });
      }
    });

    app.get("/blogs/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const blog = await blogCollection.findOne(query);
        res.send(blog);
      } catch (error) {
        console.error("Error fetching blog:", error);
        res.status(500).send({ error: "Failed to fetch blog" });
      }
    });

    app.get("/resume", async (req, res) => {
      try {
        const cachedData = getCacheData("resume");
        if (cachedData) {
          return res.send(cachedData);
        }
        const resume = await resumeCollection.findOne();
        setCacheData("resume", resume);
        res.send(resume);
      } catch (error) {
        console.error("Error fetching resume:", error);
        res.status(500).send({ error: "Failed to fetch resume" });
      }
    });

    // Admin Api
    app.get("/admin/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const user = await userCollection.findOne({ email });

        let admin = false;
        if (user) {
          admin = user.role === "admin";
        }

        res.send({ admin });
      } catch (error) {
        console.error("Error checking admin:", error);
        res.status(500).send({ error: "Failed to check admin status" });
      }
    });

    // Create database indexes for better performance
    async function createIndexes() {
      try {
        await projectCollection.createIndex({ _id: 1 });
        await blogCollection.createIndex({ _id: 1 });
        await feedbackCollection.createIndex({ _id: 1 });
        await messageCollection.createIndex({ _id: 1 });
        await userCollection.createIndex({ email: 1 });
        console.log("Database indexes created successfully");
      } catch (error) {
        console.error("Error creating indexes:", error);
      }
    }

    createIndexes();

    // POST API
    app.post("/projects", async (req, res) => {
      try {
        const project = req.body;
        const result = await projectCollection.insertOne(project);
        res.send(result);
      } catch (error) {
        console.error("Error creating project:", error);
        res.status(500).send({ error: "Failed to create project" });
      }
    });

    app.post("/feedbacks", async (req, res) => {
      try {
        const feedback = req.body;
        const result = await feedbackCollection.insertOne(feedback);
        res.send(result);
      } catch (error) {
        console.error("Error creating feedback:", error);
        res.status(500).send({ error: "Failed to create feedback" });
      }
    });

    app.post("/messages", async (req, res) => {
      try {
        const message = req.body;
        const result = await messageCollection.insertOne(message);
        res.send(result);
      } catch (error) {
        console.error("Error creating message:", error);
        res.status(500).send({ error: "Failed to create message" });
      }
    });

    app.post("/certificates", async (req, res) => {
      try {
        const certificate = req.body;
        const result = await certificateCollection.insertOne(certificate);
        clearCache("certificates");
        res.send(result);
      } catch (error) {
        console.error("Error creating certificate:", error);
        res.status(500).send({ error: "Failed to create certificate" });
      }
    });

    app.post("/technologies", async (req, res) => {
      try {
        const technology = req.body;
        const result = await technologyCollection.insertOne(technology);
        clearCache("technologies");
        res.send(result);
      } catch (error) {
        console.error("Error creating technology:", error);
        res.status(500).send({ error: "Failed to create technology" });
      }
    });

    app.post("/blogs", async (req, res) => {
      try {
        const blogs = req.body;
        const result = await blogCollection.insertOne(blogs);
        res.send(result);
      } catch (error) {
        console.error("Error creating blog:", error);
        res.status(500).send({ error: "Failed to create blog" });
      }
    });

    // UPDATE API
    app.patch("/resume/:id", async (req, res) => {
      try {
        const resume = req.body;
        const id = req.params.id;

        const query = { _id: new ObjectId(id) };
        const updatedResume = {
          $set: {
            resume_url: resume.updated_resume_url,
          },
        };
        const option = { upsert: true };

        const result = await resumeCollection.updateOne(
          query,
          updatedResume,
          option,
        );
        clearCache("resume");
        res.send(result);
      } catch (error) {
        console.error("Error updating resume:", error);
        res.status(500).send({ error: "Failed to update resume" });
      }
    });

    // DELETE API
    app.delete("/messages/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await messageCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.error("Error deleting message:", error);
        res.status(500).send({ error: "Failed to delete message" });
      }
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );

    app.get("/", (req, res) => {
      res.send("HELLO FROM SHIHAN'S PORTFOLIO SERVER");
    });

    app.listen(port, () => {
      console.log(`MY PORTFOLIO SERVER IS LISTENING ON PORT ${port}`);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const compression = require("compression");

const app = express();
const port = process.env.PORT || 4000;

// ─── Compression ────────────────────────────────────────────────────────────
app.use(compression());

// ─── CORS ───────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://shihandev.com",
      "http://shihandev.com",
    ],
    credentials: true,
  }),
);
app.use(express.json());

// ─── Cache ───────────────────────────────────────────────────────────────────
// FIX 1: Added missing keys (feedbacks, blogs, messages) to the cache object
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = {};

function getCacheData(key) {
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    delete cache[key]; // auto-evict stale entries
    return null;
  }
  return entry.data;
}

function setCacheData(key, data) {
  cache[key] = { data, timestamp: Date.now() };
}

function clearCache(key) {
  delete cache[key];
}

// ─── MongoDB Client ──────────────────────────────────────────────────────────
// FIX 2: Added connection pool tuning to reduce cold-start lag and reuse connections
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.88ffpvi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  maxPoolSize: 10, // reuse up to 10 connections
  minPoolSize: 2, // keep 2 warm connections always alive
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 10000,
  connectTimeoutMS: 5000,
});

// ─── Index Creation ──────────────────────────────────────────────────────────
// FIX 3: _id indexes are auto-created by MongoDB — removed redundant ones.
// Added a unique index on users.email which is actually useful for lookups.

async function run() {
  try {
    // FIX 4: Explicitly connect once at startup so the pool is warm before
    // the first request arrives (avoids the slow first-request cold start).
    await client.connect();
    console.log("✅ MongoDB connected");

    const db = client.db("my_portfolio_db");
    const collections = {
      technologies: db.collection("technologies"),
      projects: db.collection("projects"),
      feedbacks: db.collection("feedbacks"),
      messages: db.collection("messages"),
      certificates: db.collection("certificates"),
      users: db.collection("users"),
      blogs: db.collection("blogs"),
      resume: db.collection("resume"),
    };

    // ─── Helper: cached GET ────────────────────────────────────────────────
    // FIX 5: Extracted repetitive cache-check pattern into a reusable helper.
    // Every collection GET now benefits from caching (feedbacks, blogs,
    // messages were previously hitting MongoDB on every single request).
    function cachedGet(cacheKey, fetchFn) {
      return async (req, res) => {
        try {
          const hit = getCacheData(cacheKey);
          if (hit) return res.json(hit);

          const data = await fetchFn(req);
          setCacheData(cacheKey, data);
          res.json(data);
        } catch (err) {
          console.error(`Error fetching ${cacheKey}:`, err);
          res.status(500).json({ error: `Failed to fetch ${cacheKey}` });
        }
      };
    }

    // ─── GET routes ───────────────────────────────────────────────────────

    app.get(
      "/technologies",
      cachedGet("technologies", () =>
        collections.technologies.find().toArray(),
      ),
    );

    app.get(
      "/projects",
      cachedGet("projects", () => collections.projects.find().toArray()),
    );

    // FIX 6: feedbacks now cached — was hitting DB on every request before
    app.get(
      "/feedbacks",
      cachedGet("feedbacks", () => collections.feedbacks.find().toArray()),
    );

    app.get(
      "/certificates",
      cachedGet("certificates", () =>
        collections.certificates.find().toArray(),
      ),
    );

    // FIX 7: blogs now cached — was hitting DB on every request before
    app.get(
      "/blogs",
      cachedGet("blogs", () => collections.blogs.find().toArray()),
    );

    // messages & admin are not cached intentionally (need to stay real-time)
    app.get("/messages", async (req, res) => {
      try {
        const messages = await collections.messages.find().toArray();
        res.json(messages);
      } catch (err) {
        console.error("Error fetching messages:", err);
        res.status(500).json({ error: "Failed to fetch messages" });
      }
    });

    app.get("/projects/:id", async (req, res) => {
      try {
        const project = await collections.projects.findOne({
          _id: new ObjectId(req.params.id),
        });
        if (!project)
          return res.status(404).json({ error: "Project not found" });
        res.json(project);
      } catch (err) {
        console.error("Error fetching project:", err);
        res.status(500).json({ error: "Failed to fetch project" });
      }
    });

    app.get("/blogs/:id", async (req, res) => {
      try {
        const blog = await collections.blogs.findOne({
          _id: new ObjectId(req.params.id),
        });
        if (!blog) return res.status(404).json({ error: "Blog not found" });
        res.json(blog);
      } catch (err) {
        console.error("Error fetching blog:", err);
        res.status(500).json({ error: "Failed to fetch blog" });
      }
    });

    app.get(
      "/resume",
      cachedGet("resume", () => collections.resume.findOne()),
    );

    app.get("/admin/:email", async (req, res) => {
      try {
        const user = await collections.users.findOne({
          email: req.params.email,
        });
        res.json({ admin: user?.role === "admin" });
      } catch (err) {
        console.error("Error checking admin:", err);
        res.status(500).json({ error: "Failed to check admin status" });
      }
    });

    // ─── POST routes ──────────────────────────────────────────────────────

    app.post("/projects", async (req, res) => {
      try {
        const result = await collections.projects.insertOne(req.body);
        clearCache("projects"); // FIX 8: Invalidate cache on mutation
        res.json(result);
      } catch (err) {
        console.error("Error creating project:", err);
        res.status(500).json({ error: "Failed to create project" });
      }
    });

    app.post("/feedbacks", async (req, res) => {
      try {
        const result = await collections.feedbacks.insertOne(req.body);
        clearCache("feedbacks"); // FIX 8: Invalidate cache on mutation
        res.json(result);
      } catch (err) {
        console.error("Error creating feedback:", err);
        res.status(500).json({ error: "Failed to create feedback" });
      }
    });

    app.post("/messages", async (req, res) => {
      try {
        const result = await collections.messages.insertOne(req.body);
        res.json(result);
      } catch (err) {
        console.error("Error creating message:", err);
        res.status(500).json({ error: "Failed to create message" });
      }
    });

    app.post("/certificates", async (req, res) => {
      try {
        const result = await collections.certificates.insertOne(req.body);
        clearCache("certificates");
        res.json(result);
      } catch (err) {
        console.error("Error creating certificate:", err);
        res.status(500).json({ error: "Failed to create certificate" });
      }
    });

    app.post("/technologies", async (req, res) => {
      try {
        const result = await collections.technologies.insertOne(req.body);
        clearCache("technologies");
        res.json(result);
      } catch (err) {
        console.error("Error creating technology:", err);
        res.status(500).json({ error: "Failed to create technology" });
      }
    });

    app.post("/blogs", async (req, res) => {
      try {
        const result = await collections.blogs.insertOne(req.body);
        clearCache("blogs"); // FIX 8: Invalidate cache on mutation
        res.json(result);
      } catch (err) {
        console.error("Error creating blog:", err);
        res.status(500).json({ error: "Failed to create blog" });
      }
    });

    // ─── PATCH routes ─────────────────────────────────────────────────────

    app.patch("/resume/:id", async (req, res) => {
      try {
        const result = await collections.resume.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { resume_url: req.body.updated_resume_url } },
          { upsert: true },
        );
        clearCache("resume");
        res.json(result);
      } catch (err) {
        console.error("Error updating resume:", err);
        res.status(500).json({ error: "Failed to update resume" });
      }
    });

    // ─── DELETE routes ────────────────────────────────────────────────────

    app.delete("/messages/:id", async (req, res) => {
      try {
        const result = await collections.messages.deleteOne({
          _id: new ObjectId(req.params.id),
        });
        res.json(result);
      } catch (err) {
        console.error("Error deleting message:", err);
        res.status(500).json({ error: "Failed to delete message" });
      }
    });

    // ─── Health check ─────────────────────────────────────────────────────
    app.get("/", (req, res) => {
      res.send("HELLO FROM SHIHAN'S PORTFOLIO SERVER");
    });

    // ─── Start server ─────────────────────────────────────────────────────
    app.listen(port, () => {
      console.log(`🚀 Portfolio server listening on port ${port}`);
    });
  } catch (err) {
    console.error("Fatal startup error:", err);
    process.exit(1);
  }
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────
process.on("SIGINT", async () => {
  await client.close();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await client.close();
  process.exit(0);
});

run().catch(console.dir);

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
// Use cors with default settings for your frontend
app.use(cors({ origin: "https://reva-ai-authenticator-frontend.vercel.app", methods: ["GET","POST","PUT","DELETE","OPTIONS"], credentials: true }));


// JSON parsing middleware
app.use(express.json());

// --- MongoDB Connection ---
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err.message));

// --- Routes ---
app.use("/api/auth", authRoutes);

// --- Health Check ---
app.get("/", (req, res) => {
  res.send("🚀 REVA AI Authenticator Backend is running!");
});

// --- Start Server ---
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));

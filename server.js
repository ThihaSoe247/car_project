const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
require("dotenv").config();

// Import routes
const carRoutes = require("./routes/car-routes");
const authRoutes = require("./routes/auth-routes");
const userRoutes = require("./routes/user-routes");

// Import middleware
const errorHandler = require("./middleware/errorHandler");
const {
  authLimiter,
  apiLimiter,
  corsOptions,
  securityConfig,
} = require("./middleware/security");

const app = express();

// ✅ Trust proxy (important for Render, Cloudflare, Nginx, etc.)
app.set("trust proxy", 1);

// Environment variables with defaults
const PORT = process.env.PORT || 4000;
const MONGO_URL = process.env.MONGO_URL;
const NODE_ENV = process.env.NODE_ENV || "development";

// ------------------------------
// 🔒 Security & Middleware Setup
// ------------------------------
app.use(securityConfig);
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Logging middleware
if (NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  // Production logging - log only errors and important info
  app.use(
    morgan("combined", {
      skip: (req, res) => res.statusCode < 400,
      stream: {
        write: (message) => {
          console.log(message.trim());
        },
      },
    })
  );
}

// ------------------------------
// 🚦 Rate Limiting
// ------------------------------
app.use("/api/auth", authLimiter);
app.use("/api", apiLimiter);

// ------------------------------
// 🩺 Health Check Endpoint
// ------------------------------
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    uptime: process.uptime(),
  });
});

// ------------------------------
// 🌍 Root Endpoint
// ------------------------------
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Car Showroom API",
    version: "1.0.0",
    environment: NODE_ENV,
    documentation: "/api/docs",
  });
});

// ------------------------------
// 🛣️ API Routes
// ------------------------------
app.use("/api/auth", authRoutes);
app.use("/api", carRoutes);
app.use("/api", userRoutes); // User management routes (Moderators only)

// ------------------------------
// ❌ 404 Handler
// ------------------------------
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
  });
});

// ------------------------------
// ⚠️ Error Handling Middleware
// ------------------------------
app.use(errorHandler);

// ------------------------------
// 🚀 Start Server
// ------------------------------
const startServer = async () => {
  try {
    if (!MONGO_URL) {
      throw new Error("MONGO_URL environment variable is required");
    }

    // Connect to MongoDB
    await mongoose.connect(MONGO_URL, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log("✅ MongoDB connected successfully");

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`🌍 Environment: ${NODE_ENV}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
};

// ------------------------------
// 🧹 Graceful Shutdown
// ------------------------------
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  mongoose.connection.close(() => {
    console.log("MongoDB connection closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  mongoose.connection.close(() => {
    console.log("MongoDB connection closed");
    process.exit(0);
  });
});

// ------------------------------
// 🛑 Error Handling for Crashes
// ------------------------------
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Promise Rejection:", err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

startServer();

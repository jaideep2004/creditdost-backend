const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const dotenv = require("dotenv");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

// Load environment variables
dotenv.config();

// Create Express server
const app = express();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Connect to database
const connectDB = require("./config/db");
connectDB();

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});

app.use(limiter);

// Enable CORS with proper configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

// Set security headers
app.use(helmet());

// Logging
app.use(morgan("combined"));

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Database connection
mongoose
  .connect(
    process.env.MONGODB_URI ||
      "mongodb+srv://jai2004bgmi_db_user:bgmi2004@creditdost.yaxbkns.mongodb.net/?appName=creditdost",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Import routes
const authRoutes = require("./routes/auth");
const packageRoutes = require("./routes/packages");
const paymentRoutes = require("./routes/payments");
const kycRoutes = require("./routes/kyc");
const franchiseRoutes = require("./routes/franchises");
const creditRoutes = require("./routes/credit");
const adminRoutes = require("./routes/admin");
const dashboardRoutes = require("./routes/dashboard");

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/packages", packageRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/franchises", franchiseRoutes);
app.use("/api/credit", creditRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "Server is running" });
});

// Error handling middleware
const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
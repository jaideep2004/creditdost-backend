const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const path = require("path");
const { initializeReferralSettings } = require("./utils/referralUtils");
const googleSheetsService = require("./utils/googleSheetsService");
const GoogleSheet = require("./models/GoogleSheet");

// Load environment variables
dotenv.config();

// Migration function to ensure all required tabs are present in Google Sheets settings
const runGoogleSheetsMigration = async () => {
  try {
    console.log("Running Google Sheets migration...");
    
    // Find all Google Sheets settings
    const settingsList = await GoogleSheet.find({});
    
    // Required tabs
    const requiredTabs = [
      'creditScore',
      'applyForLoan',
      'creditScoreRepair',
      'contactUs',
      'newRegistration',
      'franchiseOpportunity'
    ];
    
    for (const settings of settingsList) {
      let updated = false;
      
      // Ensure all required tabs exist
      for (const tab of requiredTabs) {
        if (!settings.tabs.has(tab)) {
          settings.tabs.set(tab, { enabled: true, lastSync: null });
          updated = true;
          console.log(`Added ${tab} tab to settings`);
        }
      }
      
      // Save if any changes were made
      if (updated) {
        await settings.save();
        console.log("Updated Google Sheets settings with missing tabs");
      }
    }
    
    console.log("Google Sheets migration completed");
  } catch (error) {
    console.error("Google Sheets migration failed:", error.message);
  }
};

// Connect to database
mongoose
  .connect(
    process.env.MONGODB_URI || "mongodb://localhost:27017/franchise_management",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(async () => {
    console.log("MongoDB connected");
    
    // Run migration to ensure all required tabs are present
    await runGoogleSheetsMigration();
    
    // Start auto-sync after database connection is established
    setTimeout(startAutoSync, 5000);
  })
  .catch((err) => console.log("MongoDB connection error:", err));

// Initialize referral settings
initializeReferralSettings();

const app = express();

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Serve static files from the reports directory
app.use("/reports", express.static(path.join(__dirname, "reports")));

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/franchises", require("./routes/franchises"));
app.use("/api/kyc", require("./routes/kyc"));
app.use("/api/packages", require("./routes/packages"));
app.use("/api/customer-packages", require("./routes/customerPackages"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/credit", require("./routes/credit"));
app.use("/api/leads", require("./routes/leads"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/business", require("./routes/business"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/blogs", require("./routes/blogs"));
app.use("/api/relationship-managers", require("./routes/relationshipManagers"));
app.use("/api/emi", require("./routes/emi"));
app.use("/api/google-sheets", require("./routes/googleSheets"));
app.use("/api/forms", require("./routes/forms"));
app.use("/api/digital-agreements", require("./routes/digitalAgreements"));

// Error handling middleware
app.use(require("./middleware/errorHandler"));

const PORT = process.env.PORT || 5000;

// Start automatic sync if enabled
const startAutoSync = async () => {
  try {
    console.log("Starting auto-sync check");
    const settings = await require("./models/GoogleSheet").findOne({
      isActive: true,
    });
    console.log("Google Sheets settings for auto-sync:", settings);
    if (settings && settings.syncSettings && settings.syncSettings.autoSync) {
      const interval = settings.syncSettings.syncInterval || 300; // Default to 5 minutes
      console.log(`Auto-sync enabled with ${interval} second interval`);

      // Run sync immediately
      console.log("Running initial Google Sheets sync");
      const initialized = await googleSheetsService.initialize();
      if (initialized) {
        await googleSheetsService.syncAllData();
        console.log("Initial Google Sheets sync completed");
      } else {
        console.log("Failed to initialize Google Sheets service for initial sync");
      }

      // Set up periodic sync
      setInterval(async () => {
        try {
          console.log("Running periodic Google Sheets sync");
          const initialized = await googleSheetsService.initialize();
          if (initialized) {
            await googleSheetsService.syncAllData();
            console.log("Periodic Google Sheets sync completed");
          } else {
            console.log("Failed to initialize Google Sheets service for periodic sync");
          }
        } catch (error) {
          console.error("Periodic Google Sheets sync failed:", error.message);
        }
      }, interval * 1000);

      console.log(
        `Google Sheets auto-sync enabled with ${interval} second interval`
      );
    } else {
      console.log("Auto-sync not enabled or settings not found");
    }
  } catch (error) {
    console.error("Failed to start auto-sync:", error.message);
  }
};

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

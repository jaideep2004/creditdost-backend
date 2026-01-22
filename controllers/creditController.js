const axios = require("axios");
const CreditReport = require("../models/CreditReport");
const Setting = require("../models/Setting");
const Franchise = require("../models/Franchise");
const Joi = require("joi");
const fs = require("fs");
const path = require("path");
const { sendCreditReportEmail } = require("../utils/emailService");
const googleSheetsService = require("../utils/googleSheetsService");

// Validation schema for credit check
const creditCheckSchema = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Customer name must be at least 2 characters long',
    'string.max': 'Customer name must be less than 100 characters long',
    'any.required': 'Customer name is required'
  }),
  mobile: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .required()
    .messages({
      'string.pattern.base': 'Mobile number must be exactly 10 digits',
      'any.required': 'Mobile number is required'
    }),
  email: Joi.string()
    .email()
    .messages({
      'string.email': 'Please provide a valid email address'
    }),
  personId: Joi.string().optional(),
  bureau: Joi.string()
    .valid("equifax", "experian", "cibil", "crif")
    .default("cibil")
    .messages({
      'any.only': 'Please select a valid credit bureau (equifax, experian, cibil, crif)'
    }),
  pan: Joi.string().optional(),
  aadhaar: Joi.string().optional(),
  dob: Joi.date().optional(),
  gender: Joi.string().optional(),
  occupation: Joi.string().optional(),
  city: Joi.string().optional(),
  state: Joi.string().optional(),
  language: Joi.string().optional(),
});

// Helper function to get Surepass API key value directly
const getSurepassApiKeyValue = async () => {
  try {
    const setting = await Setting.findOne({ key: "surepass_api_key" });
    return setting ? setting.value : process.env.SUREPASS_API_KEY;
  } catch (error) {
    console.error("Error fetching Surepass API key:", error);
    return null;
  }
};

// Get Surepass API key (admin only)
const getSurepassApiKey = async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: "surepass_api_key" });

    if (!setting) {
      return res
        .status(404)
        .json({ message: "Surepass API key not configured" });
    }

    // Return only a masked version of the API key for security
    const maskedKey =
      setting.value.substring(0, 4) +
      "..." +
      setting.value.substring(setting.value.length - 4);

    res.json({
      message: "Surepass API key retrieved successfully",
      apiKey: maskedKey,
      hasApiKey: true,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Map bureau names to Surepass API endpoints and request data format
const getBureauConfig = (bureau) => {
  const configs = {
    cibil: {
      endpoint:
        "https://kyc-api.surepass.io/api/v1/credit-report-cibil/fetch-report-pdf",
      formatData: (data) => ({
        mobile: data.mobile,
        pan: data.pan,
        name: data.name,
        gender: data.gender ? data.gender.toLowerCase() : "male",
        consent: "Y",
      }),
    },
    crif: {
      endpoint:
        "https://kyc-api.surepass.app/api/v1/credit-report-crif/fetch-report-pdf",
      formatData: (data) => {
        // Split name into first and last name
        const nameParts = data.name.split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || " ";

        return {
          first_name: firstName,
          last_name: lastName,
          mobile: data.mobile,
          pan: data.pan,
          consent: "Y",
          raw: false,
        };
      },
    },
    experian: {
      endpoint:
        "https://kyc-api.surepass.io/api/v1/credit-report-experian/fetch-report-pdf",
      formatData: (data) => ({
        name: data.name,
        consent: "Y",
        mobile: data.mobile,
        pan: data.pan,
      }),
    },
    equifax: {
      endpoint: "https://kyc-api.surepass.io/api/v1/crs/fetch-pdf-report",
      formatData: (data) => ({
        name: data.name,
        mobile: data.mobile,
        person_id: data.personId,
        pan: data.pan,
        aadhaar: data.aadhaar,
        dob: data.dob,
        gender: data.gender,
      }),
    },
  };
  return configs[bureau] || configs.cibil;
};

// Check credit score for specific bureau
const checkCreditScore = async (req, res) => {
  try {
    // Validate request body
    const { error } = creditCheckSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      return res.status(400).json({
        message: "Validation error",
        details: errorMessages,
      });
    }

    const {
      name,
      mobile,
      personId,
      bureau = "cibil",
      pan,
      aadhaar,
      dob,
      gender,
    } = req.body;

    // Get franchise details to check credits
    const franchise = await Franchise.findById(req.user.franchiseId);
    if (!franchise) {
      return res.status(404).json({ message: "Franchise not found" });
    }

    // Check if franchise has enough credits
    if (franchise.credits < 1) {
      return res
        .status(400)
        .json({ message: "Insufficient credits to generate credit report" });
    }

    // Get Surepass API key
    const apiKey = await getSurepassApiKeyValue();
    if (!apiKey) {
      return res
        .status(500)
        .json({ message: "Surepass API key not configured" });
    }

    // Get the appropriate endpoint and data formatter for the bureau
    const bureauConfig = getBureauConfig(bureau);

    // Prepare request data based on bureau requirements
    const requestData = bureauConfig.formatData({
      name,
      mobile,
      personId,
      pan,
      aadhaar,
      dob,
      gender,
    });

    // Make request to Surepass API with timeout and better error handling
    let response;
    try {
      response = await axios.post(bureauConfig.endpoint, requestData, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 30000, // 30 second timeout
      });
    } catch (apiError) {
      console.error("Surepass API error:", apiError.message);

      // Handle timeout specifically
      if (apiError.code === "ETIMEDOUT" || apiError.code === "ECONNABORTED") {
        return res.status(504).json({
          message:
            "Request timeout when connecting to credit bureau. Please try again later.",
          error: "TIMEOUT_ERROR",
        });
      }

      // Handle network errors
      if (apiError.isAxiosError && !apiError.response) {
        return res.status(502).json({
          message:
            "Network error when connecting to credit bureau. Please check your internet connection and try again.",
          error: "NETWORK_ERROR",
        });
      }

      // Forward the error from Surepass API if available
      if (apiError.response) {
        return res.status(apiError.response.status).json({
          message: "Credit check failed",
          error: apiError.response.data || apiError.message,
        });
      }

      // Generic error
      return res.status(500).json({
        message: "An error occurred while checking credit score",
        error: apiError.message,
      });
    }

    // Extract score from response based on bureau
    let score = null;
    if (response.data.data && response.data.data.score) {
      score = response.data.data.score;
    } else if (response.data.data && response.data.data.credit_score) {
      score = response.data.data.credit_score;
    }

    // Extract report URL from response
    let reportUrl = null;
    if (response.data.data) {
      // Check for various possible report URL fields
      reportUrl =
        response.data.data.report_url ||
        response.data.data.pdf_url ||
        response.data.data.credit_report_link ||
        response.data.data.report_link ||
        null;
    }

    // Save credit report
    const creditReport = new CreditReport({
      userId: req.user.id,
      franchiseId: req.user.franchiseId,
      name,
      mobile,
      pan,
      aadhaar,
      dob,
      gender,
      score,
      bureau,
      reportData: response.data,
      reportUrl: reportUrl,
    });

    await creditReport.save();

    // Sync with Google Sheets
    try {
      await googleSheetsService.initialize();
      await googleSheetsService.syncCreditScoreData();
    } catch (syncError) {
      console.error('Failed to sync credit score data with Google Sheets:', syncError);
    }

    // Deduct credit from franchise
    franchise.credits -= 1;
    await franchise.save();

    // If we have a report URL, download and save the PDF locally
    if (reportUrl) {
      try {
        // Create reports directory if it doesn't exist
        const reportsDir = path.join(__dirname, "../reports");
        if (!fs.existsSync(reportsDir)) {
          fs.mkdirSync(reportsDir, { recursive: true });
        }

        // Generate a unique filename
        const timestamp = Date.now();
        const filename = `credit_report_${creditReport._id}_${timestamp}.pdf`;
        const localPath = path.join(reportsDir, filename);

        // Download the PDF with timeout
        const pdfResponse = await axios({
          method: "GET",
          url: reportUrl,
          responseType: "stream",
          timeout: 30000, // 30 second timeout
        });

        // Save the PDF to local storage
        const writer = fs.createWriteStream(localPath);
        pdfResponse.data.pipe(writer);

        // Wait for the download to complete
        await new Promise((resolve, reject) => {
          writer.on("finish", resolve);
          writer.on("error", reject);
        });

        // Update the credit report with the local path
        creditReport.localPath = `/reports/${filename}`;
        await creditReport.save();
      } catch (downloadError) {
        console.error("Error downloading PDF:", downloadError);
        // We don't fail the entire request if PDF download fails
      }
    }

    res.json({
      message: `Credit report retrieved successfully from ${bureau.toUpperCase()}`,
      creditReport: {
        id: creditReport._id,
        name: creditReport.name,
        mobile: creditReport.mobile,
        pan: creditReport.pan,
        aadhaar: creditReport.aadhaar,
        score: creditReport.score,
        bureau: creditReport.bureau,
        reportUrl: creditReport.reportUrl,
        localPath: creditReport.localPath,
        createdAt: creditReport.createdAt,
      },
      remainingCredits: franchise.credits,
    });
  } catch (error) {
    console.error("Credit check error:", error);
    res.status(500).json({ 
      message: "Server error", 
      error: error.message,
      // Don't expose sensitive error details in production
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
};

// Check credit score for specific bureau (public version for Experian only)
const checkCreditScorePublic = async (req, res) => {
  try {
    // Validate request body
    const { error } = creditCheckSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      return res.status(400).json({
        message: "Validation error",
        details: errorMessages,
      });
    }

    const {
      name,
      mobile,
      email, // Add email
      personId,
      bureau = "experian",
      pan,
      aadhaar,
      dob,
      gender,
      occupation,
      city,
      state,
      language,
    } = req.body;

    // Only allow Experian for public access
    if (bureau !== "experian") {
      return res.status(400).json({ 
        message: "Only Experian credit reports are available for public access" 
      });
    }

    // Get Surepass API key
    const apiKey = await getSurepassApiKeyValue();
    if (!apiKey) {
      return res
        .status(500)
        .json({ message: "Surepass API key not configured" });
    }

    // Get the appropriate endpoint and data formatter for the bureau
    const bureauConfig = getBureauConfig(bureau);

    // Prepare request data based on bureau requirements
    const requestData = bureauConfig.formatData({
      name,
      mobile,
      personId,
      pan,
      aadhaar,
      dob,
      gender,
    });

    // Make request to Surepass API with timeout and better error handling
    let response;
    try {
      response = await axios.post(bureauConfig.endpoint, requestData, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 30000, // 30 second timeout
      });
    } catch (apiError) {
      console.error("Surepass API error:", apiError.message);

      // Handle timeout specifically
      if (apiError.code === "ETIMEDOUT" || apiError.code === "ECONNABORTED") {
        return res.status(504).json({
          message:
            "Request timeout when connecting to credit bureau. Please try again later.",
          error: "TIMEOUT_ERROR",
        });
      }

      // Handle network errors
      if (apiError.isAxiosError && !apiError.response) {
        return res.status(502).json({
          message:
            "Network error when connecting to credit bureau. Please check your internet connection and try again.",
          error: "NETWORK_ERROR",
        });
      }

      // Forward the error from Surepass API if available
      if (apiError.response) {
        return res.status(apiError.response.status).json({
          message: "Credit check failed",
          error: apiError.response.data || apiError.message,
        });
      }

      // Generic error
      return res.status(500).json({
        message: "An error occurred while checking credit score",
        error: apiError.message,
      });
    }

    // Extract score from response based on bureau
    let score = null;
    if (response.data.data && response.data.data.score) {
      score = response.data.data.score;
    } else if (response.data.data && response.data.data.credit_score) {
      score = response.data.data.credit_score;
    }

    // Extract report URL from response
    let reportUrl = null;
    if (response.data.data) {
      // Check for various possible report URL fields
      reportUrl =
        response.data.data.report_url ||
        response.data.data.pdf_url ||
        response.data.data.credit_report_link ||
        response.data.data.report_link ||
        null;
    }

    // Save credit report without user/franchise association for public reports
    const creditReport = new CreditReport({
      name,
      mobile,
      email, // Add email
      pan,
      aadhaar,
      dob,
      gender,
      score,
      bureau,
      reportData: response.data,
      reportUrl: reportUrl,
      isPublic: true, // Mark as public report
      occupation,
      city,
      state,
      language,
    });

    await creditReport.save();

    // Sync with Google Sheets for public reports
    try {
      await googleSheetsService.initialize();
      await googleSheetsService.syncPublicCreditScoreData();
    } catch (syncError) {
      console.error('Failed to sync public credit score data with Google Sheets:', syncError);
    }

    // Send email to user and admin
    try {
      // Send email to user
      await sendCreditReportEmail(
        { email: email, name: name }, // Use the email from request
        creditReport,
        reportUrl
      );
      
      // Send email to admin
      await sendCreditReportEmail(
        { email: process.env.ADMIN_EMAIL || process.env.EMAIL_USER, name: "Admin" },
        creditReport,
        reportUrl
      );
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      // Don't fail the request if email sending fails
    }

    res.json({
      message: `Credit report retrieved successfully from ${bureau.toUpperCase()}`,
      creditReport: {
        id: creditReport._id,
        name: creditReport.name,
        mobile: creditReport.mobile,
        pan: creditReport.pan,
        aadhaar: creditReport.aadhaar,
        score: creditReport.score,
        bureau: creditReport.bureau,
        reportUrl: creditReport.reportUrl,
        localPath: creditReport.localPath,
        createdAt: creditReport.createdAt,
      },
    });
  } catch (error) {
    console.error("Credit check error:", error);
    res.status(500).json({ 
      message: "Server error", 
      error: error.message,
      // Don't expose sensitive error details in production
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
};

// Get credit reports for franchise
const getCreditReports = async (req, res) => {
  try {
    const reports = await CreditReport.find({
      franchiseId: req.user.franchiseId,
    }).sort({ createdAt: -1 });

    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all credit reports (admin only)
const getAllCreditReports = async (req, res) => {
  try {
    const reports = await CreditReport.find()
      .populate("userId", "name email")
      .populate("franchiseId", "businessName")
      .sort({ createdAt: -1 });

    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get credit report by ID
const getCreditReportById = async (req, res) => {
  try {
    const report = await CreditReport.findById(req.params.id)
      .populate("userId", "name email")
      .populate("franchiseId", "businessName");

    if (!report) {
      return res.status(404).json({ message: "Credit report not found" });
    }

    // Check permissions
    if (
      req.user.role === "franchise_user" &&
      report.franchiseId.toString() !== req.user.franchiseId.toString()
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(report);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update Surepass API key (admin only)
const updateSurepassApiKey = async (req, res) => {
  try {
    const { apiKey } = req.body;

    let setting = await Setting.findOne({ key: "surepass_api_key" });

    if (setting) {
      setting.value = apiKey;
      await setting.save();
    } else {
      setting = new Setting({
        key: "surepass_api_key",
        value: apiKey,
        description: "Surepass API Key for credit checks",
      });
      await setting.save();
    }

    res.json({
      message: "Surepass API key updated successfully",
      setting,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  checkCreditScore,
  checkCreditScorePublic, // Add the new public function
  getCreditReports,
  getAllCreditReports,
  getCreditReportById,
  getSurepassApiKey,
  updateSurepassApiKey,
  getSurepassApiKeyValue, // Export the helper function
};

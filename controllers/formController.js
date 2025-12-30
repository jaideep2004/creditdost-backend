const Joi = require("joi");
const googleSheetsService = require("../utils/googleSheetsService");
const CreditRepair = require("../models/CreditRepair");
const ContactForm = require("../models/ContactForm");
const FranchiseOpportunity = require("../models/FranchiseOpportunity");
const BusinessForm = require("../models/BusinessForm");
const User = require("../models/User");
const {
  sendContactFormEmail,
  sendFranchiseOpportunityEmail,
  sendBusinessFormSubmissionEmail,
} = require("../utils/emailService");

// Validation schema for credit repair form
const creditRepairSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  mobileNumber: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .required(),
  city: Joi.string().optional(),
  state: Joi.string().required(),
  problemType: Joi.string().required(),
  creditScore: Joi.string().optional(),
  message: Joi.string().optional(),
});

// Validation schema for contact form
const contactFormSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  mobileNumber: Joi.string().pattern(/^[0-9]{10}$/).optional(),
  subject: Joi.string().optional(),
  message: Joi.string().required(),
});

// Validation schema for franchise opportunity form
const franchiseOpportunitySchema = Joi.object({
  fullName: Joi.string().min(2).max(100).required(),
  mobileNumber: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .required(),
  email: Joi.string().email().required(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  profession: Joi.string().required(),
  message: Joi.string().optional(),
  consent: Joi.boolean().required(),
});

// Validation schema for business form (apply for loan)
const businessFormSchema = Joi.object({
  customerName: Joi.string().min(2).max(100).required(),
  customerEmail: Joi.string().email().required(),
  customerPhone: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .required(),
  panNumber: Joi.string()
    .pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
    .required(),
  aadharNumber: Joi.string()
    .pattern(/^[0-9]{12}$/)
    .required(),
  city: Joi.string().optional(),
  state: Joi.string().required(), 
  pincode: Joi.string()
    .pattern(/^[0-9]{6}$/)
    .required(),
  occupation: Joi.string().required(),
  monthlyIncome: Joi.number().positive().required(),
  fullAddress: Joi.string().required(),
  language: Joi.string().optional(),
  selectedPackage: Joi.any().optional(),
}).options({ stripUnknown: true });

// Submit credit repair form
const submitCreditRepairForm = async (req, res) => {
  try {
    console.log("Received credit repair form data:", req.body);
    // Validate request body
    const { error } = creditRepairSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      console.log("Validation errors:", error.details);
      const errorMessages = error.details.map((detail) => detail.message);
      return res.status(400).json({
        message: "Validation error",
        details: errorMessages,
      });
    }

    const {
      fullName,
      email,
      mobileNumber,
      city,
      state,
      problemType,
      creditScore,
      message,
    } = req.body;

    // Save to database
    const creditRepair = new CreditRepair({
      fullName,
      email,
      mobileNumber,
      city,
      state,
      problemType,
      creditScore,
      message,
    });
    await creditRepair.save();

    // Sync with Google Sheets
    try {
      await googleSheetsService.initialize();
      await googleSheetsService.syncCreditRepairData();
    } catch (syncError) {
      console.error(
        "Failed to sync credit repair data with Google Sheets:",
        syncError
      );
      // Don't fail the request if Google Sheets sync fails
    }

    res.json({
      message: "Credit repair form submitted successfully",
    });
  } catch (error) {
    console.error("Credit repair form submission error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// Submit contact form
const submitContactForm = async (req, res) => {
  try {
    // Validate request body
    const { error } = contactFormSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      const errorMessages = error.details.map((detail) => detail.message);
      return res.status(400).json({
        message: "Validation error",
        details: errorMessages,
      });
    }

    const { name, email, mobileNumber, subject, message } = req.body;

    // Save to database
    const contactForm = new ContactForm({
      name,
      email,
      mobileNumber,
      subject,
      message,
    });
    await contactForm.save();

    // Send email to admin
    try {
      await sendContactFormEmail(contactForm);
    } catch (emailError) {
      console.error("Failed to send contact form email to admin:", emailError);
      // Don't fail the request if email sending fails
    }

    // Sync with Google Sheets
    try {
      await googleSheetsService.initialize();
      await googleSheetsService.syncContactFormData();
    } catch (syncError) {
      console.error(
        "Failed to sync contact form data with Google Sheets:",
        syncError
      );
      // Don't fail the request if Google Sheets sync fails
    }

    res.json({
      message: "Contact form submitted successfully",
    });
  } catch (error) {
    console.error("Contact form submission error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// Submit franchise opportunity form
const submitFranchiseOpportunityForm = async (req, res) => {
  try {
    // Validate request body
    const { error } = franchiseOpportunitySchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      const errorMessages = error.details.map((detail) => detail.message);
      return res.status(400).json({
        message: "Validation error",
        details: errorMessages,
      });
    }

    const {
      fullName,
      mobileNumber,
      email,
      city,
      state,
      profession,
      message,
      consent,
    } = req.body;

    // Save to database
    const franchiseOpportunity = new FranchiseOpportunity({
      fullName,
      mobileNumber,
      email,
      city,
      state,
      profession,
      message,
      consent,
    });
    await franchiseOpportunity.save();

    // Send email to admin
    try {
      await sendFranchiseOpportunityEmail(franchiseOpportunity);
    } catch (emailError) {
      console.error(
        "Failed to send franchise opportunity email to admin:",
        emailError
      );
      // Don't fail the request if email sending fails
    }

    // Sync with Google Sheets
    try {
      await googleSheetsService.initialize();
      await googleSheetsService.syncFranchiseOpportunityData();
    } catch (syncError) {
      console.error(
        "Failed to sync franchise opportunity data with Google Sheets:",
        syncError
      );
      // Don't fail the request if Google Sheets sync fails
    }

    res.json({
      message: "Franchise opportunity form submitted successfully",
    });
  } catch (error) {
    console.error("Franchise opportunity form submission error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// Submit business form (apply for loan)
const submitBusinessForm = async (req, res) => {
  try {
    // Validate request body
    const { error } = businessFormSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      const errorMessages = error.details.map((detail) => detail.message);
      return res.status(400).json({
        message: "Validation error",
        details: errorMessages,
      });
    }

    const {
      customerName,
      customerEmail,
      customerPhone,
      panNumber,
      aadharNumber,
      city,
      state,
      pincode,
      occupation,
      monthlyIncome,
      fullAddress,
      language,
      selectedPackage,
    } = req.body;

    // Create business form entry
    const businessForm = new BusinessForm({
      customerName,
      customerEmail: customerEmail.toLowerCase(),
      customerPhone,
      panNumber: panNumber ? panNumber.toUpperCase() : null,
      aadharNumber: aadharNumber || null,
      city,
      state,
      pincode,
      occupation,
      monthlyIncome,
      fullAddress,
      // Set default values for fields not provided in public form
      language: language || "en",
      selectedPackage: selectedPackage || undefined,
    });

    await businessForm.save();

    // Send email to admin
    try {
      // Get admin users
      const adminUsers = await User.find({ role: "admin" });

      // Send email to all admins
      for (const admin of adminUsers) {
        if (admin && admin.email) {
          await sendBusinessFormSubmissionEmail(admin, businessForm, null);
        }
      }
    } catch (emailError) {
      console.error(
        "Failed to send business form submission email:",
        emailError
      );
      // Don't fail the request if email sending fails
    }

    // Sync with Google Sheets
    try {
      await googleSheetsService.initialize();
      await googleSheetsService.syncBusinessFormData();
    } catch (syncError) {
      console.error(
        "Failed to sync business form data with Google Sheets:",
        syncError
      );
      // Don't fail the request if Google Sheets sync fails
    }

    res.json({
      message: "Business form submitted successfully",
    });
  } catch (error) {
    console.error("Business form submission error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

module.exports = {
  submitCreditRepairForm,
  submitContactForm,
  submitFranchiseOpportunityForm,
  submitBusinessForm,
};

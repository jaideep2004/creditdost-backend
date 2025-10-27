const axios = require('axios');
const CreditReport = require('../models/CreditReport');
const Setting = require('../models/Setting');
const Joi = require('joi');

// Validation schema for credit check
const creditCheckSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  mobile: Joi.string().pattern(/^[0-9]{10}$/).required(),
  personId: Joi.string().optional(),
});

// Get Surepass API key from settings
const getSurepassApiKey = async () => {
  const setting = await Setting.findOne({ key: 'surepass_api_key' });
  return setting ? setting.value : process.env.SUREPASS_API_KEY;
};

// Check credit score
const checkCreditScore = async (req, res) => {
  try {
    // Validate request body
    const { error } = creditCheckSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        message: 'Validation error',
        details: error.details[0].message
      });
    }
    
    const { name, mobile, personId } = req.body;
    
    // Get Surepass API key
    const apiKey = await getSurepassApiKey();
    if (!apiKey) {
      return res.status(500).json({ message: 'Surepass API key not configured' });
    }
    
    // Make request to Surepass API
    const response = await axios.post(
      'https://kyc-api.surepass.io/api/v1/crs/credit-score',
      {
        name,
        mobile,
        person_id: personId,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    // Save credit report
    const creditReport = new CreditReport({
      userId: req.user.id,
      franchiseId: req.user.role === 'franchise_user' ? req.user.franchiseId : null,
      name,
      mobile,
      score: response.data.data.score,
      reportData: response.data,
    });
    
    await creditReport.save();
    
    res.json({
      message: 'Credit score retrieved successfully',
      creditReport: {
        id: creditReport._id,
        name: creditReport.name,
        mobile: creditReport.mobile,
        score: creditReport.score,
        createdAt: creditReport.createdAt,
      },
    });
  } catch (error) {
    if (error.response) {
      // Surepass API error
      res.status(error.response.status).json({
        message: 'Credit check failed',
        error: error.response.data,
      });
    } else {
      // Other error
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
};

// Get credit reports for franchise
const getCreditReports = async (req, res) => {
  try {
    const reports = await CreditReport.find({ franchiseId: req.user.franchiseId })
      .sort({ createdAt: -1 });
    
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all credit reports (admin only)
const getAllCreditReports = async (req, res) => {
  try {
    const reports = await CreditReport.find()
      .populate('userId', 'name email')
      .populate('franchiseId', 'businessName')
      .sort({ createdAt: -1 });
    
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get credit report by ID
const getCreditReportById = async (req, res) => {
  try {
    const report = await CreditReport.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('franchiseId', 'businessName');
    
    if (!report) {
      return res.status(404).json({ message: 'Credit report not found' });
    }
    
    // Check permissions
    if (req.user.role === 'franchise_user' && report.franchiseId.toString() !== req.user.franchiseId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update Surepass API key (admin only)
const updateSurepassApiKey = async (req, res) => {
  try {
    const { apiKey } = req.body;
    
    let setting = await Setting.findOne({ key: 'surepass_api_key' });
    
    if (setting) {
      setting.value = apiKey;
      await setting.save();
    } else {
      setting = new Setting({
        key: 'surepass_api_key',
        value: apiKey,
        description: 'Surepass API Key for credit checks',
      });
      await setting.save();
    }
    
    res.json({
      message: 'Surepass API key updated successfully',
      setting,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  checkCreditScore,
  getCreditReports,
  getAllCreditReports,
  getCreditReportById,
  updateSurepassApiKey,
};
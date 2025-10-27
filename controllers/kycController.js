const KycRequest = require('../models/KycRequest');
const Franchise = require('../models/Franchise');
const User = require('../models/User');
const Joi = require('joi');
const { sendKycApprovalEmail, sendKycRejectionEmail } = require('../utils/emailService');

// Validation schema for KYC submission
const kycSchema = Joi.object({
  aadhaarNumber: Joi.string().pattern(/^[0-9]{12}$/).required(),
  panNumber: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).required(),
});

// Submit KYC documents
const submitKyc = async (req, res) => {
  try {
    // Validate request body
    const { error } = kycSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        message: 'Validation error',
        details: error.details[0].message
      });
    }
    
    // Check if franchise exists
    const franchise = await Franchise.findOne({ userId: req.user.id });
    if (!franchise) {
      return res.status(404).json({ message: 'Franchise not found' });
    }
    
    // Check if KYC already submitted
    const existingKyc = await KycRequest.findOne({ franchiseId: franchise._id });
    if (existingKyc && existingKyc.status !== 'rejected') {
      return res.status(400).json({ message: 'KYC already submitted' });
    }
    
    // Check if files were uploaded
    if (!req.files) {
      return res.status(400).json({ message: 'No files uploaded' });
    }
    
    // Construct file URLs
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const fileUrls = {};
    
    if (req.files['aadhaarFrontDocument'] && req.files['aadhaarFrontDocument'][0]) {
      fileUrls.aadhaarFrontDocument = `${baseUrl}/uploads/${req.files['aadhaarFrontDocument'][0].filename}`;
    }
    
    if (req.files['aadhaarBackDocument'] && req.files['aadhaarBackDocument'][0]) {
      fileUrls.aadhaarBackDocument = `${baseUrl}/uploads/${req.files['aadhaarBackDocument'][0].filename}`;
    }
    
    if (req.files['panDocument'] && req.files['panDocument'][0]) {
      fileUrls.panDocument = `${baseUrl}/uploads/${req.files['panDocument'][0].filename}`;
    }
    
    if (req.files['businessRegistrationDocument'] && req.files['businessRegistrationDocument'][0]) {
      fileUrls.businessRegistrationDocument = `${baseUrl}/uploads/${req.files['businessRegistrationDocument'][0].filename}`;
    }
    
    // Create/update KYC request
    const kycData = {
      userId: req.user.id,
      franchiseId: franchise._id,
      aadhaarNumber: req.body.aadhaarNumber,
      panNumber: req.body.panNumber,
      ...fileUrls
    };
    
    let kycRequest;
    if (existingKyc) {
      // Update existing rejected KYC
      kycRequest = await KycRequest.findByIdAndUpdate(
        existingKyc._id,
        kycData,
        { new: true, runValidators: true }
      );
    } else {
      // Create new KYC request
      kycRequest = new KycRequest(kycData);
      await kycRequest.save();
    }
    
    // Update franchise status
    franchise.kycStatus = 'submitted';
    franchise.kycSubmittedAt = new Date();
    await franchise.save();
    
    res.status(201).json({
      message: 'KYC submitted successfully',
      kycRequest,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get KYC status for franchise user
const getKycStatus = async (req, res) => {
  try {
    // Check if franchise exists
    const franchise = await Franchise.findOne({ userId: req.user.id });
    if (!franchise) {
      return res.status(404).json({ message: 'Franchise not found' });
    }
    
    // Get KYC request
    const kycRequest = await KycRequest.findOne({ franchiseId: franchise._id });
    
    res.json({
      kycStatus: franchise.kycStatus,
      kycRequest,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get KYC request by franchise ID (admin only)
const getKycByFranchiseId = async (req, res) => {
  try {
    const { franchiseId } = req.params;
    
    // Find KYC request by franchise ID
    const kycRequest = await KycRequest.findOne({ franchiseId })
      .populate('userId', 'name email phone')
      .populate('franchiseId', 'businessName ownerName');
    
    if (!kycRequest) {
      return res.status(404).json({ message: 'KYC request not found' });
    }
    
    res.json(kycRequest);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all pending KYC requests (admin only)
const getPendingKycRequests = async (req, res) => {
  try {
    const kycRequests = await KycRequest.find({ status: 'pending' })
      .populate('userId', 'name email phone')
      .populate('franchiseId', 'businessName ownerName')
      .sort({ createdAt: 1 });
    
    res.json(kycRequests);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Approve KYC request (admin only)
const approveKyc = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find KYC request
    const kycRequest = await KycRequest.findById(id);
    if (!kycRequest) {
      return res.status(404).json({ message: 'KYC request not found' });
    }
    
    // Update KYC request
    kycRequest.status = 'approved';
    kycRequest.reviewedAt = new Date();
    kycRequest.reviewedBy = req.user.id;
    await kycRequest.save();
    
    // Update franchise
    const franchise = await Franchise.findById(kycRequest.franchiseId);
    if (franchise) {
      franchise.kycStatus = 'approved';
      franchise.kycApprovedAt = new Date();
      await franchise.save();
      
      // Send approval email to franchise user
      const user = await User.findById(franchise.userId);
      if (user) {
        try {
          await sendKycApprovalEmail(user, franchise);
        } catch (emailError) {
          console.error('Failed to send KYC approval email:', emailError);
        }
      }
    }
    
    res.json({
      message: 'KYC approved successfully',
      kycRequest,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Reject KYC request (admin only)
const rejectKyc = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    
    // Find KYC request
    const kycRequest = await KycRequest.findById(id);
    if (!kycRequest) {
      return res.status(404).json({ message: 'KYC request not found' });
    }
    
    // Update KYC request
    kycRequest.status = 'rejected';
    kycRequest.reviewedAt = new Date();
    kycRequest.reviewedBy = req.user.id;
    kycRequest.rejectionReason = rejectionReason;
    await kycRequest.save();
    
    // Update franchise
    const franchise = await Franchise.findById(kycRequest.franchiseId);
    if (franchise) {
      franchise.kycStatus = 'rejected';
      franchise.kycRejectedAt = new Date();
      franchise.kycRejectedReason = rejectionReason;
      await franchise.save();
      
      // Send rejection email to franchise user
      const user = await User.findById(franchise.userId);
      if (user) {
        try {
          await sendKycRejectionEmail(user, franchise, rejectionReason);
        } catch (emailError) {
          console.error('Failed to send KYC rejection email:', emailError);
        }
      }
    }
    
    res.json({
      message: 'KYC rejected successfully',
      kycRequest,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  submitKyc,
  getKycStatus,
  getKycByFranchiseId,
  getPendingKycRequests,
  approveKyc,
  rejectKyc,
};
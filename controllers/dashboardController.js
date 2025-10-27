const Franchise = require('../models/Franchise');
const Lead = require('../models/Lead');
const Transaction = require('../models/Transaction');
const Package = require('../models/Package');
const CreditReport = require('../models/CreditReport');
const Referral = require('../models/Referral');

// Get franchise dashboard statistics
const getFranchiseDashboard = async (req, res) => {
  try {
    // Get franchise details
    const franchise = await Franchise.findOne({ userId: req.user.id })
      .populate('userId', 'name email phone');
    
    if (!franchise) {
      return res.status(404).json({ message: 'Franchise not found' });
    }
    
    // Get lead statistics
    const totalLeads = await Lead.countDocuments({ franchiseId: franchise._id });
    const newLeads = await Lead.countDocuments({ 
      franchiseId: franchise._id, 
      status: 'new' 
    });
    
    // Get credit reports count
    const totalCreditReports = await CreditReport.countDocuments({ 
      franchiseId: franchise._id 
    });
    
    // Get referrals count
    const totalReferrals = await Referral.countDocuments({ 
      referrerFranchiseId: franchise._id 
    });
    
    // Get recent transactions
    const recentTransactions = await Transaction.find({ 
      userId: req.user.id,
      status: 'paid'
    })
    .populate('packageId', 'name')
    .sort({ createdAt: -1 })
    .limit(5);
    
    res.json({
      franchise,
      stats: {
        credits: franchise.credits,
        totalLeads,
        newLeads,
        totalCreditReports,
        totalReferrals,
      },
      recentTransactions,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get leads for franchise
const getFranchiseLeads = async (req, res) => {
  try {
    // Get franchise
    const franchise = await Franchise.findOne({ userId: req.user.id });
    if (!franchise) {
      return res.status(404).json({ message: 'Franchise not found' });
    }
    
    // Get leads
    const leads = await Lead.find({ franchiseId: franchise._id })
      .sort({ createdAt: -1 });
    
    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create lead for franchise
const createLead = async (req, res) => {
  try {
    // Get franchise
    const franchise = await Franchise.findOne({ userId: req.user.id });
    if (!franchise) {
      return res.status(404).json({ message: 'Franchise not found' });
    }
    
    // Check if franchise has enough credits
    if (franchise.credits < 1) {
      return res.status(400).json({ message: 'Insufficient credits to create lead' });
    }
    
    // Create lead
    const lead = new Lead({
      franchiseId: franchise._id,
      ...req.body,
    });
    
    await lead.save();
    
    // Deduct credit
    franchise.credits -= 1;
    await franchise.save();
    
    res.status(201).json({
      message: 'Lead created successfully',
      lead,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get lead by ID for franchise
const getFranchiseLeadById = async (req, res) => {
  try {
    // Get franchise
    const franchise = await Franchise.findOne({ userId: req.user.id });
    if (!franchise) {
      return res.status(404).json({ message: 'Franchise not found' });
    }
    
    // Get lead
    const lead = await Lead.findOne({ 
      _id: req.params.id, 
      franchiseId: franchise._id 
    });
    
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }
    
    res.json(lead);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update lead for franchise
const updateFranchiseLead = async (req, res) => {
  try {
    // Get franchise
    const franchise = await Franchise.findOne({ userId: req.user.id });
    if (!franchise) {
      return res.status(404).json({ message: 'Franchise not found' });
    }
    
    // Update lead
    const lead = await Lead.findOneAndUpdate(
      { 
        _id: req.params.id, 
        franchiseId: franchise._id 
      },
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }
    
    res.json({
      message: 'Lead updated successfully',
      lead,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get transactions for franchise
const getFranchiseTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user.id })
      .populate('packageId', 'name')
      .sort({ createdAt: -1 });
    
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get packages for purchase
const getPackagesForPurchase = async (req, res) => {
  try {
    const packages = await Package.find({ isActive: true })
      .sort({ sortOrder: 1 });
    
    res.json(packages);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get referrals for franchise
const getFranchiseReferrals = async (req, res) => {
  try {
    // Get franchise
    const franchise = await Franchise.findOne({ userId: req.user.id });
    if (!franchise) {
      return res.status(404).json({ message: 'Franchise not found' });
    }
    
    const referrals = await Referral.find({ referrerFranchiseId: franchise._id })
      .populate('referredFranchiseId', 'businessName');
    
    res.json(referrals);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create referral for franchise
const createReferral = async (req, res) => {
  try {
    // Get franchise
    const franchise = await Franchise.findOne({ userId: req.user.id });
    if (!franchise) {
      return res.status(404).json({ message: 'Franchise not found' });
    }
    
    // Check if referral already exists
    const existingReferral = await Referral.findOne({ 
      referrerFranchiseId: franchise._id,
      referredEmail: req.body.referredEmail,
    });
    
    if (existingReferral) {
      return res.status(400).json({ message: 'Referral already exists for this email' });
    }
    
    // Create referral
    const referral = new Referral({
      referrerFranchiseId: franchise._id,
      ...req.body,
    });
    
    await referral.save();
    
    res.status(201).json({
      message: 'Referral created successfully',
      referral,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getFranchiseDashboard,
  getFranchiseLeads,
  createLead,
  getFranchiseLeadById,
  updateFranchiseLead,
  getFranchiseTransactions,
  getPackagesForPurchase,
  getFranchiseReferrals,
  createReferral,
};
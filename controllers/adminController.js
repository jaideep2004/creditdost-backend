const User = require('../models/User');
const Franchise = require('../models/Franchise');
const Package = require('../models/Package');
const Lead = require('../models/Lead');
const Transaction = require('../models/Transaction');
const Payout = require('../models/Payout');
const Referral = require('../models/Referral');
const CreditReport = require('../models/CreditReport');
const Setting = require('../models/Setting');

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    const totalFranchises = await Franchise.countDocuments();
    const activeFranchises = await Franchise.countDocuments({ isActive: true });
    const pendingKycFranchises = await Franchise.countDocuments({ kycStatus: 'pending' });
    const totalPackages = await Package.countDocuments({ isActive: true });
    const totalLeads = await Lead.countDocuments();
    const totalTransactions = await Transaction.countDocuments({ status: 'paid' });
    
    // Calculate total revenue
    const revenueResult = await Transaction.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;
    
    res.json({
      totalFranchises,
      activeFranchises,
      pendingKycFranchises,
      totalPackages,
      totalLeads,
      totalTransactions,
      totalRevenue,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get recent activities for admin dashboard
const getRecentActivities = async (req, res) => {
  try {
    // Get recent user registrations
    const recentUsers = await User.find({}, 'name email createdAt')
      .sort({ createdAt: -1 })
      .limit(5);
    
    // Get recent transactions
    const recentTransactions = await Transaction.find({ status: 'paid' })
      .populate('userId', 'name')
      .populate('packageId', 'name')
      .sort({ createdAt: -1 })
      .limit(5);
    
    // Get recent KYC submissions
    const recentKyc = await Franchise.find({ kycStatus: { $in: ['submitted', 'approved', 'rejected'] } })
      .populate('userId', 'name')
      .sort({ kycSubmittedAt: -1 })
      .limit(5);
    
    // Combine and format activities
    const activities = [];
    
    recentUsers.forEach(user => {
      activities.push({
        id: user._id,
        user: user.name,
        action: 'Registered as franchise',
        time: user.createdAt,
        status: 'completed',
        type: 'registration'
      });
    });
    
    recentTransactions.forEach(transaction => {
      activities.push({
        id: transaction._id,
        user: transaction.userId?.name || 'Unknown User',
        action: `Purchased ${transaction.packageId?.name || 'package'}`,
        time: transaction.createdAt,
        status: 'completed',
        type: 'transaction'
      });
    });
    
    recentKyc.forEach(franchise => {
      activities.push({
        id: franchise._id,
        user: franchise.userId?.name || 'Unknown User',
        action: 'KYC submitted',
        time: franchise.kycSubmittedAt,
        status: franchise.kycStatus === 'approved' ? 'completed' : 
               franchise.kycStatus === 'rejected' ? 'rejected' : 'pending',
        type: 'kyc'
      });
    });
    
    // Sort by time and limit to 10 most recent
    activities.sort((a, b) => new Date(b.time) - new Date(a.time));
    const recentActivities = activities.slice(0, 10);
    
    res.json(recentActivities);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all users (admin only)
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get user by ID (admin only)
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update user (admin only)
const updateUser = async (req, res) => {
  try {
    const { name, email, phone, isActive } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, phone, isActive },
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      message: 'User updated successfully',
      user,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all leads (admin only)
const getAllLeads = async (req, res) => {
  try {
    const leads = await Lead.find()
      .populate('franchiseId', 'businessName')
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 });
    
    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get lead by ID (admin only)
const getLeadById = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('franchiseId', 'businessName')
      .populate('assignedTo', 'name');
    
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }
    
    res.json(lead);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update lead (admin only)
const updateLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('franchiseId', 'businessName')
     .populate('assignedTo', 'name');
    
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

// Get all transactions (admin only)
const getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate('userId', 'name email')
      .populate('franchiseId', 'businessName')
      .populate('packageId', 'name')
      .sort({ createdAt: -1 });
    
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get transaction by ID (admin only)
const getTransactionById = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('franchiseId', 'businessName')
      .populate('packageId', 'name');
    
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all payouts (admin only)
const getAllPayouts = async (req, res) => {
  try {
    const payouts = await Payout.find()
      .populate('franchiseId', 'businessName ownerName')
      .populate('processedBy', 'name')
      .sort({ createdAt: -1 });
    
    res.json(payouts);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update payout status (admin only)
const updatePayout = async (req, res) => {
  try {
    const { status, remarks } = req.body;
    
    const payout = await Payout.findByIdAndUpdate(
      req.params.id,
      { 
        status, 
        remarks,
        processedAt: status === 'completed' ? new Date() : undefined,
        processedBy: status === 'completed' ? req.user.id : undefined,
      },
      { new: true, runValidators: true }
    ).populate('franchiseId', 'businessName ownerName')
     .populate('processedBy', 'name');
    
    if (!payout) {
      return res.status(404).json({ message: 'Payout not found' });
    }
    
    res.json({
      message: 'Payout updated successfully',
      payout,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all referrals (admin only)
const getAllReferrals = async (req, res) => {
  try {
    const referrals = await Referral.find()
      .populate('referrerFranchiseId', 'businessName ownerName')
      .populate('referredFranchiseId', 'businessName ownerName')
      .sort({ createdAt: -1 });
    
    res.json(referrals);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all credit reports (admin only)
const getAllCreditReportsAdmin = async (req, res) => {
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

// Get settings (admin only)
const getSettings = async (req, res) => {
  try {
    const settings = await Setting.find();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update setting (admin only)
const updateSetting = async (req, res) => {
  try {
    const { key, value, description } = req.body;
    
    let setting = await Setting.findOne({ key });
    
    if (setting) {
      setting.value = value;
      setting.description = description;
      await setting.save();
    } else {
      setting = new Setting({
        key,
        value,
        description,
      });
      await setting.save();
    }
    
    res.json({
      message: 'Setting updated successfully',
      setting,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getDashboardStats,
  getRecentActivities,
  getAllUsers,
  getUserById,
  updateUser,
  getAllLeads,
  getLeadById,
  updateLead,
  getAllTransactions,
  getTransactionById,
  getAllPayouts,
  updatePayout,
  getAllReferrals,
  getAllCreditReportsAdmin,
  getSettings,
  updateSetting,
};
const User = require('../models/User');
const Franchise = require('../models/Franchise');
const Package = require('../models/Package');
const Lead = require('../models/Lead');
const Transaction = require('../models/Transaction');
const Payout = require('../models/Payout');
const Referral = require('../models/Referral');
const CreditReport = require('../models/CreditReport');
const Setting = require('../models/Setting');
const BusinessForm = require('../models/BusinessForm');
const { sendLeadAssignmentEmail } = require('../utils/emailService');

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
    
    // Sort by time and limit to 5 most recent
    activities.sort((a, b) => new Date(b.time) - new Date(a.time));
    const recentActivities = activities.slice(0, 5);
    
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

// Create lead (admin only)
const createLead = async (req, res) => {
  try {
    const { 
      franchiseId, 
      name, 
      email, 
      phone, 
      address, 
      creditScore,
      creditReportUrl,
      assignedTo,
      notes
    } = req.body;
    
    // Validate required fields
    if (!name || !phone) {
      return res.status(400).json({ 
        message: 'Name and phone are required' 
      });
    }
    
    // Create new lead
    const lead = new Lead({
      franchiseId: franchiseId || undefined, // Make franchiseId optional
      name,
      email: email ? email.toLowerCase() : undefined,
      phone,
      address,
      creditScore,
      creditReportUrl,
      assignedTo,
      notes: notes ? [{
        note: notes,
        createdBy: req.user.id,
        createdAt: new Date()
      }] : undefined
    });
    
    await lead.save();
    
    // Populate references
    await lead.populate('franchiseId', 'businessName');
    await lead.populate('assignedTo', 'name');
    
    res.status(201).json({
      message: 'Lead created successfully',
      lead,
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
    
    // Send email notification if franchiseId was updated (lead assigned)
    if (req.body.franchiseId) {
      try {
        // Get the franchise user
        const franchise = await Franchise.findById(req.body.franchiseId);
        if (franchise) {
          const franchiseUser = await User.findById(franchise.userId);
          if (franchiseUser) {
            // Get the admin user who made the assignment
            const adminUser = await User.findById(req.user.id);
            
            // Send assignment email
            await sendLeadAssignmentEmail(franchiseUser, lead, adminUser);
          }
        }
      } catch (emailError) {
        console.error('Failed to send lead assignment email:', emailError);
        // Don't fail the request if email sending fails
      }
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
      .populate('packageId', 'name')
      .sort({ createdAt: -1 });
    
    res.json(referrals);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get referral settings (admin only)
const getReferralSettings = async (req, res) => {
  try {
    const settings = await Setting.findOne({ key: 'referral_bonus_settings' });
    
    if (!settings) {
      return res.json({ value: [] });
    }
    
    // Populate package names in the settings
    const populatedSettings = [];
    for (const setting of settings.value) {
      const pkg = await Package.findById(setting.packageId);
      populatedSettings.push({
        ...setting,
        packageName: pkg ? pkg.name : 'Unknown Package'
      });
    }
    
    res.json({ value: populatedSettings });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update referral settings (admin only)
const updateReferralSettings = async (req, res) => {
  try {
    const { value } = req.body;
    
    let settings = await Setting.findOne({ key: 'referral_bonus_settings' });
    
    if (settings) {
      settings.value = value;
      await settings.save();
    } else {
      settings = new Setting({
        key: 'referral_bonus_settings',
        value,
        description: 'Referral bonus percentages by package'
      });
      await settings.save();
    }
    
    res.json({
      message: 'Referral settings updated successfully',
      settings,
    });
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

// Get all franchises with credit information (admin only)
const getAllFranchisesWithCredits = async (req, res) => {
  try {
    const franchises = await Franchise.find({ isActive: true })
      .select('businessName credits totalCreditsPurchased kycStatus')
      .sort({ businessName: 1 });
    
    res.json(franchises);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Recharge credits for a franchise (admin only)
const rechargeFranchiseCredits = async (req, res) => {
  try {
    const { franchiseId, credits, remarks } = req.body;
    
    // Validate input
    if (!franchiseId || credits === undefined || credits <= 0) {
      return res.status(400).json({ 
        message: 'Franchise ID and positive credits amount are required' 
      });
    }
    
    // Find the franchise
    const franchise = await Franchise.findById(franchiseId);
    if (!franchise) {
      return res.status(404).json({ message: 'Franchise not found' });
    }
    
    // Update credits
    const oldCredits = franchise.credits;
    franchise.credits += credits;
    franchise.totalCreditsPurchased += credits;
    await franchise.save();
    
    // Log the transaction (optional)
    const transaction = new Transaction({
      userId: franchise.userId,
      amount: 0, // Free recharge
      currency: 'INR',
      status: 'paid',
      paymentMethod: 'admin_recharge',
      remarks: remarks || `Admin credit recharge: ${credits} credits`,
      metadata: {
        adminId: req.user.id,
        oldCredits,
        newCredits: franchise.credits,
        creditsAdded: credits
      }
    });
    
    await transaction.save();
    
    res.json({
      message: 'Credits recharged successfully',
      franchise: {
        id: franchise._id,
        businessName: franchise.businessName,
        credits: franchise.credits,
        totalCreditsPurchased: franchise.totalCreditsPurchased
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get credit recharge history (admin only)
const getCreditRechargeHistory = async (req, res) => {
  try {
    const transactions = await Transaction.find({
      paymentMethod: 'admin_recharge'
    })
    .populate('userId', 'name email')
    .sort({ createdAt: -1 })
    .limit(50);
    
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Calculate payouts for a franchise (admin only)
const calculateFranchisePayouts = async (req, res) => {
  try {
    const { franchiseId, periodStart, periodEnd } = req.body;
    
    // Validate input
    if (!franchiseId || !periodStart || !periodEnd) {
      return res.status(400).json({ 
        message: 'Franchise ID, period start, and period end are required' 
      });
    }
    
    // Validate dates
    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    
    if (isNaN(startDate) || isNaN(endDate)) {
      return res.status(400).json({ 
        message: 'Invalid date format' 
      });
    }
    
    if (startDate >= endDate) {
      return res.status(400).json({ 
        message: 'Period start must be before period end' 
      });
    }
    
    // Find the franchise
    const franchise = await Franchise.findById(franchiseId);
    if (!franchise) {
      return res.status(404).json({ message: 'Franchise not found' });
    }
    
    // Get business forms (customer packages sold) during the period
    const businessForms = await BusinessForm.find({
      franchiseId: franchiseId,
      paymentStatus: 'paid',
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    }).populate('selectedPackage');
    
    // Calculate business payout based on customer packages sold
    let totalBusinessPayout = 0;
    let creditsGenerated = 0;
    
    for (const form of businessForms) {
      if (form.selectedPackage) {
        creditsGenerated += form.selectedPackage.creditsIncluded || 0;
        
        // Calculate business payout based on customer package settings
        const customerPackage = form.selectedPackage;
        if (customerPackage.businessPayoutType === 'percentage') {
          totalBusinessPayout += (customerPackage.price * (customerPackage.businessPayoutPercentage || 20)) / 100;
        } else {
          totalBusinessPayout += customerPackage.businessPayoutFixedAmount || 0;
        }
      }
    }
    
    // Get credit reports generated during the period (as a measure of business done)
    const creditReports = await CreditReport.find({
      franchiseId: franchiseId,
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    });
    
    // Additional business metrics could be added here
    // For now, we'll use credit reports as a proxy for business activity
    
    // Calculate referral bonuses
    const referrals = await Referral.find({
      referrerFranchiseId: franchiseId,
      status: 'credited',
      creditedAt: {
        $gte: startDate,
        $lte: endDate
      }
    });
    
    let referralBonus = 0;
    referrals.forEach(referral => {
      referralBonus += referral.bonusAmount || 0;
    });
    
    // Calculate total payout amount
    // Package business payout + referral bonuses
    const totalAmount = totalBusinessPayout + referralBonus;
    
    // Create payout record
    const payout = new Payout({
      franchiseId: franchiseId,
      amount: totalBusinessPayout,
      periodStart: startDate,
      periodEnd: endDate,
      creditsGenerated: creditsGenerated,
      referralBonus: referralBonus,
      totalAmount: totalAmount,
      status: 'pending'
    });
    
    await payout.save();
    
    // Populate franchise details
    await payout.populate('franchiseId', 'businessName ownerName');
    
    res.json({
      message: 'Payout calculated successfully',
      payout
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get payouts for a specific franchise (admin only)
const getFranchisePayouts = async (req, res) => {
  try {
    const { franchiseId } = req.params;
    
    const payouts = await Payout.find({ franchiseId })
      .populate('franchiseId', 'businessName ownerName')
      .populate('processedBy', 'name')
      .sort({ createdAt: -1 });
    
    res.json(payouts);
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
  createLead,
  getAllLeads,
  getLeadById,
  updateLead,
  getAllTransactions,
  getTransactionById,
  getAllPayouts,
  updatePayout,
  getAllReferrals,
  getReferralSettings,
  updateReferralSettings,
  getAllCreditReportsAdmin,
  getSettings,
  updateSetting,
  getAllFranchisesWithCredits,
  rechargeFranchiseCredits,
  getCreditRechargeHistory,
  calculateFranchisePayouts,
  getFranchisePayouts,
};
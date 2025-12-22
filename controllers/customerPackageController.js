const CustomerPackage = require('../models/CustomerPackage');
const Franchise = require('../models/Franchise');
const Transaction = require('../models/Transaction');
const Joi = require('joi');

// Validation schema for creating/updating customer packages
const customerPackageSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().required(),
  price: Joi.number().min(0).required(),
  creditsIncluded: Joi.number().min(0).required(),
  features: Joi.array().items(Joi.string()),
  isActive: Joi.boolean(),
  sortOrder: Joi.number(),
  // Business payout settings
  businessPayoutPercentage: Joi.number().min(0).max(100),
  businessPayoutType: Joi.string().valid('fixed', 'percentage'),
  businessPayoutFixedAmount: Joi.number().min(0),
});

// Get all active customer packages
const getCustomerPackages = async (req, res) => {
  try {
    let packages = await CustomerPackage.find({ isActive: true }).sort({ sortOrder: 1 });
    
    // If user is authenticated as a franchise user, check if they have purchased the Diamond package
    if (req.user && req.user.role === 'franchise_user') {
      // Get the franchise details
      const franchise = await Franchise.findOne({ userId: req.user.id });
      
      if (franchise) {
        // Check if franchise has purchased a package by checking their transactions
        const transactions = await Transaction.find({ 
          userId: req.user.id,
          status: 'paid'
        }).populate('packageId');
        
        // Check if any transaction is for a package that we consider as "Diamond" package
        // We'll check for a package with name containing 'Diamond', 'Enterprise', or price >= 9999
        // This can be customized based on business requirements
        const hasDiamondPackage = transactions.some(transaction => 
          transaction.packageId && 
          (transaction.packageId.name.includes('Diamond') || 
           transaction.packageId.name.includes('Enterprise') ||
           transaction.packageId.price >= 9999)
        );
        
        // Log for debugging
        console.log('Franchise ID:', franchise._id);
        console.log('Transactions:', transactions);
        console.log('Has Diamond Package:', hasDiamondPackage);
        
        // If franchise doesn't have Diamond package, filter out the Credit Fit package
        if (!hasDiamondPackage) {
          packages = packages.filter(pkg => pkg.name !== 'Credit Fit');
        }
      }
    }
    
    res.json(packages);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all customer packages (admin only)
const getAllCustomerPackages = async (req, res) => {
  try {
    const packages = await CustomerPackage.find().sort({ createdAt: -1 });
    res.json(packages);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get customer package by ID
const getCustomerPackageById = async (req, res) => {
  try {
    const package = await CustomerPackage.findById(req.params.id);
    
    if (!package) {
      return res.status(404).json({ message: 'Package not found' });
    }
    
    res.json(package);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create new customer package (admin only)
const createCustomerPackage = async (req, res) => {
  try {
    // Validate request body
    const { error } = customerPackageSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        message: 'Validation error',
        details: error.details[0].message
      });
    }
    
    const customerPackage = new CustomerPackage(req.body);
    await customerPackage.save();
    
    res.status(201).json({
      message: 'Customer package created successfully',
      customerPackage
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update customer package (admin only)
const updateCustomerPackage = async (req, res) => {
  try {
    // Validate request body
    const { error } = customerPackageSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        message: 'Validation error',
        details: error.details[0].message
      });
    }
    
    const customerPackage = await CustomerPackage.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!customerPackage) {
      return res.status(404).json({ message: 'Customer package not found' });
    }
    
    res.json({
      message: 'Customer package updated successfully',
      customerPackage
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete customer package (admin only)
const deleteCustomerPackage = async (req, res) => {
  try {
    const customerPackage = await CustomerPackage.findByIdAndDelete(req.params.id);
    
    if (!customerPackage) {
      return res.status(404).json({ message: 'Customer package not found' });
    }
    
    res.json({ message: 'Customer package deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getCustomerPackages,
  getAllCustomerPackages,
  getCustomerPackageById,
  createCustomerPackage,
  updateCustomerPackage,
  deleteCustomerPackage,
};
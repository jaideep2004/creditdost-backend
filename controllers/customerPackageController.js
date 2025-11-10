const CustomerPackage = require('../models/CustomerPackage');
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
    const packages = await CustomerPackage.find({ isActive: true }).sort({ sortOrder: 1 });
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
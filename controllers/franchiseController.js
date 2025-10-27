const Franchise = require('../models/Franchise');
const User = require('../models/User');
const Joi = require('joi');

// Validation schema for updating franchise profile
const franchiseProfileSchema = Joi.object({
  businessName: Joi.string().min(2).max(100).required(),
  ownerName: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
  address: Joi.object({
    street: Joi.string().allow(''),
    city: Joi.string().allow(''),
    state: Joi.string().allow(''),
    pincode: Joi.string().allow(''),
    country: Joi.string().allow(''),
  }),
});

// Get franchise profile
const getFranchiseProfile = async (req, res) => {
  try {
    const franchise = await Franchise.findOne({ userId: req.user.id })
      .populate('userId', 'name email phone');
    
    if (!franchise) {
      return res.status(404).json({ message: 'Franchise not found' });
    }
    
    res.json(franchise);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update franchise profile
const updateFranchiseProfile = async (req, res) => {
  try {
    // Validate request body
    const { error } = franchiseProfileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        message: 'Validation error',
        details: error.details[0].message
      });
    }
    
    const franchise = await Franchise.findOne({ userId: req.user.id });
    if (!franchise) {
      return res.status(404).json({ message: 'Franchise not found' });
    }
    
    // Update franchise
    Object.assign(franchise, req.body);
    await franchise.save();
    
    res.json({
      message: 'Franchise profile updated successfully',
      franchise,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all franchises (admin only)
const getAllFranchises = async (req, res) => {
  try {
    const franchises = await Franchise.find()
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 });
    
    res.json(franchises);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get franchise by ID (admin only)
const getFranchiseById = async (req, res) => {
  try {
    const franchise = await Franchise.findById(req.params.id)
      .populate('userId', 'name email phone');
    
    if (!franchise) {
      return res.status(404).json({ message: 'Franchise not found' });
    }
    
    res.json(franchise);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update franchise (admin only)
const updateFranchise = async (req, res) => {
  try {
    // Validate request body
    const { error } = franchiseProfileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        message: 'Validation error',
        details: error.details[0].message
      });
    }
    
    const franchise = await Franchise.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('userId', 'name email phone');
    
    if (!franchise) {
      return res.status(404).json({ message: 'Franchise not found' });
    }
    
    res.json({
      message: 'Franchise updated successfully',
      franchise,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Deactivate franchise (admin only)
const deactivateFranchise = async (req, res) => {
  try {
    const franchise = await Franchise.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).populate('userId', 'name email phone');
    
    if (!franchise) {
      return res.status(404).json({ message: 'Franchise not found' });
    }
    
    // Also deactivate user
    await User.findByIdAndUpdate(franchise.userId, { isActive: false });
    
    res.json({
      message: 'Franchise deactivated successfully',
      franchise,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Activate franchise (admin only)
const activateFranchise = async (req, res) => {
  try {
    const franchise = await Franchise.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    ).populate('userId', 'name email phone');
    
    if (!franchise) {
      return res.status(404).json({ message: 'Franchise not found' });
    }
    
    // Also activate user
    await User.findByIdAndUpdate(franchise.userId, { isActive: true });
    
    res.json({
      message: 'Franchise activated successfully',
      franchise,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getFranchiseProfile,
  updateFranchiseProfile,
  getAllFranchises,
  getFranchiseById,
  updateFranchise,
  deactivateFranchise,
  activateFranchise,
};
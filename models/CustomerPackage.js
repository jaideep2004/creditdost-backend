const mongoose = require('mongoose');

const customerPackageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  }, 
  price: { 
    type: Number,
    required: true,
    min: 0,
  },
  creditsIncluded: {
    type: Number,
    required: true,
    min: 0,
  },
  features: [{ 
    type: String,
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
  sortOrder: {
    type: Number,
    default: 0,
  },
  // Business payout settings
  businessPayoutPercentage: {
    type: Number,
    default: 20, // Default 20% payout
    min: 0,
    max: 100,
  },
  businessPayoutType: {
    type: String,
    enum: ['fixed', 'percentage'],
    default: 'percentage',
  },
  businessPayoutFixedAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
}, {
  timestamps: true,
});

// Set default value for features array
customerPackageSchema.path('features').default(() => []);

module.exports = mongoose.model('CustomerPackage', customerPackageSchema);
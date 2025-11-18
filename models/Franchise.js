const mongoose = require('mongoose');

const franchiseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  businessName: {
    type: String,
    required: true,
    trim: true,
  },
  ownerName: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
  },
  phone: {
    type: String,
    required: true,
  },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: {
      type: String,
      default: 'India',
    },
  },
  kycStatus: {
    type: String,
    enum: ['pending', 'submitted', 'approved', 'rejected'],
    default: 'pending',
  },
  kycSubmittedAt: {
    type: Date,
  },
  kycApprovedAt: {
    type: Date,
  },
  kycRejectedAt: {
    type: Date,
  },
  kycRejectedReason: {
    type: String,
  },
  agreementSigned: {
    type: Boolean,
    default: false,
  },
  agreementSignedAt: {
    type: Date,
  },
  credits: {
    type: Number,
    default: 0,
  },
  totalCreditsPurchased: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  // Field to track assigned packages
  assignedPackages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package'
  }],
}, {
  timestamps: true,
});

module.exports = mongoose.model('Franchise', franchiseSchema);
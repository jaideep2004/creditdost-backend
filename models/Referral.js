const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  referrerFranchiseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Franchise',
    required: true,
  },
  referredFranchiseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Franchise',
  },
  referredEmail: {
    type: String,
    required: true,
    lowercase: true,
  },
  referredName: {
    type: String,
    required: true,
  },
  referredPhone: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'registered', 'purchased', 'credited'],
    default: 'pending',
  },
  creditsEarned: {
    type: Number,
    default: 0,
  },
  creditedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Referral', referralSchema);
const mongoose = require('mongoose');

const businessFormSchema = new mongoose.Schema({
  franchiseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Franchise',
    required: true,
  },
  customerName: {
    type: String,
    required: true,
    trim: true,
  },
  customerEmail: {
    type: String,
    required: true,
    lowercase: true,
  },
  customerPhone: {
    type: String,
    required: true,
  },
  panNumber: {
    type: String,
    required: true,
    uppercase: true,
  },
  aadharNumber: {
    type: String,
    required: true,
  },
  pincode: {
    type: String,
    required: true,
  },
  state: {
    type: String,
    required: true,
  },
  language: {
    type: String,
    required: true,
  },
  occupation: {
    type: String,
    required: true,
  },
  monthlyIncome: {
    type: Number,
    required: true,
    min: 0,
  },
  fullAddress: {
    type: String,
    required: true,
  },
  selectedPackage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CustomerPackage',
    required: true,
  },
  paymentId: {
    type: String,
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending',
  },
  razorpayOrderId: {
    type: String,
  },
  razorpayPaymentId: {
    type: String,
  },
  razorpaySignature: {
    type: String,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('BusinessForm', businessFormSchema);
const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
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
  validityDays: {
    type: Number,
    required: true,
    min: 1,
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
}, {
  timestamps: true,
});

module.exports = mongoose.model('Package', packageSchema);
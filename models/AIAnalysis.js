const mongoose = require('mongoose');

const aiAnalysisSchema = new mongoose.Schema({
  franchise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Franchise',
    required: true
  },
  franchiseName: {
    type: String,
    required: true
  },
  franchiseEmail: {
    type: String,
    required: true
  },
  uploadedDocument: {
    type: String, // URL or path to the uploaded PDF
    required: true
  },
  uploadedDocumentName: {
    type: String,
    required: true
  },
  adminResponseDocument: {
    type: String, // URL or path to the admin response PDF
    default: null
  },
  adminResponseDocumentName: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['uploaded', 'processed', 'responded'],
    default: 'uploaded'
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  processedAt: {
    type: Date
  },
  respondedAt: {
    type: Date
  },
  adminNotes: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('AIAnalysis', aiAnalysisSchema);
const express = require('express');
const {
  uploadDocument,
  getAllDocuments,
  getDocumentById,
  respondToDocument,
  getFranchiseDocuments
} = require('../controllers/aiAnalysisController');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');

const router = express.Router();

// @route   POST /api/ai-analysis/upload
// @desc    Upload PDF document for AI analysis
// @access  Private/Franchise User
router.post('/upload', auth, rbac('franchise_user'), uploadDocument);

// @route   GET /api/ai-analysis/franchise/documents
// @desc    Get all documents for current franchise
// @access  Private/Franchise User
router.get('/franchise/documents', auth, rbac('franchise_user'), getFranchiseDocuments);

// @route   GET /api/ai-analysis/admin/documents
// @desc    Get all documents (admin only)
// @access  Private/Admin
router.get('/admin/documents', auth, rbac('admin'), getAllDocuments);

// @route   GET /api/ai-analysis/admin/documents/:id
// @desc    Get document by ID (admin only)
// @access  Private/Admin
router.get('/admin/documents/:id', auth, rbac('admin'), getDocumentById);

// @route   POST /api/ai-analysis/admin/respond/:id
// @desc    Respond to document with updated PDF (admin only)
// @access  Private/Admin
router.post('/admin/respond/:id', auth, rbac('admin'), respondToDocument);

module.exports = router;
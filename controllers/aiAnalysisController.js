const AIAnalysis = require('../models/AIAnalysis');
const Franchise = require('../models/Franchise');
const { upload } = require('../utils/fileUpload');
const { sendAIAnalysisNotificationToAdmin, sendAIAnalysisResponseToFranchise } = require('../utils/emailService');
const path = require('path');
const fs = require('fs');

// Configure multer for PDF uploads
const pdfUpload = upload.single('document');

// Upload PDF document by franchise user
const uploadDocument = async (req, res) => {
  try {
    // Handle file upload
    pdfUpload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ message: 'File upload error', error: err.message });
      }

      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      // Check if file is a PDF or HTML
      const fileExtension = path.extname(req.file.originalname).toLowerCase();
      if (fileExtension !== '.pdf' && fileExtension !== '.html' && fileExtension !== '.htm') {
        // Delete the uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: 'Only PDF and HTML files are allowed' });
      }

      // Get franchise details
      const franchise = await Franchise.findOne({ userId: req.user.id })
        .populate('userId', 'name email');

      if (!franchise) {
        // Delete the uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ message: 'Franchise not found' });
      }

      // Create AI Analysis document record
      const aiAnalysisDoc = new AIAnalysis({
        franchise: franchise._id,
        franchiseName: franchise.businessName,
        franchiseEmail: franchise.email,
        uploadedDocument: req.file.path,
        uploadedDocumentName: req.file.originalname,
        status: 'uploaded'
      });

      await aiAnalysisDoc.save();

      // Read file buffer and send email notification to admin
      try {
        // Read the file buffer
        const fileBuffer = fs.readFileSync(req.file.path);
        await sendAIAnalysisNotificationToAdmin(franchise, req.file.originalname, fileBuffer);
      } catch (emailError) {
        console.error('Failed to send admin notification email:', emailError);
      }

      res.status(201).json({
        message: 'Document uploaded successfully',
        document: aiAnalysisDoc
      });
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all documents for admin
const getAllDocuments = async (req, res) => {
  try {
    const documents = await AIAnalysis.find()
      .populate('franchise', 'businessName email')
      .sort({ createdAt: -1 });

    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get document by ID
const getDocumentById = async (req, res) => {
  try {
    const document = await AIAnalysis.findById(req.params.id)
      .populate('franchise', 'businessName email userId');

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.json(document);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Admin responds to document with updated PDF
const respondToDocument = async (req, res) => {
  try {
    // Handle file upload
    pdfUpload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ message: 'File upload error', error: err.message });
      }

      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      // Check if file is a PDF or HTML
      const fileExtension = path.extname(req.file.originalname).toLowerCase();
      if (fileExtension !== '.pdf' && fileExtension !== '.html' && fileExtension !== '.htm') {
        // Delete the uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: 'Only PDF and HTML files are allowed' });
      }

      // Find the document
      const document = await AIAnalysis.findById(req.params.id)
        .populate('franchise', 'businessName email userId');

      if (!document) {
        // Delete the uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ message: 'Document not found' });
      }

      // Update document with admin response
      document.adminResponseDocument = req.file.path;
      document.adminResponseDocumentName = req.file.originalname;
      document.status = 'responded';
      document.respondedAt = new Date();
      document.adminNotes = req.body.notes || '';

      await document.save();

      // Read file buffer and send email notification to franchise user
      try {
        // Read the response file buffer
        const fileBuffer = fs.readFileSync(req.file.path);
        await sendAIAnalysisResponseToFranchise(
          { email: document.franchiseEmail, businessName: document.franchiseName },
          document.adminResponseDocumentName,
          fileBuffer
        );
      } catch (emailError) {
        console.error('Failed to send franchise notification email:', emailError);
      }

      res.json({
        message: 'Response document uploaded successfully',
        document
      });
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get documents for a specific franchise
const getFranchiseDocuments = async (req, res) => {
  try {
    const franchise = await Franchise.findOne({ userId: req.user.id });

    if (!franchise) {
      return res.status(404).json({ message: 'Franchise not found' });
    }

    const documents = await AIAnalysis.find({ franchise: franchise._id })
      .sort({ createdAt: -1 });

    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  uploadDocument,
  getAllDocuments,
  getDocumentById,
  respondToDocument,
  getFranchiseDocuments
};
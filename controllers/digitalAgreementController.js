const DigitalAgreement = require('../models/DigitalAgreement');
const Franchise = require('../models/Franchise');
const User = require('../models/User');
const Setting = require('../models/Setting');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
// Add PDF-lib for PDF manipulation
const { PDFDocument, rgb } = require('pdf-lib');

// Helper function to get Surepass API key
const getSurepassApiKeyValue = async () => {
  try {
    const setting = await Setting.findOne({ key: "surepass_api_key" });
    return setting ? setting.value : process.env.SUREPASS_API_KEY;
  } catch (error) {
    console.error("Error fetching Surepass API key:", error);
    return null;
  }
};

// Generate PDF with user data dynamically
const generatePdfWithUserData = async (templatePath, userName) => {
  try {
    // Check if template exists
    if (!fs.existsSync(templatePath)) {
      throw new Error('Template PDF not found');
    }
    
    // Read the template PDF
    const templateBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    
    // Get the first page
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    
    // Embed a standard font
    const font = await pdfDoc.embedFont('Helvetica');
    
    // Draw the user's name on the PDF at specific coordinates
    // You can adjust these coordinates based on your template layout
    firstPage.drawText(userName, {
      x: 50,  // X coordinate
      y: 700, // Y coordinate
      size: 14,
      font: font,
      color: rgb(0, 0, 0) // Black color - using the correct PDF-lib color format
    });
    
    // Save the modified PDF
    const pdfBytes = await pdfDoc.save();
    
    // Generate a unique filename
    const fileName = `agreement_${Date.now()}_${userName.replace(/\s+/g, '_')}.pdf`;
    const outputPath = path.resolve(__dirname, '../uploads/agreements', fileName);
    
    // Ensure the directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write the PDF to file
    const buffer = Buffer.from(pdfBytes);
    fs.writeFileSync(outputPath, buffer);
    
    return outputPath;
  } catch (error) {
    console.error('Error generating PDF with user data:', error);
    throw error;
  }
};

// Copy template PDF and create a user-specific copy (fallback method)
const createUserSpecificPdf = async (templatePath, userName) => {
  try {
    // Check if template exists
    if (!fs.existsSync(templatePath)) {
      throw new Error('Template PDF not found');
    }
    
    // Generate a unique filename for the user's copy
    const fileName = `agreement_${Date.now()}_${userName.replace(/\s+/g, '_')}.pdf`;
    const outputPath = path.resolve(__dirname, '../uploads/agreements', fileName);
    
    // Ensure the directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Copy the template PDF to create user's copy
    fs.copyFileSync(templatePath, outputPath);
    
    return outputPath;
  } catch (error) {
    console.error('Error creating user-specific PDF:', error);
    throw error;
  }
};

// Initiate Surepass eSign process
const initiateEsign = async (req, res) => {
  try {
    const userId = req.user.id;
    const { documentUrl, signerName, signerEmail, signerPhone } = req.body;
    
    // Get Surepass API key
    const apiKey = await getSurepassApiKeyValue();
    
    if (!apiKey) {
      return res.status(500).json({ message: 'Surepass API key not configured' });
    }
    
    // Determine environment (use production by default, sandbox for development)
    const isDevelopment = process.env.NODE_ENV === 'development';
    const baseUrl = isDevelopment 
      ? 'https://kyc-api.sandbox.surepass.app' 
      : 'https://kyc-api.surepass.app';
    
    // Call Surepass eSign API to initiate signing
    const response = await axios.post(
      `${baseUrl}/api/v1/esign/initialize`,
      {
        pdf_pre_uploaded: false,
        sign_type: "suresign",
        config: {
          auth_mode: "1",
          reason: "Franchise Agreement"
        },
        prefill_options: {
          full_name: signerName,
          mobile_number: signerPhone,
          user_email: signerEmail
        },
        positions: {
          "1": [
            {
              x: 100,
              y: 200
            }
          ]
        },
        webhook_url: `${process.env.BACKEND_URL}/api/digital-agreements/webhook`
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.json({
      message: 'eSign process initiated successfully',
      redirectUrl: response.data.data.url,
      transactionId: response.data.data.client_id
    });
  } catch (error) {
    console.error('Surepass eSign initiation error:', error.message);
    
    if (error.response) {
      return res.status(error.response.status).json({
        message: 'eSign initiation failed',
        error: error.response.data
      });
    }
    
    res.status(500).json({
      message: 'An error occurred while initiating eSign process',
      error: error.message
    });
  }
};

// Webhook to receive eSign completion notification
const eSignWebhook = async (req, res) => {
  try {
    // For now, we'll just acknowledge the webhook
    // In a production environment, you would verify the signature and process the document
    
    console.log('eSign webhook received:', req.body);
    
    res.json({ message: 'Webhook received successfully' });
  } catch (error) {
    console.error('eSign webhook error:', error.message);
    res.status(500).json({ message: 'Webhook processing failed', error: error.message });
  }
};

// Create a new digital agreement for a franchise user
const createDigitalAgreement = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get the franchise associated with the user
    const franchise = await Franchise.findOne({ userId });
    
    if (!franchise) {
      return res.status(404).json({ message: 'Franchise not found' });
    }
    
    // Get user details
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if an agreement already exists for this user
    const existingAgreement = await DigitalAgreement.findOne({ userId });
    
    if (existingAgreement) {
      return res.status(400).json({ message: 'Digital agreement already exists for this user' });
    }
    
    // Path to the shared template PDF
    const templatePath = path.resolve(__dirname, '../uploads/franchise_agreement_template.pdf');
    
    // Generate PDF with user data dynamically
    const generatedPdfPath = await generatePdfWithUserData(templatePath, user.name);
    
    // Create the digital agreement record
    const digitalAgreement = new DigitalAgreement({
      franchiseId: franchise._id,
      userId: userId,
      templatePath: templatePath,
      generatedPdfPath: generatedPdfPath,
      userName: user.name,
      status: 'pending'
    });
    
    await digitalAgreement.save();
    
    res.status(201).json({
      message: 'Digital agreement created successfully',
      agreement: digitalAgreement
    });
  } catch (error) {
    console.error('Error creating digital agreement:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get digital agreement for a franchise user
const getDigitalAgreement = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find the digital agreement for the user
    let digitalAgreement = await DigitalAgreement.findOne({ userId })
      .populate('franchiseId', 'businessName')
      .populate('userId', 'name email');
    
    if (!digitalAgreement) {
      // If no agreement exists, create one
      const franchise = await Franchise.findOne({ userId });
      
      if (!franchise) {
        return res.status(404).json({ message: 'Franchise not found' });
      }
      
      // Get user details
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Path to the shared template PDF
      const templatePath = path.resolve(__dirname, '../uploads/franchise_agreement_template.pdf');
      
      // Check if template exists
      if (!fs.existsSync(templatePath)) {
        return res.status(500).json({ message: 'Agreement template not found. Please contact administrator.' });
      }
      
      // Generate PDF with user data dynamically
      const generatedPdfPath = await generatePdfWithUserData(templatePath, user.name);
      
      // Create the digital agreement record
      digitalAgreement = new DigitalAgreement({
        franchiseId: franchise._id,
        userId: userId,
        templatePath: templatePath,
        generatedPdfPath: generatedPdfPath,
        userName: user.name,
        status: 'pending'
      });
      
      await digitalAgreement.save();
    }
    
    res.json(digitalAgreement);
  } catch (error) {
    console.error('Error fetching digital agreement:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Download the generated PDF
const downloadGeneratedPdf = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find the digital agreement for the user
    const digitalAgreement = await DigitalAgreement.findOne({ userId });
    
    if (!digitalAgreement) {
      return res.status(404).json({ message: 'Digital agreement not found' });
    }
    
    // Check if generated PDF exists
    if (!fs.existsSync(digitalAgreement.generatedPdfPath)) {
      return res.status(404).json({ message: 'Generated PDF not found' });
    }
    
    // Update status to downloaded
    digitalAgreement.status = 'downloaded';
    await digitalAgreement.save();
    
    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=franchise_agreement_${digitalAgreement.userName.replace(/\s+/g, '_')}.pdf`);
    
    // Send the PDF file
    res.sendFile(digitalAgreement.generatedPdfPath);
  } catch (error) {
    console.error('Error downloading PDF:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Submit the signed PDF
const submitSignedPdf = async (req, res) => {
  try {
    const userId = req.user.id;
    const { transactionId } = req.body;
    
    // Find the digital agreement for the user
    const digitalAgreement = await DigitalAgreement.findOne({ userId });
    
    if (!digitalAgreement) {
      return res.status(404).json({ message: 'Digital agreement not found' });
    }
    
    // Update the agreement with signed status and transaction ID
    digitalAgreement.status = 'submitted';
    digitalAgreement.transactionId = transactionId;
    await digitalAgreement.save();
    
    res.json({
      message: 'Signed PDF submitted successfully',
      agreement: digitalAgreement
    });
  } catch (error) {
    console.error('Error submitting signed PDF:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ADMIN ROUTES

// Get all digital agreements (admin only)
const getAllDigitalAgreements = async (req, res) => {
  try {
    const agreements = await DigitalAgreement.find()
      .populate('franchiseId', 'businessName')
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });
    
    res.json(agreements);
  } catch (error) {
    console.error('Error fetching digital agreements:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get a specific digital agreement by ID (admin only)
const getDigitalAgreementById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const digitalAgreement = await DigitalAgreement.findById(id)
      .populate('franchiseId', 'businessName')
      .populate('userId', 'name email');
    
    if (!digitalAgreement) {
      return res.status(404).json({ message: 'Digital agreement not found' });
    }
    
    res.json(digitalAgreement);
  } catch (error) {
    console.error('Error fetching digital agreement:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Approve a digital agreement (admin only)
const approveDigitalAgreement = async (req, res) => {
  try {
    const { id } = req.params;
    
    const digitalAgreement = await DigitalAgreement.findByIdAndUpdate(
      id,
      { status: 'approved' },
      { new: true }
    ).populate('franchiseId', 'businessName').populate('userId', 'name email');
    
    if (!digitalAgreement) {
      return res.status(404).json({ message: 'Digital agreement not found' });
    }
    
    res.json({
      message: 'Digital agreement approved successfully',
      agreement: digitalAgreement
    });
  } catch (error) {
    console.error('Error approving digital agreement:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Reject a digital agreement (admin only)
const rejectDigitalAgreement = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    
    const digitalAgreement = await DigitalAgreement.findByIdAndUpdate(
      id,
      { 
        status: 'rejected',
        rejectionReason: rejectionReason
      },
      { new: true }
    ).populate('franchiseId', 'businessName').populate('userId', 'name email');
    
    if (!digitalAgreement) {
      return res.status(404).json({ message: 'Digital agreement not found' });
    }
    
    res.json({
      message: 'Digital agreement rejected successfully',
      agreement: digitalAgreement
    });
  } catch (error) {
    console.error('Error rejecting digital agreement:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Download signed PDF (admin only)
const downloadSignedPdf = async (req, res) => {
  try {
    const { id } = req.params;
    
    const digitalAgreement = await DigitalAgreement.findById(id);
    
    if (!digitalAgreement) {
      return res.status(404).json({ message: 'Digital agreement not found' });
    }
    
    // Check if signed PDF exists
    if (!digitalAgreement.signedPdfPath || !fs.existsSync(digitalAgreement.signedPdfPath)) {
      return res.status(404).json({ message: 'Signed PDF not found' });
    }
    
    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=signed_agreement_${digitalAgreement.userName.replace(/\s+/g, '_')}.pdf`);
    
    // Send the PDF file
    res.sendFile(digitalAgreement.signedPdfPath);
  } catch (error) {
    console.error('Error downloading signed PDF:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createDigitalAgreement,
  getDigitalAgreement,
  downloadGeneratedPdf,
  submitSignedPdf,
  getAllDigitalAgreements,
  getDigitalAgreementById,
  approveDigitalAgreement,
  rejectDigitalAgreement,
  downloadSignedPdf,
  initiateEsign,
  eSignWebhook
};
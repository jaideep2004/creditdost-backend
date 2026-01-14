const DigitalAgreement = require("../models/DigitalAgreement");
const Franchise = require("../models/Franchise");
const User = require("../models/User");
const Setting = require("../models/Setting");
const KycRequest = require("../models/KycRequest");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { PDFDocument, rgb } = require("pdf-lib");

// Coordinates for PDF editing
const PDF_COORDINATES = {
  // Page 1 coordinates
  page1: {
    date: { x: 409, y_top: 107, y_bottom: 0 },
    name: { x: 112.67, y_top: 450.0, y_bottom: 391.8 },
    pan: { x: 105.33, y_top: 473.33, y_bottom: 368.47 },
    phone: { x: 120.67, y_top: 497.33, y_bottom: 344.47 },
    aadhar: { x: 121.33, y_top: 520.67, y_bottom: 321.13 },
    address: { x: 128.67, y_top: 544.67, y_bottom: 297.13 },
    packagePrice: { x: 72.0, y_top: 459.33, y_bottom: 382.47 }, // Page 2
  },
  // Page 8 coordinates
  page8: {
    address: { x: 154.0, y_top: 234.67, y_bottom: 607.13 },
    name: { x: 111.33, y_top: 608.67, y_bottom: 233.13 },
    date: { x: 104.0, y_top: 659.33, y_bottom: 182.47 },
    mobile: { x: 116.67, y_top: 682.0, y_bottom: 159.8 },
    address2: { x: 124.0, y_top: 705.33, y_bottom: 136.47 },
    pan: { x: 104.0, y_top: 728.67, y_bottom: 113.13 },
    aadhar: { x: 118.67, y_top: 755.33, y_bottom: 86.47 },
  },
};

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

// Generate PDF with user data using coordinates
const generatePdfWithUserData = async (templatePath, userData) => {
  try {
    // Check if template exists
    if (!fs.existsSync(templatePath)) {
      throw new Error("Template PDF not found");
    }

    // Load the PDF template
    const templateBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);

    // Embed font
    const font = await pdfDoc.embedFont("Helvetica");

    // Get pages
    const pages = pdfDoc.getPages();

    // Get current date for date fields
    const currentDate = new Date().toLocaleDateString("en-IN");

    // Define black color
    const blackColor = rgb(0, 0, 0);

    // Edit Page 1
    if (pages.length >= 1) {
      const page1 = pages[0];

      // Add date
      page1.drawText(currentDate, {
        x: PDF_COORDINATES.page1.date.x,
        y: PDF_COORDINATES.page1.date.y_top,
        size: 12,
        font: font,
        color: blackColor,
      });

      // Add user name
      page1.drawText(userData.name || "", {
        x: PDF_COORDINATES.page1.name.x,
        y: PDF_COORDINATES.page1.name.y_top,
        size: 12,
        font: font,
        color: blackColor,
      });

      // Add PAN
      page1.drawText(userData.pan || "", {
        x: PDF_COORDINATES.page1.pan.x,
        y: PDF_COORDINATES.page1.pan.y_top,
        size: 12,
        font: font,
        color: blackColor,
      });

      // Add phone
      page1.drawText(userData.phone || "", {
        x: PDF_COORDINATES.page1.phone.x,
        y: PDF_COORDINATES.page1.phone.y_top,
        size: 12,
        font: font,
        color: blackColor,
      });

      // Add Aadhar
      page1.drawText(userData.aadhar || "", {
        x: PDF_COORDINATES.page1.aadhar.x,
        y: PDF_COORDINATES.page1.aadhar.y_top,
        size: 12,
        font: font,
        color: blackColor,
      });

      // Add address
      page1.drawText(userData.address || "", {
        x: PDF_COORDINATES.page1.address.x,
        y: PDF_COORDINATES.page1.address.y_top,
        size: 12,
        font: font,
        color: blackColor,
      });
    }

    // Edit Page 2 (for package price)
    if (pages.length >= 2) {
      const page2 = pages[1];
      page2.drawText(userData.packagePrice || "", {
        x: PDF_COORDINATES.page1.packagePrice.x,
        y: PDF_COORDINATES.page1.packagePrice.y_top,
        size: 12,
        font: font,
        color: blackColor,
      });
    }

    // Edit Page 8
    if (pages.length >= 8) {
      const page8 = pages[7]; // 0-indexed, so page 8 is index 7

      // Add address
      page8.drawText(userData.address || "", {
        x: PDF_COORDINATES.page8.address.x,
        y: PDF_COORDINATES.page8.address.y_top,
        size: 12,
        font: font,
        color: blackColor,
      });

      // Add name
      page8.drawText(userData.name || "", {
        x: PDF_COORDINATES.page8.name.x,
        y: PDF_COORDINATES.page8.name.y_top,
        size: 12,
        font: font,
        color: blackColor,
      });

      // Add date
      page8.drawText(currentDate, {
        x: PDF_COORDINATES.page8.date.x,
        y: PDF_COORDINATES.page8.date.y_top,
        size: 12,
        font: font,
        color: blackColor,
      });

      // Add mobile
      page8.drawText(userData.phone || "", {
        x: PDF_COORDINATES.page8.mobile.x,
        y: PDF_COORDINATES.page8.mobile.y_top,
        size: 12,
        font: font,
        color: blackColor,
      });

      // Add address (again)
      page8.drawText(userData.address || "", {
        x: PDF_COORDINATES.page8.address2.x,
        y: PDF_COORDINATES.page8.address2.y_top,
        size: 12,
        font: font,
        color: blackColor,
      });

      // Add PAN
      page8.drawText(userData.pan || "", {
        x: PDF_COORDINATES.page8.pan.x,
        y: PDF_COORDINATES.page8.pan.y_top,
        size: 12,
        font: font,
        color: blackColor,
      });

      // Add Aadhar
      page8.drawText(userData.aadhar || "", {
        x: PDF_COORDINATES.page8.aadhar.x,
        y: PDF_COORDINATES.page8.aadhar.y_top,
        size: 12,
        font: font,
        color: blackColor,
      });
    }

    // Save the modified PDF
    const pdfBytes = await pdfDoc.save();

    // Generate a unique filename for the user's copy
    const fileName = `agreement_${Date.now()}_${userData.name.replace(
      /\s+/g,
      "_"
    )}.pdf`;
    const outputPath = path.resolve(
      __dirname,
      "../uploads/agreements",
      fileName
    );

    // Ensure the directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write the PDF to file
    fs.writeFileSync(outputPath, pdfBytes);

    return outputPath;
  } catch (error) {
    console.error("Error generating PDF with user data:", error);
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
      return res
        .status(500)
        .json({ message: "Surepass API key not configured" });
    }

    // Use the correct Surepass eSign API endpoint
    const baseUrl = "https://kyc-api.surepass.app";

    // Find the digital agreement for this user to update transaction ID
    const digitalAgreement = await DigitalAgreement.findOne({ userId: req.user.id });

    // Call Surepass eSign API to initiate signing with correct request structure
    const response = await axios.post(
      `${baseUrl}/api/v1/esign/initialize`,
      {
        pdf_pre_uploaded: false,
        sign_type: "suresign",
        config: {
          auth_mode: "1",
          reason: "General- Agreement",
        },
        prefill_options: {
          full_name: signerName,
          mobile_number: signerPhone,
          user_email: signerEmail,
        },
        positions: {
          1: [
            {
              x: 100,
              y: 200,
            },
          ],
          2: [
            {
              x: 0,
              y: 0,
            },
          ],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Extract client_id from the response as per SurePass documentation
    const client_id = response.data.data.client_id;

    // Update the digital agreement with the client_id and set status to submitted
    if (digitalAgreement) {
      digitalAgreement.transactionId = client_id; // Store client_id as transactionId in DB
      digitalAgreement.status = "submitted"; // Mark as submitted for signing
      await digitalAgreement.save();
    }

    res.json({
      message: "eSign process initiated successfully",
      redirectUrl: response.data.data.url, // Fixed: Use 'url' instead of 'redirect_url'
      transactionId: client_id, // Using client_id as per SurePass API documentation
    });
  } catch (error) {
    console.error("Surepass eSign initiation error:", error.message);

    if (error.response) {
      return res.status(error.response.status).json({
        message: "eSign initiation failed",
        error: error.response.data,
      });
    }

    res.status(500).json({
      message: "An error occurred while initiating eSign process",
      error: error.message,
    });
  }
};

// Webhook to receive eSign completion notification
const eSignWebhook = async (req, res) => {
  try {
    // Verify webhook signature if needed
    // const signature = req.headers['x-surepass-signature'];
    // const computedSignature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(JSON.stringify(req.body)).digest('hex');

    // if (signature !== computedSignature) {
    //   return res.status(401).json({ message: 'Invalid signature' });
    // }

    const { transaction_id, client_id, status, signed_document_url } = req.body.data;

    // Find the digital agreement by transaction ID - try multiple possible fields for flexibility
    // According to SurePass documentation and common integration patterns
    const digitalAgreement = await DigitalAgreement.findOne({
      $or: [
        { transactionId: transaction_id },  // Standard transaction_id field
        { transactionId: client_id },       // SurePass client_id field
        { transactionId: req.body.data.id } // Alternative id field sometimes used
      ]
    });

    if (!digitalAgreement) {
      return res.status(404).json({ message: "Digital agreement not found" });
    }

    // Update agreement status based on eSign status
    if (status === "completed") {
      // Download and save the signed document
      const response = await axios({
        method: "GET",
        url: signed_document_url,
        responseType: "stream",
      });

      // Generate filename for signed document
      const fileName = `signed_agreement_${Date.now()}_${digitalAgreement.userName.replace(
        /\s+/g,
        "_"
      )}.pdf`;
      const outputPath = path.resolve(
        __dirname,
        "../uploads/signed-agreements",
        fileName
      );

      // Ensure the directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Save the signed document
      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);

      // Wait for the file to be written
      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      // Update the digital agreement - set status to completed
      digitalAgreement.status = "completed";
      digitalAgreement.signedPdfPath = outputPath;
      await digitalAgreement.save();
    } else if (status === "failed") {
      digitalAgreement.status = "pending";
      await digitalAgreement.save();
    }

    res.json({ message: "Webhook received successfully" });
  } catch (error) {
    console.error("eSign webhook error:", error.message);
    res
      .status(500)
      .json({ message: "Webhook processing failed", error: error.message });
  }
};

// Create a new digital agreement for a franchise user
const createDigitalAgreement = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get the franchise associated with the user
    const franchise = await Franchise.findOne({ userId });

    if (!franchise) {
      return res.status(404).json({ message: "Franchise not found" });
    }

    // Get user details
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if an agreement already exists for this user
    const existingAgreement = await DigitalAgreement.findOne({ userId });

    if (existingAgreement) {
      return res
        .status(400)
        .json({ message: "Digital agreement already exists for this user" });
    }

    // Path to the shared template PDF
    const templatePath = path.resolve(
      __dirname,
      "../templates/franchise_agreement_template.pdf"
    );

    // Get user data for PDF editing
    const userData = {
      name: user.name,
      email: user.email,
      phone: user.mobile || "",
      pan: franchise.panNumber || "",
      aadhar: franchise.aadharNumber || "",
      address: franchise.businessAddress || "",
      packagePrice: "Rs. 0", // Default value to avoid encoding issues
    };

    // Generate PDF with user data
    const generatedPdfPath = await generatePdfWithUserData(
      templatePath,
      userData
    );

    // Create the digital agreement record
    const digitalAgreement = new DigitalAgreement({
      franchiseId: franchise._id,
      userId: userId,
      templatePath: templatePath,
      generatedPdfPath: generatedPdfPath,
      userName: user.name,
      status: "pending",
    });

    await digitalAgreement.save();

    res.status(201).json({
      message: "Digital agreement created successfully",
      agreement: digitalAgreement,
    });
  } catch (error) {
    console.error("Error creating digital agreement:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get digital agreement for a franchise user
const getDigitalAgreement = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find the digital agreement for the user
    let digitalAgreement = await DigitalAgreement.findOne({ userId })
      .populate("franchiseId", "businessName")
      .populate("userId", "name email");

    if (!digitalAgreement) {
      // Check if user has completed their profile with data from appropriate sources
      const franchise = await Franchise.findOne({ userId });

      if (!franchise) {
        return res.status(404).json({ message: "Franchise not found" });
      }

      // Get user details
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get KYC request to check for Aadhar number
      const kycRequest = await KycRequest.findOne({
        franchiseId: franchise._id,
      });

      // Check if profile is complete with data from appropriate sources
      // PAN should be in franchise record (from SurePass)
      // Aadhar should be in KYC request (from KYC submission)
      // Address should be in franchise record (manually entered) - either businessAddress or address structure
      // Phone should be in franchise record (manually entered)
      const isProfileComplete =
        franchise.panNumber &&
        (kycRequest?.aadhaarNumber || franchise.aadharNumber) &&
        (franchise.businessAddress ||
          (franchise.address?.street && franchise.address?.city)) &&
        franchise.phone;

      if (!isProfileComplete) {
        // Identify which fields are missing
        const missingFields = [];
        if (!franchise.panNumber)
          missingFields.push("PAN Number (from Profile)");
        if (!(kycRequest?.aadhaarNumber || franchise.aadharNumber))
          missingFields.push("Aadhar Number (from KYC)");
        if (
          !(
            franchise.businessAddress ||
            (franchise.address?.street && franchise.address?.city)
          )
        )
          missingFields.push("Business Address (from Profile)");
        if (!franchise.phone)
          missingFields.push("Mobile Number (from Profile)");

        // Profile is not complete, prompt user to update profile first
        return res.status(400).json({
          message: `Please complete your profile. Missing required fields: ${missingFields.join(
            ", "
          )}.`,
          requireProfileUpdate: true,
          missingFields: missingFields,
        });
      }

      // Check if user has purchased a package
      // In a real implementation, you would check if the user has an active package
      // For now, we'll assume they have a package if they've completed their profile

      // Path to the shared template PDF
      const templatePath = path.resolve(
        __dirname,
        "../templates/franchise_agreement_template.pdf"
      );

      // Check if template exists
      if (!fs.existsSync(templatePath)) {
        return res
          .status(500)
          .json({
            message:
              "Agreement template not found. Please contact administrator.",
          });
      }

      // Get user data for PDF editing
      // This data should come from verified sources (SurePass APIs) and manual entries
      const userData = {
        name: user.name,
        email: user.email,
        phone: franchise.phone || "", // Get phone from franchise record
        pan: franchise.panNumber || "",
        aadhar: kycRequest?.aadhaarNumber || franchise.aadharNumber || "",
        address:
          franchise.businessAddress ||
          (franchise.address
            ? `${franchise.address.street || ""}, ${
                franchise.address.city || ""
              }, ${franchise.address.state || ""} - ${
                franchise.address.pincode || ""
              }`.replace(/^, |, $/g, "")
            : ""),
        packagePrice: "Rs. 0", // Default value, will be updated when package is selected
      };

      // Generate PDF with user data
      const generatedPdfPath = await generatePdfWithUserData(
        templatePath,
        userData
      );

      // Create the digital agreement record
      digitalAgreement = new DigitalAgreement({
        franchiseId: franchise._id,
        userId: userId,
        templatePath: templatePath,
        generatedPdfPath: generatedPdfPath,
        userName: user.name,
        status: "pending",
      });

      await digitalAgreement.save();
    }

    res.json(digitalAgreement);
  } catch (error) {
    console.error("Error fetching digital agreement:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Download the generated PDF
const downloadGeneratedPdf = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find the digital agreement for the user
    const digitalAgreement = await DigitalAgreement.findOne({ userId });

    if (!digitalAgreement) {
      return res.status(404).json({ message: "Digital agreement not found" });
    }

    // Check if generated PDF exists
    if (!fs.existsSync(digitalAgreement.generatedPdfPath)) {
      return res.status(404).json({ message: "Generated PDF not found" });
    }

    // Update status to downloaded
    digitalAgreement.status = "downloaded";
    await digitalAgreement.save();

    // Set headers for PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=franchise_agreement_${digitalAgreement.userName.replace(
        /\s+/g,
        "_"
      )}.pdf`
    );

    // Send the PDF file
    res.sendFile(digitalAgreement.generatedPdfPath);
  } catch (error) {
    console.error("Error downloading PDF:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Submit the signed PDF (Deprecated - Auto-handled by webhook)
const submitSignedPdf = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find the digital agreement for the user
    const digitalAgreement = await DigitalAgreement.findOne({ userId });

    if (!digitalAgreement) {
      return res.status(404).json({ message: "Digital agreement not found" });
    }

    // Inform user that this process is now automated
    res.status(400).json({ 
      message: "Manual submission is no longer required. The system automatically tracks eSign completion via webhook."
    });
  } catch (error) {
    console.error("Error handling signed PDF submission:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ADMIN ROUTES

// Get all digital agreements (admin only)
const getAllDigitalAgreements = async (req, res) => {
  try {
    const agreements = await DigitalAgreement.find()
      .populate("franchiseId", "businessName")
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    res.json(agreements);
  } catch (error) {
    console.error("Error fetching digital agreements:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get a specific digital agreement by ID (admin only)
const getDigitalAgreementById = async (req, res) => {
  try {
    const { id } = req.params;

    const digitalAgreement = await DigitalAgreement.findById(id)
      .populate("franchiseId", "businessName")
      .populate("userId", "name email");

    if (!digitalAgreement) {
      return res.status(404).json({ message: "Digital agreement not found" });
    }

    res.json(digitalAgreement);
  } catch (error) {
    console.error("Error fetching digital agreement:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Approve a digital agreement (admin only)
const approveDigitalAgreement = async (req, res) => {
  try {
    const { id } = req.params;

    const digitalAgreement = await DigitalAgreement.findByIdAndUpdate(
      id,
      { status: "approved" },
      { new: true }
    )
      .populate("franchiseId", "businessName")
      .populate("userId", "name email");

    if (!digitalAgreement) {
      return res.status(404).json({ message: "Digital agreement not found" });
    }

    res.json({
      message: "Digital agreement approved successfully",
      agreement: digitalAgreement,
    });
  } catch (error) {
    console.error("Error approving digital agreement:", error);
    res.status(500).json({ message: "Server error", error: error.message });
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
        status: "rejected",
        rejectionReason: rejectionReason,
      },
      { new: true }
    )
      .populate("franchiseId", "businessName")
      .populate("userId", "name email");

    if (!digitalAgreement) {
      return res.status(404).json({ message: "Digital agreement not found" });
    }

    res.json({
      message: "Digital agreement rejected successfully",
      agreement: digitalAgreement,
    });
  } catch (error) {
    console.error("Error rejecting digital agreement:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Download signed PDF (admin only)
const downloadSignedPdf = async (req, res) => {
  try {
    const { id } = req.params;

    const digitalAgreement = await DigitalAgreement.findById(id);

    if (!digitalAgreement) {
      return res.status(404).json({ message: "Digital agreement not found" });
    }

    // Check if signed PDF exists
    if (
      !digitalAgreement.signedPdfPath ||
      !fs.existsSync(digitalAgreement.signedPdfPath)
    ) {
      return res.status(404).json({ message: "Signed PDF not found" });
    }

    // Set headers for PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=signed_agreement_${digitalAgreement.userName.replace(
        /\s+/g,
        "_"
      )}.pdf`
    );

    // Send the PDF file
    res.sendFile(digitalAgreement.signedPdfPath);
  } catch (error) {
    console.error("Error downloading signed PDF:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update function to set package price in existing agreement
const updateAgreementPackageDetails = async (userId, packageDetails) => {
  try {
    // Find the digital agreement for the user
    const digitalAgreement = await DigitalAgreement.findOne({ userId });

    if (!digitalAgreement) {
      throw new Error("Digital agreement not found");
    }

    // Get the latest franchise and user data to ensure we have current information
    const franchise = await Franchise.findOne({ userId });
    const user = await User.findById(userId);

    if (!franchise || !user) {
      throw new Error("Franchise or user not found");
    }

    // Update the package price in the PDF by regenerating it
    const templatePath = digitalAgreement.templatePath;

    // Get complete user data for PDF editing
    const userData = {
      name: user.name,
      email: user.email,
      phone: user.mobile || "",
      pan: franchise.panNumber || "",
      aadhar: franchise.aadharNumber || "",
      address: franchise.businessAddress || "",
      packagePrice: packageDetails.price || "Rs. 0",
    };

    // Regenerate the PDF with updated package details
    const generatedPdfPath = await generatePdfWithUserData(
      templatePath,
      userData
    );

    // Update the digital agreement record with new PDF path
    digitalAgreement.generatedPdfPath = generatedPdfPath;
    await digitalAgreement.save();

    console.log("Package details updated for user:", userId);

    return digitalAgreement;
  } catch (error) {
    console.error("Error updating agreement package details:", error);
    throw error;
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
  eSignWebhook,
  updateAgreementPackageDetails,
};

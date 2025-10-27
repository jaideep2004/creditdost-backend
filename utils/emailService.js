const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // Load environment variables

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Test the transporter
transporter.verify((error, success) => {
  if (error) {
    console.error('Nodemailer transporter verification failed:', error);
  } else {
    console.log('Nodemailer transporter is ready to send emails.');
  }
});

// Send registration email to user
const sendRegistrationEmail = async (user) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: 'Welcome to CreditDost Franchise Platform',
    html: `
      <h2>Welcome to CreditDost!</h2>
      <p>Hello ${user.name},</p>
      <p>Thank you for registering as a franchise partner with CreditDost.</p>
      <p>Your registration is currently pending approval. Our team will review your application and get back to you soon.</p>
      <p>Best regards,<br>The CreditDost Team</p>
    `,
  };
  
  return transporter.sendMail(mailOptions);
};

// Send registration notification email to admin
const sendAdminNotificationEmail = async (user) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER, // Fallback to EMAIL_USER if ADMIN_EMAIL not set
    subject: 'New Franchise Registration - CreditDost Platform',
    html: `
      <h2>New Franchise Registration</h2>
      <p>A new franchise user has registered on the CreditDost platform.</p>
      <p><strong>Name:</strong> ${user.name}</p>
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>Phone:</strong> ${user.phone}</p>
      <p><strong>State:</strong> ${user.state}</p>
      <p><strong>Pincode:</strong> ${user.pincode}</p>
      <p>Please review the application in the admin dashboard.</p>
      <p>Best regards,<br>The CreditDost System</p>
    `,
  };
  
  return transporter.sendMail(mailOptions);
};

// Send KYC approval email
const sendKycApprovalEmail = async (user, franchise) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: 'KYC Approved - CreditDost Franchise Platform',
    html: `
      <h2>KYC Approved!</h2>
      <p>Hello ${user.name},</p>
      <p>Congratulations! Your KYC documents have been approved.</p>
      <p>You can now access all the features of the CreditDost franchise platform.</p>
      <p>Best regards,<br>The CreditDost Team</p>
    `,
  };
  
  return transporter.sendMail(mailOptions);
};

// Send KYC rejection email
const sendKycRejectionEmail = async (user, franchise, reason) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: 'KYC Review - CreditDost Franchise Platform',
    html: `
      <h2>KYC Review Required</h2>
      <p>Hello ${user.name},</p>
      <p>We've reviewed your KYC documents, but unfortunately, we need some corrections:</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>Please log in to the platform and resubmit your KYC documents.</p>
      <p>Best regards,<br>The CreditDost Team</p>
    `,
  };
  
  return transporter.sendMail(mailOptions);
};

// Send account credentials email
const sendAccountCredentialsEmail = async (user, password) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: 'Your CreditDost Account Credentials',
    html: `
      <h2>Your Account Credentials</h2>
      <p>Hello ${user.name},</p>
      <p>Your franchise account has been approved! Here are your login credentials:</p>
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>Password:</strong> ${password}</p>
      <p>Please log in and change your password for security.</p>
      <p><a href="${process.env.FRONTEND_URL}/login">Login to your account</a></p>
      <p>Best regards,<br>The CreditDost Team</p>
    `,
  };
  
  return transporter.sendMail(mailOptions);
};

// Send payment success email
const sendPaymentSuccessEmail = async (user, transaction, pkg) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: 'Payment Successful - CreditDost Franchise Platform',
    html: `
      <h2>Payment Successful!</h2>
      <p>Hello ${user.name},</p>
      <p>Thank you for your payment. Here are the details:</p>
      <p><strong>Package:</strong> ${pkg.name}</p>
      <p><strong>Amount:</strong> ₹${transaction.amount}</p>
      <p><strong>Credits Added:</strong> ${pkg.creditsIncluded}</p>
      <p>Your credits have been added to your account and are ready to use.</p>
      <p>Best regards,<br>The CreditDost Team</p>
    `,
  };
  
  return transporter.sendMail(mailOptions);
};

module.exports = {
  sendRegistrationEmail,
  sendAdminNotificationEmail,
  sendKycApprovalEmail,
  sendKycRejectionEmail,
  sendAccountCredentialsEmail,
  sendPaymentSuccessEmail,
};
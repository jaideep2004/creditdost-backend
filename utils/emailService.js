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

// Send lead assignment email to franchise user
const sendLeadAssignmentEmail = async (franchiseUser, lead, adminUser) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: franchiseUser.email,
    subject: 'New Lead Assigned - CreditDost Platform',
    html: `
      <h2>New Lead Assigned</h2>
      <p>Hello ${franchiseUser.name},</p>
      <p>A new lead has been assigned to you by the admin team:</p>
      <p><strong>Lead Name:</strong> ${lead.name}</p>
      <p><strong>Email:</strong> ${lead.email || 'N/A'}</p>
      <p><strong>Phone:</strong> ${lead.phone}</p>
      <p><strong>Assigned by:</strong> ${adminUser.name}</p>
      <p>Please log in to the platform to view and manage this lead.</p>
      <p><a href="${process.env.FRONTEND_URL}/franchise/leads">View Leads</a></p>
      <p>Best regards,<br>The CreditDost Team</p>
    `,
  };
  
  return transporter.sendMail(mailOptions);
};

// Send lead approval email to admin
const sendLeadApprovalEmail = async (adminUser, lead, franchiseUser) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: adminUser.email,
    subject: 'Lead Approved - CreditDost Platform',
    html: `
      <h2>Lead Approved</h2>
      <p>Hello ${adminUser.name},</p>
      <p>The following lead has been approved by the franchise user:</p>
      <p><strong>Lead Name:</strong> ${lead.name}</p>
      <p><strong>Email:</strong> ${lead.email || 'N/A'}</p>
      <p><strong>Phone:</strong> ${lead.phone}</p>
      <p><strong>Approved by:</strong> ${franchiseUser.name}</p>
      <p><strong>Franchise:</strong> ${franchiseUser.franchise?.businessName || 'N/A'}</p>
      <p>Please log in to the admin dashboard to view the updated lead status.</p>
      <p><a href="${process.env.FRONTEND_URL}/admin/leads">View Leads</a></p>
      <p>Best regards,<br>The CreditDost System</p>
    `,
  };
  
  return transporter.sendMail(mailOptions);
};

// Send lead rejection email to admin
const sendLeadRejectionEmail = async (adminUser, lead, franchiseUser, reason) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: adminUser.email,
    subject: 'Lead Rejected - CreditDost Platform',
    html: `
      <h2>Lead Rejected</h2>
      <p>Hello ${adminUser.name},</p>
      <p>The following lead has been rejected by the franchise user:</p>
      <p><strong>Lead Name:</strong> ${lead.name}</p>
      <p><strong>Email:</strong> ${lead.email || 'N/A'}</p>
      <p><strong>Phone:</strong> ${lead.phone}</p>
      <p><strong>Rejected by:</strong> ${franchiseUser.name}</p>
      <p><strong>Franchise:</strong> ${franchiseUser.franchise?.businessName || 'N/A'}</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>Please log in to the admin dashboard to view the updated lead status.</p>
      <p><a href="${process.env.FRONTEND_URL}/admin/leads">View Leads</a></p>
      <p>Best regards,<br>The CreditDost System</p>
    `,
  };
  
  return transporter.sendMail(mailOptions);
};

// Send business form submission email
const sendBusinessFormSubmissionEmail = async (recipient, businessForm, franchise) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: recipient.email,
    subject: 'New Business Form Submission - CreditDost Platform',
    html: `
      <h2>New Business Form Submission</h2>
      <p>Hello ${recipient.name},</p>
      <p>A new business form has been submitted with the following details:</p>
      <p><strong>Customer Name:</strong> ${businessForm.customerName}</p>
      <p><strong>Customer Email:</strong> ${businessForm.customerEmail}</p>
      <p><strong>Customer Phone:</strong> ${businessForm.customerPhone}</p>
      <p><strong>PAN Number:</strong> ${businessForm.panNumber}</p>
      <p><strong>Aadhar Number:</strong> ${businessForm.aadharNumber}</p>
      <p><strong>State:</strong> ${businessForm.state}</p>
      <p><strong>Package Selected:</strong> ${businessForm.selectedPackage?.name || 'N/A'}</p>
      <p><strong>Franchise:</strong> ${franchise?.businessName || 'N/A'}</p>
      <p>Payment has been successfully processed.</p>
      <p>Please log in to the platform to view the complete details.</p>
      <p>Best regards,<br>The CreditDost Team</p>
    `,
  };
  
  return transporter.sendMail(mailOptions);
};

// Send referral email to referred user
const sendReferralEmail = async (referral, referrerFranchise) => {
  // Generate referral link
  const referralLink = referral.getReferralLink();
  
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: referral.referredEmail,
    subject: 'Franchise Opportunity - CreditDost Platform',
    html: `
      <h2>Franchise Opportunity from CreditDost!</h2>
      <p>Hello ${referral.referredName},</p>
      <p>Your friend ${referrerFranchise.ownerName} (${referrerFranchise.email}) has referred you to join CreditDost as a franchise partner.</p>
      <p>CreditDost is a leading platform for credit verification services, helping businesses make informed decisions.</p>
      <p><strong>Benefits of joining:</strong></p>
      <ul>
        <li>Access to multiple credit bureaus (CIBIL, CRIF, Experian, Equifax)</li>
        <li>Competitive pricing and revenue sharing</li>
        <li>Comprehensive dashboard and reporting tools</li>
        <li>Dedicated support team</li>
      </ul>
      <p>To get started, click the link below:</p>
      <p><a href="${referralLink}" style="background-color: #6200ea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Register as Franchise Partner</a></p>
      <p>Or copy and paste this link in your browser: ${referralLink}</p>
      <p>If you have any questions, feel free to contact us at ${process.env.EMAIL_USER}.</p>
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
  sendLeadAssignmentEmail,
  sendLeadApprovalEmail,
  sendLeadRejectionEmail,
  sendBusinessFormSubmissionEmail,
  sendReferralEmail,
};
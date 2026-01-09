const { google } = require('googleapis');
const GoogleSheet = require('../models/GoogleSheet');
const CreditReport = require('../models/CreditReport');
const BusinessForm = require('../models/BusinessForm');
const User = require('../models/User');
const CreditRepair = require('../models/CreditRepair');
const ContactForm = require('../models/ContactForm');
const FranchiseOpportunity = require('../models/FranchiseOpportunity');
const SuvidhaCentreApplication = require('../models/SuvidhaCentreApplication');
const crypto = require('crypto');

// Check if googleapis is properly installed
if (!google || !google.auth || !google.sheets) {
  throw new Error('Google APIs package not properly installed. Please run "npm install googleapis" in the Backend directory.');
}

class GoogleSheetsService {
  constructor() {
    this.auth = null;
    this.sheets = null;
  }

  // Initialize Google Sheets API client
  async initialize() {
    try {
      const settings = await GoogleSheet.findOne({ isActive: true });
      console.log('Google Sheets settings found:', !!settings);
      if (!settings) {
        throw new Error('Google Sheets integration not configured. Please configure the integration in the admin panel.');
      }

      // Check if credentials exist
      if (!settings.credentials) {
        throw new Error('Google Sheets credentials not found. Please upload your credentials JSON file.');
      }

      // Decrypt credentials (in a real implementation, you would decrypt these)
      const credentials = settings.credentials;
      console.log('Google Sheets credentials found:', !!credentials);
      console.log('Credentials client_email:', credentials.client_email);
      console.log('Credentials private_key exists:', !!credentials.private_key);
      
      // Validate required credential fields
      if (!credentials.client_email || !credentials.private_key) {
        throw new Error('Invalid Google Sheets credentials. Please check your credentials JSON file.');
      }
      
      // Create JWT client
      console.log('Creating JWT client with email:', credentials.client_email);
      console.log('Private key length:', credentials.private_key ? credentials.private_key.length : 0);
      this.auth = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      
      // Log the service account email for reference
      console.log('Service account email:', credentials.client_email);
      
      // Initialize sheets client
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      console.log('Google Sheets client initialized successfully');
      
      // Try to get an access token to verify authentication
      try {
        const token = await this.auth.getAccessToken();
        console.log('Access token obtained successfully:', !!token.token);
        if (token.token) {
          console.log('Access token length:', token.token.length);
        }
      } catch (tokenError) {
        console.error('Failed to get access token:', tokenError.message);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to initialize Google Sheets service:', error.message);
      console.error('Full error:', error);
      console.error('This usually means there is an issue with your credentials or the service account does not have access to the spreadsheet.');
      console.error('Please verify that:');
      console.error('1. You have uploaded a valid credentials JSON file');
      console.error('2. The Google Sheet is shared with the service account email from your credentials');
      console.error('Service account email:', credentials.client_email);
      console.error('Spreadsheet ID:', settings.spreadsheetId);
      return false;
    }
  }

  // Create required tabs in Google Sheet
  async createRequiredTabs(spreadsheetId) {
    try {
      console.log('Creating required tabs for spreadsheet:', spreadsheetId);
      const requiredTabs = [
        'Credit Score',
        'Apply for Loan',
        'Credit Score Repair',
        'Contact Us',
        'New Registration',
        'Franchise Opportunity',
        'Suvidha Centre'
      ]; 

      // Get existing sheets
      console.log('Getting spreadsheet info for ID:', spreadsheetId);
      let spreadsheet;
      try {
        spreadsheet = await this.sheets.spreadsheets.get({
          spreadsheetId: spreadsheetId
        });
        console.log('Got spreadsheet info:', !!spreadsheet);
        console.log('Spreadsheet data sheets count:', spreadsheet.data.sheets.length);
        
        // Log spreadsheet owner and permissions info
        if (spreadsheet.data.properties) {
          console.log('Spreadsheet title:', spreadsheet.data.properties.title);
        }
      } catch (getSpreadsheetError) {
        console.error('Failed to get spreadsheet info:', getSpreadsheetError.message);
        if (getSpreadsheetError.response && getSpreadsheetError.response.data) {
          console.error('Spreadsheet API error details:', getSpreadsheetError.response.data);
        }
        throw getSpreadsheetError;
      }

      const existingSheets = spreadsheet.data.sheets.map(sheet => sheet.properties.title);
      console.log('Existing sheets:', existingSheets);
      const sheetsToAdd = [];

      // Check which tabs need to be created
      for (const tabName of requiredTabs) {
        if (!existingSheets.includes(tabName)) {
          sheetsToAdd.push({
            addSheet: {
              properties: {
                title: tabName
              }
            }
          });
        }
      }

      console.log('Sheets to add:', sheetsToAdd.map(req => req.addSheet.properties.title));

      // Add missing tabs
      if (sheetsToAdd.length > 0) {
        console.log('Creating missing tabs:', sheetsToAdd.map(req => req.addSheet.properties.title));
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: spreadsheetId,
          resource: {
            requests: sheetsToAdd
          }
        });
        console.log('Created missing tabs:', sheetsToAdd.map(req => req.addSheet.properties.title));
      } else {
        console.log('All required tabs already exist');
      }

      return true;
    } catch (error) {
      console.error('Failed to create required tabs:', error.message);
      console.error('This usually means the service account does not have access to the spreadsheet.');
      console.error('Please make sure to share your Google Sheet with the service account email:', 
        credentials.client_email || 'Service account email not available');
      
      // Check if it's a specific permission error
      if (error.response && error.response.data && error.response.data.error) {
        const apiError = error.response.data.error;
        if (apiError.code === 403) {
          console.error('Permission denied. Please verify that:');
          console.error('1. The Google Sheet ID is correct');
          console.error('2. The service account email is shared with edit access to the spreadsheet');
          console.error('3. The credentials JSON file is valid and not expired');
        }
      }
      
      return false; 
    }
  }

  // Sync credit score data to Google Sheets
  async syncCreditScoreData() {
    try {
      console.log('Starting credit score data sync');
      const settings = await GoogleSheet.findOne({ isActive: true });
      if (!settings || !settings.tabs || !settings.tabs.get('creditScore')) {
        console.log('Credit score tab not configured');
        return { success: false, message: 'Credit score tab not configured' };
      }

      const tabSettings = settings.tabs.get('creditScore');
      if (!tabSettings || !tabSettings.enabled) {
        console.log('Credit score tab not enabled');
        return { success: false, message: 'Credit score tab not enabled' };
      }

      console.log('Credit score tab settings:', tabSettings);

      // Create required tabs if they don't exist
      const tabsCreated = await this.createRequiredTabs(settings.spreadsheetId);
      if (!tabsCreated) {
        console.log('Failed to create required tabs, aborting sync');
        return { success: false, message: 'Failed to create required tabs' };
      }

      // Get credit reports from database
      const creditReports = await CreditReport.find({}).populate('userId', 'name email').sort({ createdAt: -1 });
      console.log('Found credit reports:', creditReports.length);

      // Format data for Google Sheets
      const rows = [
        ['Name', 'Email', 'Phone', 'Credit Score', 'Date'], // Header row
        ...creditReports.map(report => [
          report.name,
          report.email || (report.userId ? report.userId.email : ''),
          report.mobile || '',
          report.score ? report.score.toString() : '',
          report.createdAt.toISOString().split('T')[0]
        ])
      ];

      console.log('Updating Google Sheet with', rows.length, 'rows');

      // Update Google Sheet
      console.log('Updating spreadsheet:', settings.spreadsheetId, 'range:', `Credit Score!A1:E${rows.length}`);
      const updateResult = await this.sheets.spreadsheets.values.update({
        spreadsheetId: settings.spreadsheetId,
        range: `Credit Score!A1:E${rows.length}`,
        valueInputOption: 'RAW',
        resource: {
          values: rows
        }
      });
      console.log('Update result:', !!updateResult);

      console.log('Google Sheet updated successfully');

      // Update last sync timestamp
      settings.tabs.set('creditScore', {
        ...tabSettings,
        lastSync: new Date()
      });
      await settings.save();

      console.log('Settings saved with updated sync timestamp');

      return { success: true, count: creditReports.length };
    } catch (error) {
      console.error('Failed to sync credit score data:', error);
      console.error('Credit score sync error details:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Sync business form data (apply for loan) to Google Sheets
  async syncBusinessFormData() {
    try {
      const settings = await GoogleSheet.findOne({ isActive: true });
      if (!settings || !settings.tabs || !settings.tabs.get('applyForLoan')) {
        return { success: false, message: 'Apply for loan tab not configured' };
      }

      const tabSettings = settings.tabs.get('applyForLoan');
      if (!tabSettings || !tabSettings.enabled) {
        return { success: false, message: 'Apply for loan tab not enabled' };
      }

      // Create required tabs if they don't exist
      const tabsCreated = await this.createRequiredTabs(settings.spreadsheetId);
      if (!tabsCreated) {
        console.log('Failed to create required tabs, aborting sync');
        return { success: false, message: 'Failed to create required tabs' };
      }

      // Get business forms from database
      const businessForms = await BusinessForm.find({}).populate('franchiseId', 'businessName').sort({ createdAt: -1 });

      // Format data for Google Sheets
      const rows = [
        ['Customer Name', 'Customer Email', 'Customer Phone', 'WhatsApp Number', 'PAN Number', 'Aadhar Number', 'City', 'State', 'Pincode', 'Occupation', 'Monthly Income', 'Credit Score', 'Loan Amount', 'Loan Purpose', 'Date'], // Header row
        ...businessForms.map(form => [
          form.customerName,
          form.customerEmail,
          form.customerPhone,
          form.whatsappNumber || '',
          form.panNumber || '',
          form.aadharNumber || '',
          form.city || '',
          form.state || '',
          form.pincode || '',
          form.occupation || '',
          form.monthlyIncome ? form.monthlyIncome.toString() : '',
          form.creditScore || '',
          form.loanAmount || '',
          form.loanPurpose || '',
          form.createdAt.toISOString().split('T')[0]
        ])
      ];

      // Update Google Sheet
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: settings.spreadsheetId,
        range: `Apply for Loan!A1:O${rows.length}`,
        valueInputOption: 'RAW',
        resource: {
          values: rows
        }
      });

      // Update last sync timestamp
      settings.tabs.set('applyForLoan', {
        ...tabSettings,
        lastSync: new Date()
      });
      await settings.save();

      return { success: true, count: businessForms.length };
    } catch (error) {
      console.error('Failed to sync business form data:', error);
      return { success: false, error: error.message };
    }
  }

  // Sync credit repair data to Google Sheets
  async syncCreditRepairData() {
    try {
      const settings = await GoogleSheet.findOne({ isActive: true });
      if (!settings || !settings.tabs || !settings.tabs.get('creditScoreRepair')) {
        return { success: false, message: 'Credit score repair tab not configured' };
      }

      const tabSettings = settings.tabs.get('creditScoreRepair');
      if (!tabSettings || !tabSettings.enabled) {
        return { success: false, message: 'Credit score repair tab not enabled' };
      }

      // Create required tabs if they don't exist
      const tabsCreated = await this.createRequiredTabs(settings.spreadsheetId);
      if (!tabsCreated) {
        console.log('Failed to create required tabs, aborting sync');
        return { success: false, message: 'Failed to create required tabs' };
      }

      // Get credit repair forms from database
      const creditRepairData = await CreditRepair.find({}).sort({ createdAt: -1 });

      // Format data for Google Sheets
      const rows = [
        ['Full Name', 'Email', 'Mobile Number', 'City', 'State', 'Problem Type', 'Credit Score', 'Message', 'Date'], // Header row
        ...creditRepairData.map(item => [
          item.fullName,
          item.email,
          item.mobileNumber,
          item.city || '',
          item.state || '',
          item.problemType || '',
          item.creditScore || '',
          item.message || '',
          item.createdAt ? item.createdAt.toISOString().split('T')[0] : ''
        ])
      ];

      // Update Google Sheet
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: settings.spreadsheetId,
        range: `Credit Score Repair!A1:I${rows.length}`,
        valueInputOption: 'RAW',
        resource: {
          values: rows
        }
      });

      // Update last sync timestamp
      settings.tabs.set('creditScoreRepair', {
        ...tabSettings,
        lastSync: new Date()
      });
      await settings.save();

      return { success: true, count: creditRepairData.length };
    } catch (error) {
      console.error('Failed to sync credit repair data:', error);
      return { success: false, error: error.message };
    }
  }

  // Sync contact form data to Google Sheets
  async syncContactFormData() {
    try {
      const settings = await GoogleSheet.findOne({ isActive: true });
      if (!settings || !settings.tabs || !settings.tabs.get('contactUs')) {
        return { success: false, message: 'Contact us tab not configured' };
      }

      const tabSettings = settings.tabs.get('contactUs');
      if (!tabSettings || !tabSettings.enabled) {
        return { success: false, message: 'Contact us tab not enabled' };
      }

      // Create required tabs if they don't exist
      const tabsCreated = await this.createRequiredTabs(settings.spreadsheetId);
      if (!tabsCreated) {
        console.log('Failed to create required tabs, aborting sync');
        return { success: false, message: 'Failed to create required tabs' };
      }

      // Get contact forms from database
      const contactData = await ContactForm.find({}).sort({ createdAt: -1 });

      // Format data for Google Sheets
      const rows = [
        ['Name', 'Email', 'Mobile Number', 'Subject', 'Message', 'Date'], // Header row
        ...contactData.map(item => [
          item.name,
          item.email,
          item.mobileNumber || '',
          item.subject || '',
          item.message || '',
          item.createdAt ? item.createdAt.toISOString().split('T')[0] : ''
        ])
      ];

      // Update Google Sheet
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: settings.spreadsheetId,
        range: `Contact Us!A1:F${rows.length}`,
        valueInputOption: 'RAW',
        resource: {
          values: rows
        }
      });

      // Update last sync timestamp
      settings.tabs.set('contactUs', {
        ...tabSettings,
        lastSync: new Date()
      });
      await settings.save();

      return { success: true, count: contactData.length };
    } catch (error) {
      console.error('Failed to sync contact form data:', error);
      return { success: false, error: error.message };
    }
  }

  // Sync registration data to Google Sheets
  async syncRegistrationData() {
    try {
      const settings = await GoogleSheet.findOne({ isActive: true });
      if (!settings || !settings.tabs || !settings.tabs.get('newRegistration')) {
        return { success: false, message: 'New registration tab not configured' };
      }

      const tabSettings = settings.tabs.get('newRegistration');
      if (!tabSettings || !tabSettings.enabled) {
        return { success: false, message: 'New registration tab not enabled' };
      }

      // Create required tabs if they don't exist
      const tabsCreated = await this.createRequiredTabs(settings.spreadsheetId);
      if (!tabsCreated) {
        console.log('Failed to create required tabs, aborting sync');
        return { success: false, message: 'Failed to create required tabs' };
      }

      // Get users from database with explicit field selection to ensure all fields are retrieved
      const users = await User.find({ role: 'franchise_user' })
        .select('name email phone state pincode language createdAt')
        .sort({ createdAt: -1 });

      // Format data for Google Sheets
      const rows = [
        ['Name', 'Email', 'Phone', 'State', 'Pincode', 'Language', 'Date'], // Header row
        ...users.map(user => [
          user.name || '',
          user.email || '',
          user.phone || '',
          user.state || '',
          user.pincode || '',
          user.language || '',
          user.createdAt ? user.createdAt.toISOString().split('T')[0] : ''
        ])
      ];

      // Update Google Sheet
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: settings.spreadsheetId,
        range: `New Registration!A1:G${rows.length}`,
        valueInputOption: 'RAW',
        resource: {
          values: rows
        }
      });

      // Update last sync timestamp
      settings.tabs.set('newRegistration', {
        ...tabSettings,
        lastSync: new Date()
      });
      await settings.save();

      return { success: true, count: users.length };
    } catch (error) {
      console.error('Failed to sync registration data:', error);
      return { success: false, error: error.message };
    }
  }

  // Sync all data to Google Sheets
  async syncAllData() {
    console.log('Starting sync of all data');
    const results = {
      creditScore: await this.syncCreditScoreData(),
      businessForm: await this.syncBusinessFormData(),
      creditRepair: await this.syncCreditRepairData(),
      contactForm: await this.syncContactFormData(),
      registration: await this.syncRegistrationData(),
      franchiseOpportunity: await this.syncFranchiseOpportunityData(),
      suvidhaCentreApplication: await this.syncSuvidhaCentreApplicationData()
    };
    
    console.log('All data sync completed with results:', results);
    return results;
  }

  // Sync franchise opportunity data to Google Sheets
  async syncFranchiseOpportunityData() {
    try {
      const settings = await GoogleSheet.findOne({ isActive: true });
      if (!settings || !settings.tabs || !settings.tabs.get('franchiseOpportunity')) {
        return { success: false, message: 'Franchise opportunity tab not configured' };
      }

      const tabSettings = settings.tabs.get('franchiseOpportunity');
      if (!tabSettings || !tabSettings.enabled) {
        return { success: false, message: 'Franchise opportunity tab not enabled' };
      }

      // Create required tabs if they don't exist
      const tabsCreated = await this.createRequiredTabs(settings.spreadsheetId);
      if (!tabsCreated) {
        console.log('Failed to create required tabs, aborting sync');
        return { success: false, message: 'Failed to create required tabs' };
      }

      // Get franchise opportunity forms from database
      const franchiseOpportunityData = await FranchiseOpportunity.find({}).sort({ createdAt: -1 });

      // Format data for Google Sheets
      const rows = [
        ['Full Name', 'Email', 'Mobile Number', 'City', 'State', 'Profession', 'Message', 'Consent', 'Date'], // Header row
        ...franchiseOpportunityData.map(item => [
          item.fullName,
          item.email,
          item.mobileNumber,
          item.city || '',
          item.state || '',
          item.profession || '',
          item.message || '',
          item.consent ? 'Yes' : 'No',
          item.createdAt ? item.createdAt.toISOString().split('T')[0] : ''
        ])
      ];

      // Update Google Sheet
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: settings.spreadsheetId,
        range: `Franchise Opportunity!A1:I${rows.length}`,
        valueInputOption: 'RAW',
        resource: {
          values: rows
        }
      });

      // Update last sync timestamp
      settings.tabs.set('franchiseOpportunity', {
        ...tabSettings,
        lastSync: new Date()
      });
      await settings.save();

      return { success: true, count: franchiseOpportunityData.length };
    } catch (error) {
      console.error('Failed to sync franchise opportunity data:', error);
      return { success: false, error: error.message };
    }
  }

  // Sync suvidha centre application data to Google Sheets
  async syncSuvidhaCentreApplicationData() {
    try {
      const settings = await GoogleSheet.findOne({ isActive: true });
      if (!settings || !settings.spreadsheetId) {
        return { success: false, message: 'Google Sheets integration not configured' };
      }

      // Check if suvidhaCentre tab exists in settings, if not, create default configuration
      let tabSettings = settings.tabs.get('suvidhaCentre');
      if (!tabSettings) {
        // Create default configuration for suvidhaCentre tab
        settings.tabs.set('suvidhaCentre', {
          enabled: true,
          lastSync: null
        });
        await settings.save();
        tabSettings = settings.tabs.get('suvidhaCentre');
        console.log('Created default suvidhaCentre tab configuration');
      }
      
      if (!tabSettings.enabled) {
        return { success: false, message: 'Suvidha Centre tab not enabled' };
      }

      // Create required tabs if they don't exist
      const tabsCreated = await this.createRequiredTabs(settings.spreadsheetId);
      if (!tabsCreated) {
        console.log('Failed to create required tabs, aborting sync');
        return { success: false, message: 'Failed to create required tabs' };
      }

      // Get suvidha centre applications from database
      const suvidhaCentreApplications = await SuvidhaCentreApplication.find({}).sort({ createdAt: -1 });

      // Format data for Google Sheets
      const rows = [
        ['Full Name', 'Mobile Number', 'WhatsApp Number', 'Email', 'City', 'State', 'Pincode', 'Occupation', 'Finance Experience', 'Smartphone/Laptop', 'Communication Skills', 'Investment Readiness', 'Consent', 'Date'], // Header row
        ...suvidhaCentreApplications.map(application => [
          application.fullName,
          application.mobileNumber,
          application.whatsappNumber || '',
          application.email,
          application.city || '',
          application.state || '',
          application.pincode || '',
          application.occupation || '',
          application.financeExperience || '',
          application.smartphoneLaptop || '',
          application.communication || '',
          application.investmentReadiness || '',
          application.consent ? 'Yes' : 'No',
          application.createdAt ? application.createdAt.toISOString().split('T')[0] : ''
        ])
      ];

      // Update Google Sheet
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: settings.spreadsheetId,
        range: `Suvidha Centre!A1:N${rows.length}`,
        valueInputOption: 'RAW',
        resource: {
          values: rows
        }
      });

      // Update last sync timestamp
      settings.tabs.set('suvidhaCentre', {
        ...tabSettings,
        lastSync: new Date()
      });
      await settings.save();

      return { success: true, count: suvidhaCentreApplications.length };
    } catch (error) {
      console.error('Failed to sync suvidha centre application data:', error);
      return { success: false, error: error.message };
    }
  }

  // Encrypt credentials (simplified - in production use proper encryption)
  encryptCredentials(credentials) {
    console.log('Encrypting credentials');
    // In a real implementation, you would use proper encryption
    return credentials;
  }

  // Decrypt credentials (simplified - in production use proper decryption)
  decryptCredentials(encryptedCredentials) {
    console.log('Decrypting credentials');
    // In a real implementation, you would use proper decryption
    return encryptedCredentials;
  }
}

module.exports = new GoogleSheetsService();
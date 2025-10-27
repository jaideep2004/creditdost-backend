const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Package = require('./models/Package');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Connect to database
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/franchise_management', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Sample packages data
const packages = [
  {
    name: 'Starter Package',
    description: 'Perfect for new franchise partners to get started',
    price: 2999,
    creditsIncluded: 50,
    validityDays: 30,
    features: [
      '50 credit reports',
      'Basic dashboard',
      'Email support',
      'Access to leads management',
    ],
    sortOrder: 1,
  },
  {
    name: 'Professional Package',
    description: 'Ideal for growing franchise businesses',
    price: 5999,
    creditsIncluded: 125,
    validityDays: 60,
    features: [
      '125 credit reports',
      'Advanced dashboard',
      'Priority email support',
      'Access to leads management',
      'Referral program',
      'Business MIS reports',
    ],
    sortOrder: 2,
  },
  {
    name: 'Enterprise Package',
    description: 'Complete solution for established franchise partners',
    price: 9999,
    creditsIncluded: 250,
    validityDays: 90,
    features: [
      '250 credit reports',
      'Premium dashboard with analytics',
      '24/7 priority support',
      'Access to all features',
      'Advanced referral program',
      'Custom business MIS reports',
      'AI-powered insights',
    ],
    sortOrder: 3,
  },
];

// Seed function
const seed = async () => {
  try {
    // Clear existing data
    await User.deleteMany({ role: 'admin' });
    await Package.deleteMany({});
    
    console.log('Existing data cleared');
    
    // Create admin user
    const adminPassword = await bcrypt.hash('admin@123', 10);
    
    const adminUser = new User({
      name: 'Admin User',
      email: 'admin@gmail.com',
      phone: '9876543210',
      password: adminPassword,
      role: 'admin',
      isActive: true, 
      isVerified: true,
    });
    
    await adminUser.save();
    
    console.log('Admin user created');
    
    // Create sample packages
    for (const pkg of packages) {
      const package = new Package(pkg);
      await package.save();
    }
    
    console.log('Sample packages created');
    
    console.log('Seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

// Run seed function
seed();
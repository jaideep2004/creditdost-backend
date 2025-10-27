const multer = require('multer');
const multerS3 = require('multer-s3');
const aws = require('aws-sdk');

// Configure AWS S3
const s3 = new aws.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// File filter for documents
const fileFilter = (req, file, cb) => {
  // Accept images only
  if (!file.originalname.match(/\.(jpg|jpeg|png|pdf)$/)) {
    return cb(new Error('Only image and PDF files are allowed!'), false);
  }
  cb(null, true);
};

// Storage configuration for local development
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

// Storage configuration for S3
const s3Storage = multerS3({
  s3: s3,
  bucket: process.env.AWS_S3_BUCKET_NAME,
  metadata: (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req, file, cb) => {
    cb(null, `kyc-documents/${Date.now()}-${file.originalname}`);
  },
});

// Choose storage based on environment
const storage = process.env.NODE_ENV === 'production' ? s3Storage : localStorage;

// Multer upload configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Virus scan placeholder function
const virusScan = async (file) => {
  // In a real implementation, you would integrate with a virus scanning service
  // For now, we'll just return true to simulate a successful scan
  console.log(`Virus scan placeholder for file: ${file.originalname}`);
  return true;
};

module.exports = {
  upload,
  virusScan,
};
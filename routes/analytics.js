const express = require('express');
const router = express.Router();
const { 
  getVisitorStats, 
  getRealTimeVisitors, 
  getVisitorTrends 
} = require('../controllers/analyticsController');
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/rbac');

// All analytics routes require admin authentication
router.use(authenticateToken, authorizeRoles(['admin']));

// Get comprehensive visitor statistics
router.get('/visitors', getVisitorStats);

// Get real-time visitor count
router.get('/visitors/realtime', getRealTimeVisitors);

// Get visitor trends for charts
router.get('/visitors/trends', getVisitorTrends);

module.exports = router;
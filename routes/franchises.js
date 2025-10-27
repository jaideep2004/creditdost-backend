const express = require('express');
const {
  getFranchiseProfile,
  updateFranchiseProfile,
  getAllFranchises,
  getFranchiseById,
  updateFranchise,
  deactivateFranchise,
  activateFranchise,
} = require('../controllers/franchiseController');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');

const router = express.Router();

// @route   GET /api/franchises/profile
// @desc    Get franchise profile
// @access  Private/Franchise User
router.get('/profile', auth, rbac('franchise_user'), getFranchiseProfile);

// @route   PUT /api/franchises/profile
// @desc    Update franchise profile
// @access  Private/Franchise User
router.put('/profile', auth, rbac('franchise_user'), updateFranchiseProfile);

// @route   GET /api/franchises
// @desc    Get all franchises
// @access  Private/Admin
router.get('/', auth, rbac('admin'), getAllFranchises);

// @route   GET /api/franchises/:id
// @desc    Get franchise by ID
// @access  Private/Admin
router.get('/:id', auth, rbac('admin'), getFranchiseById);

// @route   PUT /api/franchises/:id
// @desc    Update franchise
// @access  Private/Admin
router.put('/:id', auth, rbac('admin'), updateFranchise);

// @route   PUT /api/franchises/:id/deactivate
// @desc    Deactivate franchise
// @access  Private/Admin
router.put('/:id/deactivate', auth, rbac('admin'), deactivateFranchise);

// @route   PUT /api/franchises/:id/activate
// @desc    Activate franchise
// @access  Private/Admin
router.put('/:id/activate', auth, rbac('admin'), activateFranchise);

module.exports = router;
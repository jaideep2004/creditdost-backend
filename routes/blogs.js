const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const {
  getAllBlogs,
  getBlogBySlug,
  createBlog,
  updateBlog,
  deleteBlog,
  getAdminBlogs,
  getBlogCategories,
  getRecentBlogs,
  getBlogTags
} = require('../controllers/blogController');   

// Admin routes
router.route('/admin')
  .get(auth, rbac('admin'), getAdminBlogs)
  .post(auth, rbac('admin'), createBlog);

router.route('/admin/:id')
  .put(auth, rbac('admin'), updateBlog)
  .delete(auth, rbac('admin'), deleteBlog);

// Public routes
router.route('/')
  .get(getAllBlogs);

router.route('/categories')
  .get(getBlogCategories);

router.route('/recent')
  .get(getRecentBlogs);

router.route('/tags')
  .get(getBlogTags);

router.route('/:slug')
  .get(getBlogBySlug);

module.exports = router;
const Blog = require('../models/Blog');
const User = require('../models/User');
const mongoose = require('mongoose');

// Helper function to generate slug
const generateSlug = (title) => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim('-');
};

// @desc    Get all blogs
// @route   GET /api/blogs
// @access  Public
exports.getAllBlogs = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search, category } = req.query;
    
    // Build filter
    const filter = { status: 'published' }; // Default to published blogs for public API
    if (status && status !== 'published') {
      filter.status = status;
    }
    
    // Add category filter
    if (category) {
      filter.categories = { $in: [category] };
    }
    
    // Add search functionality
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
        { categories: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    // Get blogs with pagination
    const blogs = await Blog.find(filter)
      .populate('author', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    // Get total count
    const total = await Blog.countDocuments(filter);
    
    res.json({
      blogs,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get blog by slug
// @route   GET /api/blogs/:slug
// @access  Public
exports.getBlogBySlug = async (req, res) => {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug })
      .populate('author', 'name email');
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' });
    }
    
    // Increment views
    blog.views += 1;
    await blog.save();
    
    res.json(blog);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Create a new blog
// @route   POST /api/admin/blogs
// @access  Private/Admin
exports.createBlog = async (req, res) => {
  try {
    const { title, content, excerpt, status, tags, categories, featuredImage } = req.body;
    
    // Generate slug
    let slug = generateSlug(title);
    
    // Check if slug already exists
    let existingBlog = await Blog.findOne({ slug });
    let counter = 1;
    while (existingBlog) {
      slug = `${generateSlug(title)}-${counter}`;
      existingBlog = await Blog.findOne({ slug });
      counter++;
    }
    
    // Create blog
    const blog = new Blog({
      title,
      slug,
      content,
      excerpt,
      featuredImage,
      author: req.user.id,
      status,
      tags: tags || [],
      categories: categories || []
    });
    
    const createdBlog = await blog.save();
    
    // Populate author info
    await createdBlog.populate('author', 'name email');
    
    res.status(201).json(createdBlog);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update a blog
// @route   PUT /api/admin/blogs/:id
// @access  Private/Admin
exports.updateBlog = async (req, res) => {
  try {
    const { title, content, excerpt, status, tags, categories, featuredImage } = req.body;
    
    let blog = await Blog.findById(req.params.id);
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' });
    }
    
    // Generate new slug if title changed
    let slug = blog.slug;
    if (title && title !== blog.title) {
      slug = generateSlug(title);
      
      // Check if slug already exists (excluding current blog)
      let existingBlog = await Blog.findOne({ slug, _id: { $ne: req.params.id } });
      let counter = 1;
      while (existingBlog) {
        slug = `${generateSlug(title)}-${counter}`;
        existingBlog = await Blog.findOne({ slug, _id: { $ne: req.params.id } });
        counter++;
      }
    }
    
    // Update blog fields
    blog.title = title || blog.title;
    blog.slug = slug;
    blog.content = content || blog.content;
    blog.excerpt = excerpt || blog.excerpt;
    blog.featuredImage = featuredImage || blog.featuredImage;
    blog.status = status || blog.status;
    blog.tags = tags || blog.tags;
    blog.categories = categories || blog.categories;
    
    const updatedBlog = await blog.save();
    
    // Populate author info
    await updatedBlog.populate('author', 'name email');
    
    res.json(updatedBlog);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete a blog
// @route   DELETE /api/admin/blogs/:id
// @access  Private/Admin
exports.deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' });
    }
    
    await Blog.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Blog removed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get blogs for admin
// @route   GET /api/admin/blogs
// @access  Private/Admin
exports.getAdminBlogs = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search, category } = req.query;
    
    // Build filter
    const filter = {};
    if (status) {
      filter.status = status;
    }
    
    // Add category filter
    if (category) {
      filter.categories = { $in: [category] };
    }
    
    // Add search functionality
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
        { categories: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    // Get blogs with pagination
    const blogs = await Blog.find(filter)
      .populate('author', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    // Get total count
    const total = await Blog.countDocuments(filter);
    
    res.json({
      blogs,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all unique categories with counts
// @route   GET /api/blogs/categories
// @access  Public
exports.getBlogCategories = async (req, res) => {
  try {
    // Get all blogs with their categories
    const blogs = await Blog.find({ status: 'published' }, 'categories');
    
    // Count occurrences of each category
    const categoryCounts = {};
    blogs.forEach(blog => {
      if (blog.categories && Array.isArray(blog.categories)) {
        blog.categories.forEach(category => {
          if (category && category.trim() !== '') {
            const trimmedCategory = category.trim();
            categoryCounts[trimmedCategory] = (categoryCounts[trimmedCategory] || 0) + 1;
          }
        });
      }
    });
    
    // Convert to array format
    const categories = Object.keys(categoryCounts).map(category => ({
      name: category,
      count: categoryCounts[category]
    }));
    
    res.json({ categories });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

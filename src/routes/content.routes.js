const express = require('express');
const { body, validationResult } = require('express-validator');
const Content = require('../models/Content');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// GET /api/content
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, type, page = 1, limit = 10, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (search) filter.$text = { $search: search };

    const contents = await Content.find(filter)
      .populate('author', 'name email')
      .populate('campaign', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Content.countDocuments(filter);
    res.json({ contents, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/content/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const content = await Content.findById(req.params.id)
      .populate('author', 'name email')
      .populate('campaign', 'name');
    if (!content) return res.status(404).json({ error: 'Content not found' });
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/content
router.post(
  '/',
  authenticate,
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('body').notEmpty().withMessage('Body is required'),
    body('type').isIn(['article', 'blog', 'social_post', 'email', 'video_script', 'infographic']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const content = await Content.create({ ...req.body, author: req.user._id });
      res.status(201).json({ content });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// PUT /api/content/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const content = await Content.findOneAndUpdate(
      { _id: req.params.id, author: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!content) return res.status(404).json({ error: 'Content not found or unauthorized' });
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/content/:id
router.delete('/:id', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const content = await Content.findByIdAndDelete(req.params.id);
    if (!content) return res.status(404).json({ error: 'Content not found' });
    res.json({ message: 'Content deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

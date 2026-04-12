const express = require('express');
const { body, validationResult } = require('express-validator');
const Campaign = require('../models/Campaign');
const Content = require('../models/Content');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// GET /api/campaigns
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const campaigns = await Campaign.find(filter)
      .populate('owner', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Campaign.countDocuments(filter);
    res.json({ campaigns, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/campaigns/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id).populate('owner', 'name email');
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const contents = await Content.find({ campaign: campaign._id }).select('title type status');
    res.json({ campaign, contents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns
router.post(
  '/',
  authenticate,
  [
    body('name').trim().notEmpty().withMessage('Campaign name is required'),
    body('startDate').isISO8601().withMessage('Valid start date is required'),
    body('endDate').isISO8601().withMessage('Valid end date is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const campaign = await Campaign.create({ ...req.body, owner: req.user._id });
      res.status(201).json({ campaign });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// PUT /api/campaigns/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const campaign = await Campaign.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!campaign) return res.status(404).json({ error: 'Campaign not found or unauthorized' });
    res.json({ campaign });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/campaigns/:id
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const campaign = await Campaign.findByIdAndDelete(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json({ message: 'Campaign deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

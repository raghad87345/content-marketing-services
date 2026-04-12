const express = require('express');
const Content = require('../models/Content');
const Campaign = require('../models/Campaign');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// GET /api/analytics/overview
router.get('/overview', authenticate, async (req, res) => {
  try {
    const [totalContent, totalCampaigns, publishedContent, activeCampaigns] = await Promise.all([
      Content.countDocuments(),
      Campaign.countDocuments(),
      Content.countDocuments({ status: 'published' }),
      Campaign.countDocuments({ status: 'active' }),
    ]);

    const contentByType = await Content.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);

    const contentByStatus = await Content.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    res.json({
      overview: { totalContent, totalCampaigns, publishedContent, activeCampaigns },
      contentByType,
      contentByStatus,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/campaigns/:id
router.get('/campaigns/:id', authenticate, async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const contentStats = await Content.aggregate([
      { $match: { campaign: campaign._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalViews: { $sum: '$views' },
          totalLikes: { $sum: '$likes' },
        },
      },
    ]);

    res.json({ campaign: campaign.metrics, contentStats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/top-content
router.get('/top-content', authenticate, async (req, res) => {
  try {
    const topContent = await Content.find({ status: 'published' })
      .sort({ views: -1, likes: -1 })
      .limit(10)
      .select('title type views likes publishedAt')
      .populate('author', 'name');

    res.json({ topContent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

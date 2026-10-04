'use strict';

const express = require('express');
const { asyncHandler } = require('../lib/errors');
const { listTrends, PLATFORMS, NICHES, REGIONS, GOALS } = require('../lib/trends');
const { authenticate, withBrand } = require('../middleware/auth');

const router = express.Router();

router.get('/filters', (_req, res) => {
  res.json({ platforms: PLATFORMS, niches: NICHES, regions: REGIONS, goals: GOALS });
});

router.get(
  '/',
  authenticate,
  withBrand,
  asyncHandler(async (req, res) => {
    const { platform, niche, region, goal } = req.query;
    const trends = listTrends({
      platform: platform || req.brand.platforms?.[0] || 'instagram',
      niche: niche || req.brand.niche,
      region: region || req.brand.region,
      goal: goal || req.brand.goal,
    });
    res.json({
      trends,
      appliedFilters: {
        platform: platform || req.brand.platforms?.[0] || 'instagram',
        niche: niche || req.brand.niche,
        region: region || req.brand.region,
        goal: goal || req.brand.goal,
      },
      source:
        'مكتبة فورمات مُنسّقة داخل MOHTAWA — الترتيب محسوب من زخم الفورمات وتشبعه ومدى ملاءمته لمنصتك ومجالك.',
      updatedAt: new Date().toISOString(),
    });
  })
);

module.exports = router;

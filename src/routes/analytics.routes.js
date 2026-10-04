'use strict';

const express = require('express');
const { db } = require('../db/store');
const { asyncHandler } = require('../lib/errors');
const {
  buildOverview,
  topContent,
  buildLearnings,
  buildRecommendations,
} = require('../lib/analytics');
const { authenticate, withBrand } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, withBrand);

const brandContents = (brandId) => db.contents.find({ brandId });

router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    const contents = brandContents(req.brand.id);
    res.json({
      overview: buildOverview(contents, days),
      top: topContent(contents),
      ...buildLearnings(contents),
      recommendations: buildRecommendations(contents, req.brand),
    });
  })
);

/** Home dashboard: the few numbers worth seeing first thing in the morning. */
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const contents = brandContents(req.brand.id);
    const overview = buildOverview(contents, 30);
    const now = new Date();
    const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcoming = contents
      .filter(
        (content) =>
          content.status === 'scheduled' &&
          content.scheduledFor &&
          new Date(content.scheduledFor) >= now &&
          new Date(content.scheduledFor) <= weekAhead
      )
      .sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));

    res.json({
      brand: req.brand,
      counts: {
        ideas: db.ideas.count({ brandId: req.brand.id }),
        scheduled: contents.filter((c) => c.status === 'scheduled').length,
        published: contents.filter((c) => c.status === 'published').length,
      },
      overview,
      upcoming,
      recommendations: buildRecommendations(contents, req.brand),
      learnings: buildLearnings(contents).learnings,
    });
  })
);

module.exports = router;

'use strict';

const express = require('express');
const { body } = require('express-validator');
const { db } = require('../db/store');
const { asyncHandler } = require('../lib/errors');
const { buildMonthPlan } = require('../lib/planner');
const { authenticate, withBrand } = require('../middleware/auth');
const { handleValidation } = require('../middleware/error');

const router = express.Router();
router.use(authenticate, withBrand);

const monthOf = (query) => {
  const now = new Date();
  return {
    year: Number(query.year) || now.getUTCFullYear(),
    month: Number(query.month) || now.getUTCMonth() + 1,
  };
};

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { year, month } = monthOf(req.query);
    const plan = buildMonthPlan({
      year,
      month,
      perWeek: req.brand.postsPerWeek,
      goal: req.brand.goal,
      niche: req.brand.niche,
      platform: req.brand.platforms?.[0] || 'instagram',
    });

    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const scheduled = db.contents
      .find({ brandId: req.brand.id })
      .filter((content) => (content.scheduledFor || '').startsWith(prefix));

    // A suggested slot disappears once the user has real content on that day.
    const takenDates = new Set(scheduled.map((content) => content.scheduledFor.slice(0, 10)));
    const suggestions = plan.slots.filter((slot) => !takenDates.has(slot.date));

    res.json({ plan: { ...plan, slots: suggestions }, scheduled, month, year });
  })
);

router.post(
  '/apply',
  [
    body('slots').isArray({ min: 1 }).withMessage('اختر خانة واحدة على الأقل.'),
    body('slots.*.date').isISO8601().withMessage('تاريخ غير صحيح.'),
  ],
  handleValidation,
  asyncHandler(async (req, res) => {
    const created = [];
    for (const slot of req.body.slots) {
      const date = String(slot.date).slice(0, 10);
      const already = db.contents
        .find({ brandId: req.brand.id })
        .some((content) => (content.scheduledFor || '').slice(0, 10) === date && content.status === 'scheduled');
      if (already) continue;
      created.push(
        await db.contents.insert({
          ownerId: req.user.id,
          brandId: req.brand.id,
          title: slot.suggestion || 'محتوى مجدول',
          body: '',
          hook: '',
          caption: '',
          cta: '',
          format: slot.format || 'Reel',
          platform: req.brand.platforms?.[0] || 'instagram',
          pillar: ['reach', 'trust', 'conversion'].includes(slot.pillar) ? slot.pillar : 'reach',
          status: 'scheduled',
          trendKey: slot.trendKey || null,
          scheduledFor: `${date}T09:00:00.000Z`,
          publishedAt: null,
          metrics: {},
        })
      );
    }
    res.status(201).json({ created, count: created.length });
  })
);

module.exports = router;

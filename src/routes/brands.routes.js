'use strict';

const express = require('express');
const { body } = require('express-validator');
const { db } = require('../db/store');
const { ApiError, asyncHandler } = require('../lib/errors');
const { limitFor } = require('../lib/plans');
const { NICHES, PLATFORMS, GOALS, REGIONS } = require('../lib/trends');
const { authenticate } = require('../middleware/auth');
const { handleValidation } = require('../middleware/error');

const router = express.Router();
router.use(authenticate);

const nicheIds = NICHES.map((n) => n.id);
const platformIds = PLATFORMS.map((p) => p.id);
const goalIds = GOALS.map((g) => g.id);
const regionIds = REGIONS.map((r) => r.id);

const brandRules = [
  body('name').trim().isLength({ min: 2 }).withMessage('اسم البراند مطلوب.'),
  body('niche').optional().isIn(nicheIds).withMessage('المجال غير معروف.'),
  body('goal').optional().isIn(goalIds).withMessage('الهدف غير معروف.'),
  body('region').optional().isIn(regionIds).withMessage('المنطقة غير معروفة.'),
  body('platforms').optional().isArray().withMessage('المنصات يجب أن تكون قائمة.'),
  body('postsPerWeek').optional().isInt({ min: 1, max: 14 }).withMessage('عدد المنشورات بين 1 و14.'),
];

/** Everything the studio and radar need to speak in the brand's voice. */
const brandPayload = (source, ownerId) => ({
  ownerId,
  name: String(source.name).trim(),
  niche: nicheIds.includes(source.niche) ? source.niche : 'marketing',
  goal: goalIds.includes(source.goal) ? source.goal : 'reach',
  region: regionIds.includes(source.region) ? source.region : 'sa',
  platforms: Array.isArray(source.platforms)
    ? source.platforms.filter((p) => platformIds.includes(p))
    : ['instagram'],
  audience: String(source.audience || '').trim(),
  voice: String(source.voice || '').trim(),
  offer: String(source.offer || '').trim(),
  tone: ['saudi', 'msa', 'casual', 'professional'].includes(source.tone) ? source.tone : 'saudi',
  postsPerWeek: Number(source.postsPerWeek) || 3,
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ brands: db.brands.find({ ownerId: req.user.id }, { sort: { createdAt: 'asc' } }) });
  })
);

router.post(
  '/',
  brandRules,
  handleValidation,
  asyncHandler(async (req, res) => {
    const limit = limitFor(req.user.plan, 'brands');
    if (db.brands.count({ ownerId: req.user.id }) >= limit) {
      throw ApiError.quotaExceeded(`باقتك تسمح بـ${limit} براند. رقِّ الباقة لإضافة المزيد.`);
    }
    const brand = await db.brands.insert(brandPayload(req.body, req.user.id));
    if (!req.user.onboardingCompleted) {
      await db.users.update({ id: req.user.id }, { onboardingCompleted: true });
    }
    res.status(201).json({ brand });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const brand = db.brands.findOne({ id: req.params.id });
    if (!brand || brand.ownerId !== req.user.id) throw ApiError.notFound('البراند غير موجود.');
    res.json({ brand });
  })
);

router.put(
  '/:id',
  brandRules,
  handleValidation,
  asyncHandler(async (req, res) => {
    const existing = db.brands.findOne({ id: req.params.id });
    if (!existing || existing.ownerId !== req.user.id) throw ApiError.notFound('البراند غير موجود.');
    const brand = await db.brands.update(
      { id: req.params.id },
      brandPayload({ ...existing, ...req.body }, req.user.id)
    );
    res.json({ brand });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const brand = db.brands.findOne({ id: req.params.id });
    if (!brand || brand.ownerId !== req.user.id) throw ApiError.notFound('البراند غير موجود.');
    await db.brands.remove({ id: req.params.id });
    await db.contents.removeMany({ brandId: req.params.id });
    await db.ideas.removeMany({ brandId: req.params.id });
    res.json({ ok: true });
  })
);

module.exports = router;

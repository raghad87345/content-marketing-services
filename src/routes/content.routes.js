'use strict';

const express = require('express');
const { body } = require('express-validator');
const { db } = require('../db/store');
const { ApiError, asyncHandler } = require('../lib/errors');
const { PLATFORMS } = require('../lib/trends');
const { authenticate, withBrand } = require('../middleware/auth');
const { handleValidation } = require('../middleware/error');

const router = express.Router();
router.use(authenticate);

const STATUSES = ['idea', 'scheduled', 'published', 'archived'];
const PILLARS = ['reach', 'trust', 'conversion'];
const platformIds = PLATFORMS.map((p) => p.id);

const METRIC_KEYS = ['views', 'saves', 'shares', 'comments', 'leads', 'watchTimeSeconds'];

const sanitizeMetrics = (metrics = {}) =>
  METRIC_KEYS.reduce((acc, key) => {
    const value = Number(metrics[key]);
    if (Number.isFinite(value) && value >= 0) acc[key] = value;
    return acc;
  }, {});

const ownedContent = (id, userId) => {
  const content = db.contents.findOne({ id });
  if (!content || content.ownerId !== userId) throw ApiError.notFound('المحتوى غير موجود.');
  return content;
};

router.get(
  '/',
  withBrand,
  asyncHandler(async (req, res) => {
    const query = { brandId: req.brand.id };
    if (req.query.status && STATUSES.includes(req.query.status)) query.status = req.query.status;
    const contents = db.contents.find(query, { sort: { scheduledFor: 'desc' } });
    res.json({ contents, total: contents.length });
  })
);

router.post(
  '/',
  withBrand,
  [
    body('title').trim().isLength({ min: 2, max: 200 }).withMessage('العنوان مطلوب.'),
    body('status').optional().isIn(STATUSES).withMessage('الحالة غير معروفة.'),
    body('pillar').optional().isIn(PILLARS).withMessage('نوع المحتوى غير معروف.'),
    body('platform').optional().isIn(platformIds).withMessage('المنصة غير معروفة.'),
    body('scheduledFor').optional().isISO8601().withMessage('التاريخ غير صحيح.'),
  ],
  handleValidation,
  asyncHandler(async (req, res) => {
    const status = STATUSES.includes(req.body.status) ? req.body.status : 'idea';
    const content = await db.contents.insert({
      ownerId: req.user.id,
      brandId: req.brand.id,
      title: req.body.title.trim(),
      body: String(req.body.body || ''),
      hook: String(req.body.hook || ''),
      caption: String(req.body.caption || ''),
      cta: String(req.body.cta || ''),
      format: String(req.body.format || 'Reel'),
      platform: platformIds.includes(req.body.platform) ? req.body.platform : req.brand.platforms?.[0] || 'instagram',
      pillar: PILLARS.includes(req.body.pillar) ? req.body.pillar : 'reach',
      status,
      ideaId: req.body.ideaId || null,
      trendKey: req.body.trendKey || null,
      scheduledFor: req.body.scheduledFor || null,
      publishedAt: status === 'published' ? req.body.publishedAt || new Date().toISOString() : null,
      metrics: sanitizeMetrics(req.body.metrics),
    });
    res.status(201).json({ content });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ content: ownedContent(req.params.id, req.user.id) });
  })
);

router.patch(
  '/:id',
  [
    body('status').optional().isIn(STATUSES).withMessage('الحالة غير معروفة.'),
    body('pillar').optional().isIn(PILLARS).withMessage('نوع المحتوى غير معروف.'),
    body('scheduledFor').optional({ nullable: true }).isISO8601().withMessage('التاريخ غير صحيح.'),
  ],
  handleValidation,
  asyncHandler(async (req, res) => {
    const existing = ownedContent(req.params.id, req.user.id);
    const patch = {};
    for (const field of ['title', 'body', 'hook', 'caption', 'cta', 'format', 'trendKey']) {
      if (req.body[field] !== undefined) patch[field] = String(req.body[field]);
    }
    if (req.body.platform && platformIds.includes(req.body.platform)) patch.platform = req.body.platform;
    if (req.body.pillar) patch.pillar = req.body.pillar;
    if (req.body.scheduledFor !== undefined) patch.scheduledFor = req.body.scheduledFor;
    if (req.body.metrics) patch.metrics = { ...existing.metrics, ...sanitizeMetrics(req.body.metrics) };
    if (req.body.status) {
      patch.status = req.body.status;
      // Publishing stamps the date once; un-publishing clears it.
      if (req.body.status === 'published' && !existing.publishedAt) {
        patch.publishedAt = req.body.publishedAt || new Date().toISOString();
      }
      if (req.body.status !== 'published') patch.publishedAt = null;
    }
    const content = await db.contents.update({ id: req.params.id }, patch);
    res.json({ content });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    ownedContent(req.params.id, req.user.id);
    await db.contents.remove({ id: req.params.id });
    res.json({ ok: true });
  })
);

module.exports = router;

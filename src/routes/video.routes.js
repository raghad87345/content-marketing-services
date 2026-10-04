'use strict';

const express = require('express');
const { body } = require('express-validator');
const { db } = require('../db/store');
const { ApiError, asyncHandler } = require('../lib/errors');
const { analyzeVideo, PLATFORM_TARGETS } = require('../lib/video');
const { authenticate, withBrand } = require('../middleware/auth');
const { handleValidation } = require('../middleware/error');
const { enforceQuota, recordUsage } = require('../middleware/quota');

const router = express.Router();
router.use(authenticate);

router.post(
  '/analyze',
  withBrand,
  [
    body('durationSeconds')
      .isFloat({ min: 0.5, max: 3600 })
      .withMessage('مدة الفيديو غير صحيحة.'),
    body('platform').optional().isIn(Object.keys(PLATFORM_TARGETS)).withMessage('المنصة غير معروفة.'),
    body('cuts').optional().isArray({ max: 2000 }).withMessage('بيانات المشاهد غير صحيحة.'),
    body('hookText').optional().isLength({ max: 400 }).withMessage('نص الهوك طويل جدًا.'),
    body('ctaText').optional().isLength({ max: 400 }).withMessage('نص الـCTA طويل جدًا.'),
  ],
  handleValidation,
  enforceQuota('videoAnalyses'),
  asyncHandler(async (req, res) => {
    const analysis = analyzeVideo({
      ...req.body,
      platform: req.body.platform || req.brand.platforms?.[0] || 'instagram',
    });
    await recordUsage(req.user.id, 'videoAnalyses');

    const record = await db.videoAnalyses.insert({
      ownerId: req.user.id,
      brandId: req.brand.id,
      fileName: String(req.body.fileName || '').slice(0, 160),
      analysis,
    });

    res.status(201).json({ id: record.id, analysis });
  })
);

router.get(
  '/history',
  withBrand,
  asyncHandler(async (req, res) => {
    const rows = db.videoAnalyses.find(
      { brandId: req.brand.id },
      { sort: { createdAt: 'desc' }, limit: Number(req.query.limit) || 10 }
    );
    res.json({
      analyses: rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        fileName: row.fileName,
        overall: row.analysis.overall,
        verdict: row.analysis.verdict,
        weakest: row.analysis.weakest,
        durationLabel: row.analysis.measurements.durationLabel,
      })),
    });
  })
);

router.get(
  '/history/:id',
  asyncHandler(async (req, res) => {
    const row = db.videoAnalyses.findOne({ id: req.params.id });
    if (!row || row.ownerId !== req.user.id) throw ApiError.notFound('التحليل غير موجود.');
    res.json({ analysis: row.analysis, fileName: row.fileName, createdAt: row.createdAt });
  })
);

module.exports = router;

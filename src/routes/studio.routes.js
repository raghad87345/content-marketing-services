'use strict';

const express = require('express');
const { body } = require('express-validator');
const config = require('../config');
const { db } = require('../db/store');
const { asyncHandler, ApiError } = require('../lib/errors');
const { generateWithAI } = require('../lib/ai');
const { NICHES, PLATFORMS, GOALS } = require('../lib/trends');
const { authenticate, withBrand } = require('../middleware/auth');
const { handleValidation } = require('../middleware/error');
const { enforceQuota, recordUsage } = require('../middleware/quota');

const router = express.Router();
router.use(authenticate);

const platformIds = PLATFORMS.map((p) => p.id);
const goalIds = GOALS.map((g) => g.id);
const executions = ['faceless', 'talking', 'screen', 'carousel'];
const tones = ['saudi', 'msa', 'casual', 'professional'];

router.get('/options', (_req, res) => {
  res.json({
    platforms: PLATFORMS,
    goals: GOALS,
    niches: NICHES,
    executions: [
      { id: 'faceless', label: 'بدون ظهور' },
      { id: 'talking', label: 'تصوير مباشر' },
      { id: 'screen', label: 'تسجيل شاشة' },
      { id: 'carousel', label: 'كاروسيل' },
    ],
    tones: [
      { id: 'saudi', label: 'سعودي أبيض' },
      { id: 'msa', label: 'فصحى' },
      { id: 'casual', label: 'ودّي' },
      { id: 'professional', label: 'مهني' },
    ],
    aiEnabled: config.ai.enabled,
  });
});

router.post(
  '/generate',
  withBrand,
  [
    body('topic').trim().isLength({ min: 3, max: 200 }).withMessage('اكتب موضوعًا بين 3 و200 حرف.'),
    body('goal').optional().isIn(goalIds).withMessage('الهدف غير معروف.'),
    body('platform').optional().isIn(platformIds).withMessage('المنصة غير معروفة.'),
    body('execution').optional().isIn(executions).withMessage('طريقة التنفيذ غير معروفة.'),
    body('tone').optional().isIn(tones).withMessage('الأسلوب غير معروف.'),
  ],
  handleValidation,
  enforceQuota('generations'),
  asyncHandler(async (req, res) => {
    const brand = req.brand;
    const input = {
      topic: req.body.topic.trim(),
      goal: req.body.goal || brand.goal,
      platform: req.body.platform || brand.platforms?.[0] || 'instagram',
      execution: req.body.execution || 'faceless',
      tone: req.body.tone || brand.tone,
      niche: brand.niche,
      brandName: brand.name,
      audience: brand.audience,
      brandVoice: brand.voice,
      offer: brand.offer,
      trendKey: req.body.trendKey || null,
    };

    const result = await generateWithAI(input);
    await recordUsage(req.user.id, 'generations');

    const idea = await db.ideas.insert({
      ownerId: req.user.id,
      brandId: brand.id,
      input,
      package: result,
    });

    res.status(201).json({
      idea: { id: idea.id, createdAt: idea.createdAt },
      package: result,
      quota: req.quota ? { ...req.quota, used: req.quota.used + 1, remaining: req.quota.remaining - 1 } : null,
    });
  })
);

router.get(
  '/history',
  withBrand,
  asyncHandler(async (req, res) => {
    const ideas = db.ideas.find(
      { brandId: req.brand.id },
      { sort: { createdAt: 'desc' }, limit: Number(req.query.limit) || 20 }
    );
    res.json({
      ideas: ideas.map((idea) => ({
        id: idea.id,
        createdAt: idea.createdAt,
        title: idea.package?.title,
        hook: idea.package?.hook,
        platform: idea.package?.platformLabel,
        goal: idea.package?.goalLabel,
        source: idea.package?.source,
      })),
    });
  })
);

router.get(
  '/history/:id',
  asyncHandler(async (req, res) => {
    const idea = db.ideas.findOne({ id: req.params.id });
    if (!idea || idea.ownerId !== req.user.id) throw ApiError.notFound('الفكرة غير موجودة.');
    res.json({ idea });
  })
);

module.exports = router;

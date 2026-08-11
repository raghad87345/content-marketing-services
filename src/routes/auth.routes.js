'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const config = require('../config');
const { db } = require('../db/store');
const { ApiError, asyncHandler } = require('../lib/errors');
const { DEFAULT_PLAN, planIds } = require('../lib/plans');
const { authenticate, signToken, publicUser } = require('../middleware/auth');
const { handleValidation } = require('../middleware/error');
const { usageSummary } = require('../middleware/quota');

const router = express.Router();

// Credential endpoints get their own, tighter budget than the rest of the API.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isTest ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'محاولات كثيرة. حاول بعد 15 دقيقة.' } },
});

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

router.post(
  '/register',
  authLimiter,
  [
    body('name').trim().isLength({ min: 2 }).withMessage('الاسم مطلوب (حرفان على الأقل).'),
    body('email').isEmail().withMessage('البريد الإلكتروني غير صحيح.'),
    body('password').isLength({ min: 8 }).withMessage('كلمة المرور يجب أن تكون 8 أحرف فأكثر.'),
    body('plan').optional().isIn(planIds).withMessage('الباقة غير معروفة.'),
  ],
  handleValidation,
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body.email);
    if (db.users.findOne({ email })) {
      throw ApiError.conflict('هذا البريد مسجّل مسبقًا. سجّل الدخول بدلًا من ذلك.');
    }
    const user = await db.users.insert({
      name: req.body.name.trim(),
      email,
      passwordHash: await bcrypt.hash(req.body.password, 10),
      plan: req.body.plan && planIds.includes(req.body.plan) ? req.body.plan : DEFAULT_PLAN,
      role: 'owner',
      isActive: true,
      onboardingCompleted: false,
    });
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  })
);

router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().withMessage('البريد الإلكتروني غير صحيح.'),
    body('password').notEmpty().withMessage('كلمة المرور مطلوبة.'),
  ],
  handleValidation,
  asyncHandler(async (req, res) => {
    const user = db.users.findOne({ email: normalizeEmail(req.body.email) });
    const ok = user && (await bcrypt.compare(req.body.password, user.passwordHash));
    if (!ok) {
      // Same message either way so the endpoint can't be used to enumerate accounts.
      throw ApiError.unauthorized('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    }
    if (user.isActive === false) throw ApiError.forbidden('هذا الحساب معطّل.');
    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const brands = db.brands.find({ ownerId: req.user.id }, { sort: { createdAt: 'asc' } });
    res.json({ user: publicUser(req.user), brands, usage: usageSummary(req.user) });
  })
);

router.patch(
  '/me',
  authenticate,
  [body('name').optional().trim().isLength({ min: 2 }).withMessage('الاسم قصير جدًا.')],
  handleValidation,
  asyncHandler(async (req, res) => {
    const patch = {};
    if (req.body.name) patch.name = req.body.name.trim();
    if (typeof req.body.onboardingCompleted === 'boolean') {
      patch.onboardingCompleted = req.body.onboardingCompleted;
    }
    const user = await db.users.update({ id: req.user.id }, patch);
    res.json({ user: publicUser(user) });
  })
);

router.post(
  '/change-password',
  authenticate,
  authLimiter,
  [
    body('currentPassword').notEmpty().withMessage('كلمة المرور الحالية مطلوبة.'),
    body('newPassword').isLength({ min: 8 }).withMessage('كلمة المرور الجديدة يجب أن تكون 8 أحرف فأكثر.'),
  ],
  handleValidation,
  asyncHandler(async (req, res) => {
    const ok = await bcrypt.compare(req.body.currentPassword, req.user.passwordHash);
    if (!ok) throw ApiError.badRequest('كلمة المرور الحالية غير صحيحة.');
    await db.users.update(
      { id: req.user.id },
      { passwordHash: await bcrypt.hash(req.body.newPassword, 10) }
    );
    res.json({ ok: true });
  })
);

module.exports = router;

'use strict';

const express = require('express');
const { body } = require('express-validator');
const { db } = require('../db/store');
const { asyncHandler } = require('../lib/errors');
const { PLANS, planIds, getPlan } = require('../lib/plans');
const { authenticate, publicUser } = require('../middleware/auth');
const { handleValidation } = require('../middleware/error');
const { usageSummary } = require('../middleware/quota');

const router = express.Router();

router.get('/plans', (_req, res) => {
  res.json({ plans: PLANS, currency: 'SAR' });
});

router.get(
  '/subscription',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({
      plan: getPlan(req.user.plan),
      usage: usageSummary(req.user),
      paymentProvider: null,
      note: 'لم يتم ربط مزوّد دفع بعد. تغيير الباقة هنا يحدّث الحصص فورًا دون تحصيل مبالغ.',
    });
  })
);

router.post(
  '/subscription',
  authenticate,
  [body('plan').isIn(planIds).withMessage('الباقة غير معروفة.')],
  handleValidation,
  asyncHandler(async (req, res) => {
    const user = await db.users.update({ id: req.user.id }, { plan: req.body.plan });
    res.json({
      user: publicUser(user),
      plan: getPlan(user.plan),
      usage: usageSummary(user),
      note: 'تم تحديث الباقة والحصص. لا يوجد تحصيل مالي في هذه النسخة.',
    });
  })
);

module.exports = router;

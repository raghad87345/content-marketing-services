'use strict';

const { db } = require('../db/store');
const { limitFor, getPlan } = require('../lib/plans');
const { ApiError, asyncHandler } = require('../lib/errors');

const currentPeriod = () => new Date().toISOString().slice(0, 7); // YYYY-MM

function usageFor(userId, metric, period = currentPeriod()) {
  const row = db.usage.findOne({ userId, metric, period });
  return row ? row.count : 0;
}

async function recordUsage(userId, metric, amount = 1) {
  const period = currentPeriod();
  const existing = db.usage.findOne({ userId, metric, period });
  if (existing) {
    return db.usage.update({ id: existing.id }, { count: existing.count + amount });
  }
  return db.usage.insert({ userId, metric, period, count: amount });
}

/** Blocks the request when the plan's monthly allowance for `metric` is spent. */
const enforceQuota = (metric) =>
  asyncHandler(async (req, _res, next) => {
    const limit = limitFor(req.user.plan, metric);
    if (limit === null || limit === undefined) return next();
    const used = usageFor(req.user.id, metric);
    if (used >= limit) {
      const plan = getPlan(req.user.plan);
      throw ApiError.quotaExceeded(
        `استهلكت حصة باقة ${plan.name} لهذا الشهر (${limit}). رقِّ الباقة للمتابعة.`,
        { details: { metric, limit, used, plan: plan.id } }
      );
    }
    req.quota = { metric, limit, used, remaining: limit - used };
    next();
  });

function usageSummary(user) {
  const plan = getPlan(user.plan);
  const metrics = ['generations', 'videoAnalyses'];
  const summary = {};
  for (const metric of metrics) {
    const limit = plan.limits[metric];
    const used = usageFor(user.id, metric);
    summary[metric] = {
      used,
      limit,
      remaining: limit === null ? null : Math.max(0, limit - used),
      unlimited: limit === null,
    };
  }
  summary.brands = {
    used: db.brands.count({ ownerId: user.id }),
    limit: plan.limits.brands,
    remaining: Math.max(0, plan.limits.brands - db.brands.count({ ownerId: user.id })),
    unlimited: false,
  };
  return { period: currentPeriod(), plan: plan.id, planName: plan.name, ...summary };
}

module.exports = { enforceQuota, recordUsage, usageFor, usageSummary, currentPeriod };

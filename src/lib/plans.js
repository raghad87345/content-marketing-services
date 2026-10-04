'use strict';

/**
 * Subscription plans and the quotas they carry.
 *
 * Quotas are enforced per calendar month against the `usage` collection.
 * `Infinity` is expressed as `null` so the values survive JSON serialisation.
 */

const PLANS = [
  {
    id: 'creator',
    name: 'Creator',
    nameAr: 'كرييتور',
    price: 49,
    currency: 'SAR',
    interval: 'month',
    tagline: 'لصناع المحتوى الأفراد الذين يبنون حضورهم.',
    features: [
      'براند واحد',
      '30 فكرة/سكربت شهريًا',
      'Trend Radar كامل',
      '5 تحليلات فيديو شهريًا',
      'تقويم محتوى ذكي',
    ],
    limits: { brands: 1, generations: 30, videoAnalyses: 5, seats: 1 },
  },
  {
    id: 'business',
    name: 'Business',
    nameAr: 'بزنس',
    price: 129,
    currency: 'SAR',
    interval: 'month',
    popular: true,
    tagline: 'لأصحاب المشاريع الذين يريدون المحتوى أن يجلب عملاء.',
    features: [
      'براندان',
      '200 فكرة/سكربت شهريًا',
      'Content Studio كامل',
      '50 تحليل فيديو شهريًا',
      'تحليلات الأداء والتعلم',
      'خطة أسبوعية مقترحة',
    ],
    limits: { brands: 2, generations: 200, videoAnalyses: 50, seats: 3 },
  },
  {
    id: 'agency',
    name: 'Agency',
    nameAr: 'وكالة',
    price: 299,
    currency: 'SAR',
    interval: 'month',
    tagline: 'للوكالات التي تدير محتوى عدة عملاء في مكان واحد.',
    features: [
      '10 عملاء (Workspaces)',
      'توليد غير محدود',
      'تحليل فيديو غير محدود',
      'تقارير جاهزة للعملاء',
      'فريق وصلاحيات',
      'دعم ذو أولوية',
    ],
    limits: { brands: 10, generations: null, videoAnalyses: null, seats: 10 },
  },
];

const DEFAULT_PLAN = 'creator';

const getPlan = (planId) => PLANS.find((plan) => plan.id === planId) || PLANS[0];

const planIds = PLANS.map((plan) => plan.id);

/** `null` in a limit means unlimited. */
const limitFor = (planId, key) => getPlan(planId).limits[key];

module.exports = { PLANS, DEFAULT_PLAN, getPlan, planIds, limitFor };

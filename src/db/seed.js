'use strict';

/**
 * Demo workspace.
 *
 * Seeded only when the database is empty, so a fresh clone opens on a product
 * that already has history to look at. Metrics are generated from a fixed seed
 * and clearly belong to the demo account — real accounts start empty.
 */

const bcrypt = require('bcryptjs');
const { db } = require('./store');
const { generatePackage } = require('../lib/studio');

const DEMO_EMAIL = 'demo@mohtawa.app';
const DEMO_PASSWORD = 'Mohtawa2026';

// Small deterministic PRNG so the demo numbers are stable across restarts.
const makeRandom = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const DEMO_POSTS = [
  { title: 'ليش محتواك ما يجيب عملاء؟', pillar: 'conversion', format: 'Reel', base: 182000 },
  { title: '5 هوكات استخدمها هذا الأسبوع', pillar: 'reach', format: 'Carousel', base: 118000 },
  { title: '3 أخطاء في الـCTA تكلفك عملاء', pillar: 'conversion', format: 'Reel', base: 96000 },
  { title: 'كيف أخطط محتوى شهر في ساعتين', pillar: 'trust', format: 'Carousel', base: 74000 },
  { title: 'المشاهدات ≠ عملاء — الفرق هنا', pillar: 'reach', format: 'Reel', base: 66000 },
  { title: 'اعتراض «غالي» وكيف أرد عليه', pillar: 'conversion', format: 'Reel', base: 58000 },
  { title: 'قبل/بعد: إعادة كتابة بايو عميل', pillar: 'trust', format: 'Carousel', base: 47000 },
  { title: 'وش أنشر لما ما عندي أفكار؟', pillar: 'reach', format: 'Reel', base: 41000 },
  { title: 'تفكيك ريل حقق مليون مشاهدة', pillar: 'trust', format: 'Carousel', base: 38000 },
  { title: 'أول 3 ثوانٍ: القاعدة الوحيدة', pillar: 'reach', format: 'Reel', base: 33000 },
  { title: 'محتوى يبني ثقة قبل البيع', pillar: 'trust', format: 'Post', base: 27000 },
  { title: 'كيف أقيس إن المحتوى نجح؟', pillar: 'conversion', format: 'Carousel', base: 22000 },
];

const UPCOMING = [
  { title: 'ثلاثة أشياء لن أفعلها كصانع محتوى', pillar: 'reach', format: 'Reel', inDays: 1 },
  { title: 'تفكيك حملة عميل من الصفر', pillar: 'trust', format: 'Carousel', inDays: 3 },
  { title: 'اعتراض العميل: «أبغى نتائج بسرعة»', pillar: 'conversion', format: 'Reel', inDays: 5 },
];

async function seedDemoData() {
  if (db.users.count() > 0) return { seeded: false };

  const user = await db.users.insert({
    name: 'رغد',
    email: DEMO_EMAIL,
    passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
    plan: 'business',
    role: 'owner',
    isActive: true,
    onboardingCompleted: true,
    isDemo: true,
  });

  const brand = await db.brands.insert({
    ownerId: user.id,
    name: 'Raghad Studio',
    niche: 'marketing',
    goal: 'conversion',
    region: 'sa',
    platforms: ['instagram', 'tiktok'],
    audience: 'أصحاب مشاريع صغيرة ووكالات تسويق في السعودية',
    voice: 'مباشر، عملي، بلا مصطلحات معقدة',
    offer: 'استشارات وإدارة محتوى شهرية',
    tone: 'saudi',
    postsPerWeek: 3,
  });

  const random = makeRandom(20260811);
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  for (let i = 0; i < DEMO_POSTS.length; i += 1) {
    const post = DEMO_POSTS[i];
    // Spread across ~58 days so both the current and previous window have data.
    const publishedAt = new Date(now - (i * 5 + 2) * day).toISOString();
    const views = Math.round(post.base * (0.85 + random() * 0.3));
    await db.contents.insert({
      ownerId: user.id,
      brandId: brand.id,
      title: post.title,
      body: '',
      hook: '',
      caption: '',
      cta: '',
      format: post.format,
      platform: 'instagram',
      pillar: post.pillar,
      status: 'published',
      scheduledFor: publishedAt,
      publishedAt,
      metrics: {
        views,
        saves: Math.round(views * (0.02 + random() * 0.03)),
        shares: Math.round(views * (0.01 + random() * 0.02)),
        comments: Math.round(views * (0.004 + random() * 0.006)),
        leads: post.pillar === 'conversion' ? Math.round(views * (0.0004 + random() * 0.0008)) : 0,
        watchTimeSeconds: Number((9 + random() * 8).toFixed(1)),
      },
    });
  }

  for (const item of UPCOMING) {
    await db.contents.insert({
      ownerId: user.id,
      brandId: brand.id,
      title: item.title,
      body: '',
      hook: '',
      caption: '',
      cta: '',
      format: item.format,
      platform: 'instagram',
      pillar: item.pillar,
      status: 'scheduled',
      scheduledFor: new Date(now + item.inDays * day).toISOString(),
      publishedAt: null,
      metrics: {},
    });
  }

  const demoIdeaInput = {
    topic: 'كيف تخلي المحتوى يجيب لك عملاء؟',
    goal: 'conversion',
    platform: 'instagram',
    execution: 'faceless',
    tone: 'saudi',
    niche: 'marketing',
    brandName: brand.name,
    audience: brand.audience,
  };
  await db.ideas.insert({
    ownerId: user.id,
    brandId: brand.id,
    input: demoIdeaInput,
    package: generatePackage(demoIdeaInput),
  });

  return { seeded: true, email: DEMO_EMAIL, password: DEMO_PASSWORD };
}

module.exports = { seedDemoData, DEMO_EMAIL, DEMO_PASSWORD };

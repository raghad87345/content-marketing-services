'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-for-mohtawa';
process.env.SEED_DEMO_DATA = 'false';
process.env.DATA_DIR = require('node:path').join(
  require('node:os').tmpdir(),
  'mohtawa-test-' + process.pid
);

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const request = require('supertest');

const config = require('../src/config');
const { initStore } = require('../src/db/store');
const { createApp } = require('../src/app');
const { analyzeVideo } = require('../src/lib/video');
const { buildMonthPlan } = require('../src/lib/planner');
const { listTrends } = require('../src/lib/trends');
const { buildLearnings } = require('../src/lib/analytics');

let app;
let owner = {};
let intruder = {};

test.before(async () => {
  await initStore(config);
  app = createApp();
});

test.after(async () => {
  await fs.rm(config.dataDir, { recursive: true, force: true });
});

test('health and public config are reachable without a token', async () => {
  const health = await request(app).get('/api/health').expect(200);
  assert.equal(health.body.status, 'ok');

  const cfg = await request(app).get('/api/config').expect(200);
  assert.equal(cfg.body.appName, 'MOHTAWA');
  assert.equal(cfg.body.plans.length, 3);
});

test('registration validates input and issues a token', async () => {
  const weak = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Test', email: 'weak@example.com', password: 'short' })
    .expect(400);
  assert.equal(weak.body.error.code, 'validation_error');

  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'صاحب المشروع', email: 'Owner@Example.com', password: 'supersecret1' })
    .expect(201);

  assert.ok(res.body.token);
  assert.equal(res.body.user.email, 'owner@example.com', 'email should be normalised');
  assert.equal(res.body.user.passwordHash, undefined, 'password hash must never be returned');
  owner.token = res.body.token;
  owner.id = res.body.user.id;
});

test('duplicate registration is rejected with 409', async () => {
  await request(app)
    .post('/api/auth/register')
    .send({ name: 'Copy', email: 'owner@example.com', password: 'supersecret1' })
    .expect(409);
});

test('login rejects a wrong password without revealing which field failed', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'owner@example.com', password: 'wrong-password' })
    .expect(401);
  assert.match(res.body.error.message, /البريد الإلكتروني أو كلمة المرور/);
});

test('protected routes require a valid bearer token', async () => {
  await request(app).get('/api/brands').expect(401);
  await request(app).get('/api/brands').set('Authorization', 'Bearer not-a-token').expect(401);
});

test('a brand can be created and is returned on /auth/me', async () => {
  const res = await request(app)
    .post('/api/brands')
    .set('Authorization', `Bearer ${owner.token}`)
    .send({
      name: 'Raghad Studio',
      niche: 'marketing',
      goal: 'conversion',
      audience: 'أصحاب متاجر',
      postsPerWeek: 3,
    })
    .expect(201);

  owner.brandId = res.body.brand.id;
  assert.equal(res.body.brand.ownerId, owner.id);

  const me = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${owner.token}`)
    .expect(200);
  assert.equal(me.body.brands.length, 1);
  assert.equal(me.body.user.onboardingCompleted, true);
  assert.equal(me.body.usage.generations.limit, 30, 'creator plan allows 30 generations');
});

test('the creator plan refuses a second brand', async () => {
  const res = await request(app)
    .post('/api/brands')
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ name: 'Second Brand' })
    .expect(429);
  assert.equal(res.body.error.code, 'quota_exceeded');
});

test('trends are ranked and filtered by platform and niche', async () => {
  const res = await request(app)
    .get('/api/trends?platform=linkedin&niche=realestate')
    .set('Authorization', `Bearer ${owner.token}`)
    .expect(200);

  const scores = res.body.trends.map((trend) => trend.score);
  assert.ok(scores.length > 5);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a), 'trends must be sorted by score');
  assert.ok(res.body.source.includes('MOHTAWA'), 'the response states where the ranking comes from');
});

test('studio generates a complete package and consumes quota', async () => {
  const res = await request(app)
    .post('/api/studio/generate')
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ topic: 'كيف تخلي المحتوى يجيب لك عملاء؟', platform: 'instagram', goal: 'conversion' })
    .expect(201);

  const pkg = res.body.package;
  assert.ok(pkg.hooks.length >= 3);
  assert.ok(pkg.script.length >= 4);
  assert.ok(pkg.shotList.length >= 4);
  assert.ok(pkg.caption.length > 20);
  assert.ok(pkg.cta.length > 5);
  assert.equal(pkg.source, 'template', 'no API key configured in tests');

  const me = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${owner.token}`)
    .expect(200);
  assert.equal(me.body.usage.generations.used, 1);
});

test('video analysis scores measurements and flags static stretches', async () => {
  const res = await request(app)
    .post('/api/video/analyze')
    .set('Authorization', `Bearer ${owner.token}`)
    .send({
      durationSeconds: 28,
      width: 1080,
      height: 1920,
      cuts: [2, 5, 9, 21],
      hookText: 'ليش محتواك ما يجيب عملاء؟',
      ctaText: 'احفظ الفيديو وطبّقه هذا الأسبوع',
      hasCaptions: true,
      platform: 'instagram',
    })
    .expect(201);

  const analysis = res.body.analysis;
  assert.ok(analysis.overall > 60 && analysis.overall <= 100);
  assert.equal(analysis.measurements.cuts, 4);
  assert.ok(
    analysis.risks.some((risk) => risk.seconds >= 5),
    'the 12s gap between 9s and 21s must be reported'
  );
  assert.ok(analysis.disclaimer.length > 10);
});

test('video analysis rejects an impossible duration', async () => {
  await request(app)
    .post('/api/video/analyze')
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ durationSeconds: 0 })
    .expect(400);
});

test('calendar returns a balanced plan that can be applied', async () => {
  const res = await request(app)
    .get('/api/calendar?year=2026&month=9')
    .set('Authorization', `Bearer ${owner.token}`)
    .expect(200);

  assert.ok(res.body.plan.slots.length >= 8);
  assert.ok(Object.keys(res.body.plan.distribution).length >= 2, 'plan mixes more than one pillar');

  const applied = await request(app)
    .post('/api/calendar/apply')
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ slots: res.body.plan.slots.slice(0, 3) })
    .expect(201);
  assert.equal(applied.body.count, 3);

  const after = await request(app)
    .get('/api/calendar?year=2026&month=9')
    .set('Authorization', `Bearer ${owner.token}`)
    .expect(200);
  assert.equal(after.body.scheduled.length, 3, 'applied slots become scheduled content');
});

test('content metrics are recorded and drive analytics', async () => {
  const created = await request(app)
    .post('/api/content')
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ title: 'منشور تجريبي', status: 'published', pillar: 'reach', metrics: { views: 5000, saves: 200 } })
    .expect(201);

  owner.contentId = created.body.content.id;
  assert.ok(created.body.content.publishedAt, 'publishing stamps a date');

  const updated = await request(app)
    .patch(`/api/content/${owner.contentId}`)
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ metrics: { views: 7000, shares: -5 } })
    .expect(200);
  assert.equal(updated.body.content.metrics.views, 7000);
  assert.equal(updated.body.content.metrics.saves, 200, 'unspecified metrics are preserved');
  assert.equal(updated.body.content.metrics.shares, undefined, 'negative metrics are dropped');

  const analytics = await request(app)
    .get('/api/analytics/overview')
    .set('Authorization', `Bearer ${owner.token}`)
    .expect(200);
  const views = analytics.body.overview.metrics.find((m) => m.key === 'views');
  assert.equal(views.value, 7000);
});

test("one user cannot read or modify another user's content", async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Intruder', email: 'intruder@example.com', password: 'supersecret1' })
    .expect(201);
  intruder.token = res.body.token;

  await request(app)
    .get(`/api/content/${owner.contentId}`)
    .set('Authorization', `Bearer ${intruder.token}`)
    .expect(404);

  await request(app)
    .delete(`/api/content/${owner.contentId}`)
    .set('Authorization', `Bearer ${intruder.token}`)
    .expect(404);

  await request(app)
    .get(`/api/brands/${owner.brandId}`)
    .set('Authorization', `Bearer ${intruder.token}`)
    .expect(404);

  await request(app)
    .get(`/api/trends?brandId=${owner.brandId}`)
    .set('Authorization', `Bearer ${intruder.token}`)
    .expect(403);
});

test('changing the plan updates the quotas immediately', async () => {
  await request(app)
    .post('/api/billing/subscription')
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ plan: 'agency' })
    .expect(200);

  const me = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${owner.token}`)
    .expect(200);
  assert.equal(me.body.usage.generations.unlimited, true);
});

test('unknown API routes return a JSON 404 while pages fall back to the app shell', async () => {
  const api404 = await request(app).get('/api/does-not-exist').expect(404);
  assert.equal(api404.body.error.code, 'not_found');

  await request(app).get('/some/client/route').expect(200).expect('Content-Type', /html/);
});

/* ---------------- unit tests for the domain libraries ---------------- */

test('analyzeVideo penalises a missing hook, captions and CTA', () => {
  const strong = analyzeVideo({
    durationSeconds: 24,
    width: 1080,
    height: 1920,
    cuts: [2, 5, 8, 12, 16, 20],
    hookText: 'ثلاثة أخطاء تكلفك عملاء؟',
    ctaText: 'احفظ الفيديو',
    hasCaptions: true,
  });
  const weak = analyzeVideo({ durationSeconds: 180, width: 1920, height: 1080, cuts: [] });

  assert.ok(strong.overall > weak.overall + 25);
  assert.equal(weak.weakest.score < 60, true);
  assert.ok(weak.recommendations.length >= 3);
});

test('buildMonthPlan distributes slots across pillars according to the goal', () => {
  const plan = buildMonthPlan({ year: 2026, month: 3, perWeek: 4, goal: 'sales' });
  assert.ok(plan.slots.length >= 12);
  assert.ok(
    plan.distribution.conversion >= plan.distribution.reach,
    'a sales goal must favour conversion content'
  );
});

test('listTrends is deterministic for the same filters', () => {
  const a = listTrends({ platform: 'tiktok', niche: 'food', region: 'sa' });
  const b = listTrends({ platform: 'tiktok', niche: 'food', region: 'sa' });
  assert.deepEqual(a, b);
});

test('learnings are withheld until the sample is large enough', () => {
  const thin = buildLearnings([{ status: 'published', metrics: { views: 10 }, pillar: 'reach' }]);
  assert.equal(thin.learnings.length, 0);
  assert.match(thin.message, /سجّل أداء/);

  const enough = buildLearnings([
    { status: 'published', pillar: 'reach', format: 'Reel', title: 'أ', metrics: { views: 1000, saves: 100 } },
    { status: 'published', pillar: 'reach', format: 'Reel', title: 'ب', metrics: { views: 2000, saves: 50 } },
    { status: 'published', pillar: 'trust', format: 'Carousel', title: 'ج', metrics: { views: 300, saves: 10 } },
    { status: 'published', pillar: 'trust', format: 'Carousel', title: 'د', metrics: { views: 200, saves: 8 } },
  ]);
  assert.ok(enough.learnings.length >= 1);
  assert.match(enough.learnings[0].body, /وصول/);
});

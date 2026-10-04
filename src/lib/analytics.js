'use strict';

/**
 * Performance intelligence.
 *
 * Every number here is computed from content the user actually recorded — there
 * are no simulated metrics. When there is not enough data to support a
 * conclusion, the learning is omitted rather than invented, and the response
 * says how many published posts the analysis is based on.
 */

const PILLAR_LABELS = { reach: 'وصول', trust: 'ثقة', conversion: 'تحويل' };

const sum = (items, key) => items.reduce((total, item) => total + (Number(item.metrics?.[key]) || 0), 0);
const avg = (items, key) => (items.length ? sum(items, key) / items.length : 0);

const inRange = (iso, from, to) => {
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t <= to.getTime();
};

function periodBounds(days) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - days * 24 * 60 * 60 * 1000);
  return { from, to, prevFrom, prevTo };
}

const delta = (current, previous) => {
  if (!previous) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
};

/**
 * @param {Array} contents Content documents for one brand.
 * @param {number} days Look-back window.
 */
function buildOverview(contents, days = 30) {
  const { from, to, prevFrom, prevTo } = periodBounds(days);
  const published = contents.filter((c) => c.status === 'published' && c.publishedAt);
  const current = published.filter((c) => inRange(c.publishedAt, from, to));
  const previous = published.filter((c) => inRange(c.publishedAt, prevFrom, prevTo));

  const metrics = [
    { key: 'views', label: 'المشاهدات' },
    { key: 'saves', label: 'الحفظ' },
    { key: 'shares', label: 'المشاركات' },
    { key: 'leads', label: 'العملاء المحتملون' },
  ].map(({ key, label }) => ({
    key,
    label,
    value: sum(current, key),
    delta: delta(sum(current, key), sum(previous, key)),
  }));

  const avgWatch = avg(current, 'watchTimeSeconds');
  const engagement = sum(current, 'views')
    ? ((sum(current, 'saves') + sum(current, 'shares') + sum(current, 'comments')) /
        sum(current, 'views')) *
      100
    : 0;

  return {
    days,
    postsPublished: current.length,
    postsInPreviousPeriod: previous.length,
    metrics,
    avgWatchTime: Number(avgWatch.toFixed(1)),
    engagementRate: Number(engagement.toFixed(2)),
    series: buildSeries(current, from, days),
    dataBasis: `محسوب من ${current.length} منشورًا مسجلًا خلال آخر ${days} يومًا.`,
  };
}

/** Views per bucket across the window, for the growth chart. */
function buildSeries(contents, from, days) {
  const buckets = Math.min(12, Math.max(4, Math.round(days / 3)));
  const bucketMs = (days * 24 * 60 * 60 * 1000) / buckets;
  const points = Array.from({ length: buckets }, (_, i) => ({
    label: new Date(from.getTime() + bucketMs * (i + 1)).toISOString().slice(5, 10),
    views: 0,
    posts: 0,
  }));
  for (const content of contents) {
    const offset = new Date(content.publishedAt).getTime() - from.getTime();
    const index = Math.min(buckets - 1, Math.max(0, Math.floor(offset / bucketMs)));
    points[index].views += Number(content.metrics?.views) || 0;
    points[index].posts += 1;
  }
  return points;
}

function topContent(contents, limit = 5) {
  return contents
    .filter((c) => c.status === 'published')
    .map((c) => ({
      id: c.id,
      title: c.title,
      format: c.format || c.platform,
      pillar: c.pillar,
      pillarLabel: PILLAR_LABELS[c.pillar] || '—',
      publishedAt: c.publishedAt,
      views: Number(c.metrics?.views) || 0,
      saves: Number(c.metrics?.saves) || 0,
      shares: Number(c.metrics?.shares) || 0,
      leads: Number(c.metrics?.leads) || 0,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
}

/** Only returns a learning when the sample is large enough to mean something. */
function buildLearnings(contents) {
  const published = contents.filter((c) => c.status === 'published' && c.metrics?.views);
  const learnings = [];
  const MIN_SAMPLE = 3;

  if (published.length < MIN_SAMPLE) {
    return {
      learnings: [],
      sample: published.length,
      message: `سجّل أداء ${MIN_SAMPLE - published.length} منشورات إضافية حتى تبدأ المنصة باستخراج أنماط موثوقة.`,
    };
  }

  const groupBy = (key) =>
    published.reduce((acc, content) => {
      const value = content[key] || 'غير محدد';
      acc[value] = acc[value] || { items: [], views: 0 };
      acc[value].items.push(content);
      acc[value].views += Number(content.metrics.views) || 0;
      return acc;
    }, {});

  const best = (groups) =>
    Object.entries(groups)
      .filter(([, group]) => group.items.length >= 2)
      .map(([value, group]) => ({ value, avg: group.views / group.items.length, n: group.items.length }))
      .sort((a, b) => b.avg - a.avg)[0];

  const bestPillar = best(groupBy('pillar'));
  if (bestPillar) {
    learnings.push({
      title: 'أفضل نوع محتوى عندك',
      body: `محتوى «${PILLAR_LABELS[bestPillar.value] || bestPillar.value}» يحقق أعلى متوسط مشاهدات (${Math.round(
        bestPillar.avg
      ).toLocaleString('en-US')} لكل منشور عبر ${bestPillar.n} منشورات).`,
    });
  }

  const bestFormat = best(groupBy('format'));
  if (bestFormat) {
    learnings.push({
      title: 'أفضل فورمات',
      body: `«${bestFormat.value}» يتفوق على بقية الفورمات لديك بمتوسط ${Math.round(
        bestFormat.avg
      ).toLocaleString('en-US')} مشاهدة.`,
    });
  }

  const withSaves = published.filter((c) => c.metrics.saves);
  if (withSaves.length >= MIN_SAMPLE) {
    const saveRate = withSaves.map((c) => ({
      title: c.title,
      rate: (c.metrics.saves / c.metrics.views) * 100,
    }));
    const top = saveRate.sort((a, b) => b.rate - a.rate)[0];
    learnings.push({
      title: 'أعلى معدل حفظ',
      body: `«${top.title}» بمعدل حفظ ${top.rate.toFixed(1)}% — كرّر بنيته في الأسبوع القادم.`,
    });
  }

  return { learnings, sample: published.length, message: null };
}

/** Turns the learnings into the two or three moves worth making next. */
function buildRecommendations(contents, brand) {
  const recs = [];
  const published = contents.filter((c) => c.status === 'published');
  const scheduled = contents.filter((c) => c.status === 'scheduled');
  const { learnings } = buildLearnings(contents);

  if (scheduled.length === 0) {
    recs.push({
      icon: '🗓️',
      title: 'التقويم فاضي',
      body: 'ما عندك محتوى مجدول. افتح Content Calendar واقبل الخطة المقترحة لهذا الأسبوع.',
    });
  }
  if (published.length && published.every((c) => c.pillar === published[0].pillar)) {
    recs.push({
      icon: '⚖️',
      title: 'التوزيع غير متوازن',
      body: 'كل محتواك المنشور يخدم هدفًا واحدًا. أضف منشورًا واحدًا للثقة وآخر للتحويل هذا الأسبوع.',
    });
  }
  if (learnings.length) {
    recs.push({ icon: '📈', title: learnings[0].title, body: learnings[0].body });
  }
  if (brand?.goal === 'conversion' && !contents.some((c) => c.pillar === 'conversion')) {
    recs.push({
      icon: '🎯',
      title: 'هدفك جذب عملاء',
      body: 'لا يوجد أي محتوى مخصص للتحويل. ابدأ بمحتوى «اعتراض العميل الحقيقي» من Trend Radar.',
    });
  }
  if (!recs.length) {
    recs.push({
      icon: '✅',
      title: 'أنت على المسار',
      body: 'التوزيع متوازن والتقويم ممتلئ. ركّز هذا الأسبوع على تحسين الهوك في أضعف منشور.',
    });
  }
  return recs.slice(0, 4);
}

module.exports = { buildOverview, topContent, buildLearnings, buildRecommendations, PILLAR_LABELS };

'use strict';

/**
 * Trend Radar.
 *
 * The catalogue below is a curated library of content *formats* — the reusable
 * shapes that carry a message — rather than a live scrape of any platform.
 * Scores are computed from the format's momentum, how well it fits the selected
 * platform and niche, and how saturated it already is, so the ranking changes
 * with the filters instead of being a static list. `source` is reported on every
 * item so the UI can state plainly where the signal comes from.
 */

const CATALOG = [
  {
    key: 'three-things-i-would-not-do',
    title: '3 أشياء لن أفعلها كـ…',
    summary: 'رأي مهني حاد يبدأ بموقف واضح، ويعطي المشاهد سببًا للبقاء حتى النهاية.',
    hookTemplate: '3 أشياء ما راح أسويها أبدًا كـ{niche}… الثالثة تكلف الناس كثير.',
    platforms: ['instagram', 'tiktok', 'linkedin', 'youtube'],
    niches: ['marketing', 'realestate', 'beauty', 'food', 'fitness', 'ecommerce', 'education'],
    regions: ['sa', 'gulf', 'global'],
    momentum: 0.94,
    saturation: 0.31,
    stage: 'rising',
    bestFor: 'trust',
    effort: 'low',
    formats: ['reel', 'short'],
  },
  {
    key: 'pov-realisation',
    title: 'POV: لما تكتشف إن…',
    summary: 'مشهد تمثيلي قصير يضع المشاهد داخل الموقف بدل أن تشرحه له.',
    hookTemplate: 'POV: اكتشفت إن مشكلتك في {niche} ما كانت أبدًا في اللي تتوقعه.',
    platforms: ['tiktok', 'instagram', 'youtube'],
    niches: ['marketing', 'beauty', 'food', 'fitness', 'education'],
    regions: ['sa', 'gulf', 'global'],
    momentum: 0.9,
    saturation: 0.44,
    stage: 'trending',
    bestFor: 'reach',
    effort: 'medium',
    formats: ['reel', 'short'],
  },
  {
    key: 'nobody-talks-about-this',
    title: 'محد يتكلم عن هذا…',
    summary: 'فضول + مشكلة مخفية. يعمل جيدًا حين يكون لديك ملاحظة فعلية من تجربتك.',
    hookTemplate: 'محد يتكلم عن هذي النقطة في {niche}، وهي اللي تفرق فعليًا.',
    platforms: ['instagram', 'tiktok', 'linkedin'],
    niches: ['marketing', 'realestate', 'ecommerce', 'education', 'fitness'],
    regions: ['sa', 'gulf', 'global'],
    momentum: 0.83,
    saturation: 0.62,
    stage: 'peaking',
    bestFor: 'reach',
    effort: 'low',
    formats: ['reel', 'carousel'],
  },
  {
    key: 'before-after-breakdown',
    title: 'قبل / بعد مع تفكيك السبب',
    summary: 'نتيجة بصرية واضحة، ثم شرح للقرار الذي صنع الفرق — لا مجرد استعراض.',
    hookTemplate: 'هذا قبل، وهذا بعد. الفرق مو في التصميم، الفرق في {niche}.',
    platforms: ['instagram', 'linkedin', 'youtube'],
    niches: ['beauty', 'realestate', 'marketing', 'ecommerce', 'food'],
    regions: ['sa', 'gulf', 'global'],
    momentum: 0.86,
    saturation: 0.38,
    stage: 'rising',
    bestFor: 'conversion',
    effort: 'medium',
    formats: ['carousel', 'reel'],
  },
  {
    key: 'things-i-wish-i-knew',
    title: 'أشياء تمنيت لو عرفتها قبل سنتين',
    summary: 'قصة شخصية بمحتوى تعليمي مضمّن. الأعلى في الحفظ والمشاركة.',
    hookTemplate: 'قبل سنتين في {niche} كنت أسوي هذا الخطأ… وكلفني وقت وفلوس.',
    platforms: ['linkedin', 'instagram', 'youtube'],
    niches: ['marketing', 'ecommerce', 'education', 'realestate'],
    regions: ['sa', 'gulf', 'global'],
    momentum: 0.81,
    saturation: 0.35,
    stage: 'trending',
    bestFor: 'trust',
    effort: 'low',
    formats: ['carousel', 'post'],
  },
  {
    key: 'one-screen-checklist',
    title: 'تشيك ليست في شاشة واحدة',
    summary: 'قيمة كثيفة قابلة للحفظ. أفضل فورمات لرفع معدل الحفظ خلال أسبوع.',
    hookTemplate: 'احفظ هذي القائمة: 7 نقاط تراجعها قبل أي حملة {niche}.',
    platforms: ['instagram', 'linkedin', 'tiktok'],
    niches: ['marketing', 'ecommerce', 'fitness', 'education', 'food'],
    regions: ['sa', 'gulf', 'global'],
    momentum: 0.76,
    saturation: 0.55,
    stage: 'peaking',
    bestFor: 'trust',
    effort: 'low',
    formats: ['carousel', 'post'],
  },
  {
    key: 'client-objection',
    title: 'اعتراض العميل الحقيقي',
    summary: 'تأخذ اعتراضًا تسمعه كل أسبوع وتجاوب عليه علنًا. أقرب فورمات للمبيعات.',
    hookTemplate: '"غالي" — تعال أشرح لك وش تدفع مقابله فعليًا في {niche}.',
    platforms: ['instagram', 'linkedin', 'tiktok', 'youtube'],
    niches: ['marketing', 'realestate', 'ecommerce', 'beauty'],
    regions: ['sa', 'gulf'],
    momentum: 0.88,
    saturation: 0.27,
    stage: 'rising',
    bestFor: 'conversion',
    effort: 'low',
    formats: ['reel', 'post'],
  },
  {
    key: 'day-in-the-life-work',
    title: 'يوم في الشغل — النسخة الصادقة',
    summary: 'خلف الكواليس بلا تجميل. يبني الألفة ويقلل حاجز الثقة قبل الشراء.',
    hookTemplate: 'يوم كامل في {niche} بدون فلترة — بما فيها الجزء المزعج.',
    platforms: ['tiktok', 'instagram', 'youtube'],
    niches: ['food', 'beauty', 'realestate', 'fitness', 'marketing'],
    regions: ['sa', 'gulf', 'global'],
    momentum: 0.72,
    saturation: 0.58,
    stage: 'steady',
    bestFor: 'trust',
    effort: 'high',
    formats: ['reel', 'short'],
  },
  {
    key: 'teardown',
    title: 'تفكيك حالة حقيقية',
    summary: 'تأخذ مثالًا معروفًا وتشرح لماذا نجح. يضعك في موقع الخبير.',
    hookTemplate: 'ليش نجح هذا المحتوى في {niche}؟ خل نفككه سطر سطر.',
    platforms: ['linkedin', 'youtube', 'instagram'],
    niches: ['marketing', 'ecommerce', 'education'],
    regions: ['sa', 'gulf', 'global'],
    momentum: 0.79,
    saturation: 0.33,
    stage: 'rising',
    bestFor: 'trust',
    effort: 'medium',
    formats: ['carousel', 'post', 'short'],
  },
  {
    key: 'myth-vs-reality',
    title: 'المتوقع مقابل الواقع',
    summary: 'تصحيح اعتقاد شائع. يولّد نقاشًا في التعليقات ويرفع الوصول.',
    hookTemplate: 'الناس تتوقع إن {niche} كذا… الواقع مختلف تمامًا.',
    platforms: ['instagram', 'tiktok', 'linkedin'],
    niches: ['fitness', 'beauty', 'marketing', 'realestate', 'food', 'education'],
    regions: ['sa', 'gulf', 'global'],
    momentum: 0.84,
    saturation: 0.41,
    stage: 'trending',
    bestFor: 'reach',
    effort: 'low',
    formats: ['reel', 'carousel'],
  },
  {
    key: 'numbers-post',
    title: 'رقم واحد يغيّر القرار',
    summary: 'رقم من بياناتك أنت. أقوى دليل تملكه ولا يستطيع أحد نسخه.',
    hookTemplate: 'رقم من تجربتنا في {niche} غيّر طريقتنا بالكامل.',
    platforms: ['linkedin', 'instagram'],
    niches: ['marketing', 'ecommerce', 'realestate', 'education'],
    regions: ['sa', 'gulf', 'global'],
    momentum: 0.74,
    saturation: 0.24,
    stage: 'rising',
    bestFor: 'conversion',
    effort: 'low',
    formats: ['post', 'carousel'],
  },
  {
    key: 'faceless-tutorial',
    title: 'شرح بدون ظهور',
    summary: 'تسجيل شاشة أو B-roll مع تعليق. الأسرع تنفيذًا لمن لا يحب الكاميرا.',
    hookTemplate: 'بثلاث خطوات فقط: كيف تسوي هذا في {niche} بدون ما تظهر.',
    platforms: ['youtube', 'tiktok', 'instagram'],
    niches: ['marketing', 'ecommerce', 'education'],
    regions: ['sa', 'gulf', 'global'],
    momentum: 0.8,
    saturation: 0.46,
    stage: 'trending',
    bestFor: 'reach',
    effort: 'medium',
    formats: ['short', 'reel'],
  },
];

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'youtube', label: 'YouTube Shorts' },
];

const NICHES = [
  { id: 'marketing', label: 'تسويق وصناعة محتوى' },
  { id: 'ecommerce', label: 'تجارة إلكترونية' },
  { id: 'realestate', label: 'عقار' },
  { id: 'beauty', label: 'تجميل وعناية' },
  { id: 'food', label: 'مطاعم وأغذية' },
  { id: 'fitness', label: 'رياضة ولياقة' },
  { id: 'education', label: 'تعليم وتدريب' },
];

const REGIONS = [
  { id: 'sa', label: 'السعودية' },
  { id: 'gulf', label: 'الخليج' },
  { id: 'global', label: 'عالمي' },
];

const GOALS = [
  { id: 'reach', label: 'زيادة الوصول' },
  { id: 'trust', label: 'بناء الثقة' },
  { id: 'conversion', label: 'جذب عملاء' },
  { id: 'sales', label: 'مبيعات مباشرة' },
];

const STAGE_LABELS = {
  rising: { label: 'صاعد', tone: 'rise' },
  trending: { label: 'رائج', tone: 'rise' },
  peaking: { label: 'في الذروة', tone: 'peak' },
  steady: { label: 'مستقر', tone: 'steady' },
};

const nicheLabel = (id) => NICHES.find((n) => n.id === id)?.label || 'مجالك';

/**
 * Score = momentum (how fast the format is growing)
 *       + platform/niche fit
 *       - saturation (how crowded it already is)
 * The result is stable for the same filters, so a user can compare runs.
 */
function scoreTrend(trend, { platform, niche, goal }) {
  let score = trend.momentum * 70;
  score += trend.platforms.includes(platform) ? 18 : 4;
  score += trend.niches.includes(niche) ? 14 : 2;
  score -= trend.saturation * 18;
  if (goal && trend.bestFor === goal) score += 6;
  return Math.max(1, Math.min(99, Math.round(score)));
}

function listTrends({ platform = 'instagram', niche = 'marketing', region = 'sa', goal } = {}) {
  return CATALOG.filter((trend) => trend.regions.includes(region))
    .map((trend) => ({
      key: trend.key,
      title: trend.title,
      summary: trend.summary,
      hook: trend.hookTemplate.replace('{niche}', nicheLabel(niche)),
      stage: trend.stage,
      stageLabel: STAGE_LABELS[trend.stage].label,
      tone: STAGE_LABELS[trend.stage].tone,
      bestFor: trend.bestFor,
      effort: trend.effort,
      formats: trend.formats,
      platformFit: trend.platforms.includes(platform),
      nicheFit: trend.niches.includes(niche),
      score: scoreTrend(trend, { platform, niche, goal }),
      source: 'MOHTAWA curated format library',
    }))
    .sort((a, b) => b.score - a.score);
}

const findTrend = (key) => CATALOG.find((trend) => trend.key === key) || null;

module.exports = {
  CATALOG,
  PLATFORMS,
  NICHES,
  REGIONS,
  GOALS,
  listTrends,
  findTrend,
  nicheLabel,
};

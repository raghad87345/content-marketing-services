'use strict';

/**
 * Content Studio — the offline generator.
 *
 * MOHTAWA works with no API key at all: this module composes a complete content
 * package (hooks, script beats, shot list, caption, hashtags, CTA) from the
 * brand brain, the selected goal, the platform and — optionally — a trend format
 * from the radar. When ANTHROPIC_API_KEY is present, `ai.js` asks Claude for the
 * same shape and falls back here on any failure, so the feature never breaks.
 */

const { findTrend, nicheLabel } = require('./trends');

const GOAL_PLAYBOOK = {
  reach: {
    label: 'زيادة الوصول',
    intent: 'يوقف التمرير ويستحق المشاركة',
    beatStyle: 'ابدأ بالمشكلة، اعطِ نقطة واحدة قوية، واختم بجملة قابلة للاقتباس.',
    ctas: [
      'شاركه مع شخص يحتاج يسمع هذا الكلام.',
      'احفظه، وارجع له قبل أي منشور جاي.',
      'اكتب لي في التعليقات: وش أكثر نقطة انطبقت عليك؟',
    ],
  },
  trust: {
    label: 'بناء الثقة',
    intent: 'يثبت أنك تفهم المجال من الداخل',
    beatStyle: 'ابدأ بموقف حقيقي، اشرح القرار الذي اتخذته، ثم عمّم الدرس.',
    ctas: [
      'إذا كان هذا مفيدًا، تابعني — أنشر تفكيكًا كل أسبوع.',
      'احفظ البوست وطبّق نقطة واحدة منه هذا الأسبوع.',
      'قل لي في التعليقات وش أكثر جزء تصعب عليك.',
    ],
  },
  conversion: {
    label: 'جذب عملاء',
    intent: 'يحوّل المتابع المهتم إلى محادثة',
    beatStyle: 'ابدأ باعتراض حقيقي، فكّكه، ثم اعرض الطريق القصير للحل.',
    ctas: [
      'راسلني بكلمة «خطة» وأرسل لك الخطوات كاملة.',
      'الرابط في البايو — احجز مكالمة 15 دقيقة.',
      'علّق بكلمة «أبغى» وأرسل لك القالب.',
    ],
  },
  sales: {
    label: 'مبيعات مباشرة',
    intent: 'يزيل آخر حاجز قبل الشراء',
    beatStyle: 'اعرض النتيجة، اذكر لمن هي ولمن ليست، ثم اطلب الخطوة بوضوح.',
    ctas: [
      'العرض متاح هذا الأسبوع فقط — الرابط في البايو.',
      'اطلب الآن، وإذا ما ناسبك رجّعه خلال 14 يوم.',
      'اضغط الرابط واختر الباقة المناسبة لحجم مشروعك.',
    ],
  },
};

const PLATFORM_SPEC = {
  instagram: {
    label: 'Instagram Reel',
    lengthHint: '20–35 ثانية',
    captionHint: 'أول سطرين هما ما يظهر قبل «المزيد» — اجعلهما مستقلين.',
    hashtags: 3,
  },
  tiktok: {
    label: 'TikTok',
    lengthHint: '25–45 ثانية',
    captionHint: 'كابشن قصير وسؤال مباشر يرفع التعليقات.',
    hashtags: 4,
  },
  linkedin: {
    label: 'LinkedIn',
    lengthHint: '600–900 حرف',
    captionHint: 'سطر أول قصير، ثم فراغ، ثم القصة. بدون هاشتاقات كثيرة.',
    hashtags: 2,
  },
  youtube: {
    label: 'YouTube Short',
    lengthHint: '30–50 ثانية',
    captionHint: 'العنوان يحمل الوعد، والوصف يذكر الخطوة التالية.',
    hashtags: 3,
  },
};

const EXECUTION_SHOTS = {
  faceless: (topic) => [
    'لقطة 1 — نص الهوك على خلفية بسيطة، زووم بطيء للداخل.',
    `لقطة 2 — تسجيل شاشة يوضّح "${topic}" خطوة بخطوة.`,
    'لقطة 3 — B-roll لليد وهي تكتب أو ترتب، مع النص الأساسي.',
    'لقطة 4 — تشيك ليست متحركة تلخّص النقاط.',
    'لقطة 5 — شاشة الـCTA بجملة واحدة كبيرة.',
  ],
  talking: (topic) => [
    'لقطة 1 — وجه قريب، تبدأ بالهوك مباشرة بدون سلام.',
    'لقطة 2 — نفس الإطار مع قطع سريع (jump cut) عند كل نقطة.',
    `لقطة 3 — B-roll قصير يوضّح "${topic}" أثناء الكلام.`,
    'لقطة 4 — رجوع للوجه لجملة الخلاصة.',
    'لقطة 5 — نص الـCTA على الشاشة مع بقائك في الكادر.',
  ],
  screen: (topic) => [
    'لقطة 1 — الشاشة قبل التعديل، مع نص الهوك فوقها.',
    `لقطة 2 — تنفيذ "${topic}" مباشرة مع مؤشر واضح.`,
    'لقطة 3 — زووم على النتيجة/الرقم الذي تغيّر.',
    'لقطة 4 — مقارنة قبل/بعد جنبًا إلى جنب.',
    'لقطة 5 — شريحة أخيرة فيها الخطوة التالية.',
  ],
  carousel: (topic) => [
    'شريحة 1 — الهوك بخط كبير، بدون تفاصيل.',
    `شريحة 2 — لماذا "${topic}" مهم الآن (سطران).`,
    'شريحة 3 — الخطأ الشائع.',
    'شريحة 4 — الطريقة الصحيحة، بمثال رقمي.',
    'شريحة 5 — تشيك ليست قابلة للحفظ.',
    'شريحة 6 — الـCTA وخطوة واحدة فقط.',
  ],
};

const TONE_TOUCH = {
  saudi: 'بلهجة سعودية بيضاء، جمل قصيرة ومباشرة.',
  msa: 'بفصحى معاصرة واضحة بلا تكلّف.',
  casual: 'بنبرة ودّية قريبة كأنك تتكلم مع صديق.',
  professional: 'بنبرة مهنية رصينة تناسب قرار شراء.',
};

const pick = (list, seed) => list[Math.abs(seed) % list.length];

const hashSeed = (text) => {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return hash;
};

function buildHooks({ topic, niche, goal, trend }) {
  const audience = nicheLabel(niche);
  // The topic often already ends in punctuation; stripping it keeps hooks clean.
  const stem = topic.replace(/[?؟.!،\s]+$/u, '');
  const base = [
    `${stem}؟ المشكلة غالبًا مو في اللي تتوقعه.`,
    `لو عندك 30 ثانية، هذي أهم نقطة في ${stem}.`,
    `أغلب من يشتغل في ${audience} يسوي هذا الخطأ في ${stem}.`,
    `توقف — قبل ما تنشر شيء عن ${stem}، اقرأ هذي.`,
    `${stem}: ثلاث نقاط فقط، وكلها قابلة للتطبيق اليوم.`,
  ];
  if (trend?.hookTemplate) base.unshift(trend.hookTemplate.replace('{niche}', audience));
  if (goal === 'conversion' || goal === 'sales') {
    base.unshift(`"${stem}" — تعال أشرح لك وش تدفع مقابله فعليًا.`);
  }
  return base.slice(0, 4);
}

function buildScript({ topic, platform, playbook }) {
  const spec = PLATFORM_SPEC[platform];
  if (platform === 'linkedin') {
    return [
      { label: 'الافتتاحية', text: `سطر واحد صادم أو رقم حقيقي عن ${topic}.` },
      { label: 'القصة', text: 'موقف حصل معك فعلًا — متى، وماذا فعلت، وما كانت النتيجة.' },
      { label: 'الدرس', text: `عمّم الدرس بحيث يطبقه القارئ على ${topic} عنده.` },
      { label: 'الخطوة', text: playbook.beatStyle },
    ];
  }
  return [
    { label: '0–3 ثوانٍ', text: `الهوك مباشرة على الشاشة وبصوتك، بدون مقدمة. الفكرة: ${topic}.` },
    { label: '3–8 ثوانٍ', text: 'وضّح المشكلة بمثال ملموس واحد، ورقم إن وُجد.' },
    { label: '8–20 ثانية', text: playbook.beatStyle },
    { label: '20–28 ثانية', text: 'اعطِ الخلاصة في جملة واحدة تصلح للاقتباس.' },
    { label: 'الختام', text: `الـCTA — طلب واحد فقط. المدة المستهدفة ${spec.lengthHint}.` },
  ];
}

function buildHashtags({ niche, platform, count }) {
  const byNiche = {
    marketing: ['#التسويق_بالمحتوى', '#صناعة_المحتوى', '#تسويق_رقمي', '#محتوى'],
    ecommerce: ['#تجارة_إلكترونية', '#متجر_إلكتروني', '#مبيعات', '#تسويق'],
    realestate: ['#عقار', '#استثمار_عقاري', '#تسويق_عقاري', '#سكن'],
    beauty: ['#العناية_بالبشرة', '#تجميل', '#روتين', '#جمال'],
    food: ['#مطاعم', '#طبخ', '#وصفات', '#فود'],
    fitness: ['#لياقة', '#تمارين', '#صحة', '#رياضة'],
    education: ['#تعليم', '#تطوير_الذات', '#مهارات', '#تدريب'],
  };
  const platformTag = { instagram: '#ريلز', tiktok: '#تيك_توك', youtube: '#شورتس', linkedin: '#لينكدإن' };
  return [...(byNiche[niche] || byNiche.marketing), platformTag[platform] || '#محتوى'].slice(0, count);
}

/**
 * @returns {object} A complete, ready-to-shoot content package.
 */
function generatePackage(input) {
  const {
    topic = 'كيف تجعل المحتوى يجلب لك عملاء',
    goal = 'reach',
    platform = 'instagram',
    execution = 'faceless',
    tone = 'saudi',
    niche = 'marketing',
    brandName = '',
    audience = '',
    trendKey = null,
  } = input || {};

  const playbook = GOAL_PLAYBOOK[goal] || GOAL_PLAYBOOK.reach;
  const spec = PLATFORM_SPEC[platform] || PLATFORM_SPEC.instagram;
  const trend = trendKey ? findTrend(trendKey) : null;
  const seed = hashSeed(`${topic}|${goal}|${platform}|${tone}`);
  const hooks = buildHooks({ topic, niche, goal, trend });
  const shotBuilder = EXECUTION_SHOTS[execution] || EXECUTION_SHOTS.faceless;

  const captionOpener = `${topic}.`;
  const caption = [
    captionOpener,
    '',
    `الفكرة باختصار: ${playbook.intent}. ${TONE_TOUCH[tone] || TONE_TOUCH.saudi}`,
    audience ? `مكتوب لـ: ${audience}.` : '',
    '',
    spec.captionHint,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    title: topic,
    goal,
    goalLabel: playbook.label,
    platform,
    platformLabel: spec.label,
    hook: hooks[0],
    hooks,
    script: buildScript({ topic, platform, playbook }),
    shotList: shotBuilder(topic),
    caption,
    hashtags: buildHashtags({ niche, platform, count: spec.hashtags }),
    cta: pick(playbook.ctas, seed),
    trend: trend ? { key: trend.key, title: trend.title } : null,
    notes: [
      `النبرة: ${TONE_TOUCH[tone] || TONE_TOUCH.saudi}`,
      brandName ? `البراند: ${brandName}.` : '',
      `المدة/الطول المستهدف: ${spec.lengthHint}.`,
    ].filter(Boolean),
    source: 'template',
  };
}

module.exports = { generatePackage, GOAL_PLAYBOOK, PLATFORM_SPEC, EXECUTION_SHOTS, TONE_TOUCH };

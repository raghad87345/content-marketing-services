'use strict';

/**
 * Video Intelligence.
 *
 * The browser measures the clip locally (duration, aspect ratio, and a
 * frame-by-frame brightness/colour sample that yields an estimate of where the
 * cuts are) and sends those measurements here. Nothing is uploaded, and nothing
 * is guessed: every score below is derived from a measurement or from something
 * the user explicitly declared (hook line, CTA, burned-in captions).
 *
 * The output is a heuristic read of short-form editing craft, not a prediction
 * of views. The API labels it as such so the UI can too.
 */

const PLATFORM_TARGETS = {
  instagram: { ideal: [15, 34], hardMax: 90, aspect: 9 / 16, name: 'Instagram Reels' },
  tiktok: { ideal: [15, 40], hardMax: 180, aspect: 9 / 16, name: 'TikTok' },
  youtube: { ideal: [20, 50], hardMax: 60, aspect: 9 / 16, name: 'YouTube Shorts' },
  linkedin: { ideal: [30, 75], hardMax: 180, aspect: 1, name: 'LinkedIn' },
};

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));

const fmtTime = (seconds) => {
  const total = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

function scoreDuration(duration, target) {
  const [min, max] = target.ideal;
  if (duration >= min && duration <= max) return 95;
  if (duration < min) {
    // Too short: the viewer never gets to the payoff.
    return clamp(60 + (duration / min) * 30);
  }
  if (duration <= target.hardMax) {
    const overshoot = (duration - max) / (target.hardMax - max);
    return clamp(88 - overshoot * 40);
  }
  return clamp(45 - (duration - target.hardMax) / 10);
}

function scorePacing(duration, cuts) {
  if (!duration) return { score: 50, cutsPerMinute: 0, longestHold: 0 };
  const cutsPerMinute = (cuts.length / duration) * 60;
  // Short-form editing lands between ~20 and ~60 visual changes per minute.
  let score;
  if (cutsPerMinute >= 20 && cutsPerMinute <= 60) score = 92;
  else if (cutsPerMinute < 20) score = clamp(45 + cutsPerMinute * 2.2);
  else score = clamp(92 - (cutsPerMinute - 60) * 0.7);

  const boundaries = [0, ...cuts, duration];
  let longestHold = 0;
  let longestHoldAt = 0;
  for (let i = 1; i < boundaries.length; i += 1) {
    const gap = boundaries[i] - boundaries[i - 1];
    if (gap > longestHold) {
      longestHold = gap;
      longestHoldAt = boundaries[i - 1];
    }
  }
  if (longestHold > 6) score = clamp(score - (longestHold - 6) * 4);
  return {
    score: clamp(score),
    cutsPerMinute: Math.round(cutsPerMinute),
    longestHold: Number(longestHold.toFixed(1)),
    longestHoldAt,
  };
}

function scoreHook(hookText, firstCutAt) {
  const text = (hookText || '').trim();
  if (!text) return { score: 40, reasons: ['لم تُدخل نص الهوك، فلا يمكن تقييمه.'] };
  const reasons = [];
  let score = 62;
  const words = text.split(/\s+/).filter(Boolean);

  if (words.length <= 12) {
    score += 12;
  } else {
    reasons.push('الهوك أطول من 12 كلمة — اختصره ليُقرأ في ثانيتين.');
    score -= 8;
  }
  if (/[؟?]/.test(text)) {
    score += 8;
    reasons.push('يبدأ بسؤال مباشر، وهذا يرفع الاحتفاظ في أول 3 ثوانٍ.');
  }
  if (/\d/.test(text)) {
    score += 6;
    reasons.push('يحتوي رقمًا محددًا، والأرقام ترفع المصداقية.');
  }
  if (/(لا تفعل|لا تسوي|توقف|خطأ|قبل ما|احذر|أبدًا)/.test(text)) {
    score += 7;
    reasons.push('صياغة تحذيرية/سلبية، وهي من أقوى صيغ الهوك.');
  }
  if (/^(اليوم|في هذا الفيديو|أهلًا|مرحبًا|السلام)/.test(text)) {
    score -= 14;
    reasons.push('يبدأ بمقدمة ترحيبية — احذفها وابدأ من المشكلة مباشرة.');
  }
  if (firstCutAt !== null && firstCutAt > 4) {
    score -= 6;
    reasons.push(`أول تغيّر بصري عند ${fmtTime(firstCutAt)} — أضف قطعًا قبل الثانية الثالثة.`);
  }
  return { score: clamp(score), reasons };
}

function scoreFraming(width, height, target) {
  if (!width || !height) return { score: 60, aspectLabel: 'غير معروف' };
  const ratio = width / height;
  const aspectLabel = ratio < 0.7 ? '9:16 عمودي' : ratio > 1.3 ? '16:9 أفقي' : '1:1 مربع';
  const distance = Math.abs(ratio - target.aspect);
  const score = clamp(96 - distance * 90);
  return { score, aspectLabel, ratio: Number(ratio.toFixed(2)) };
}

function scoreCta(ctaText) {
  const text = (ctaText || '').trim();
  if (!text) return { score: 35, reasons: ['لا يوجد CTA — أضف خطوة واحدة واضحة في آخر 3 ثوانٍ.'] };
  const reasons = [];
  let score = 68;
  if (/(احفظ|شارك|علّق|اكتب|جرّب|حمّل|سجّل|راسلني|تابع)/.test(text)) {
    score += 18;
    reasons.push('يبدأ بفعل أمر واضح.');
  } else {
    reasons.push('ابدأ الـCTA بفعل أمر مباشر (احفظ / علّق / جرّب).');
  }
  if (text.split(/\s+/).length > 18) {
    score -= 12;
    reasons.push('الـCTA طويل — اطلب شيئًا واحدًا فقط.');
  }
  return { score: clamp(score), reasons };
}

/**
 * @param {object} input Measurements from the browser plus declared metadata.
 * @returns {object} Scores, findings and a retention timeline.
 */
function analyzeVideo(input = {}) {
  const platform = PLATFORM_TARGETS[input.platform] ? input.platform : 'instagram';
  const target = PLATFORM_TARGETS[platform];
  const duration = Number(input.durationSeconds) || 0;
  const cuts = Array.isArray(input.cuts)
    ? input.cuts.map(Number).filter((t) => Number.isFinite(t) && t > 0 && t < duration).sort((a, b) => a - b)
    : [];

  const durationScore = scoreDuration(duration, target);
  const pacing = scorePacing(duration, cuts);
  const hook = scoreHook(input.hookText, cuts.length ? cuts[0] : null);
  const framing = scoreFraming(Number(input.width), Number(input.height), target);
  const cta = scoreCta(input.ctaText);
  const captionsScore = input.hasCaptions ? 94 : 46;

  const dimensions = [
    { key: 'hook', label: 'الهوك', score: hook.score, weight: 0.26 },
    { key: 'pacing', label: 'الإيقاع والقص', score: pacing.score, weight: 0.2 },
    { key: 'duration', label: 'المدة', score: durationScore, weight: 0.16 },
    { key: 'captions', label: 'النصوص على الشاشة', score: captionsScore, weight: 0.14 },
    { key: 'framing', label: 'الإطار والأبعاد', score: framing.score, weight: 0.12 },
    { key: 'cta', label: 'الـCTA', score: cta.score, weight: 0.12 },
  ];

  const overall = clamp(
    dimensions.reduce((sum, dim) => sum + dim.score * dim.weight, 0)
  );

  // Retention risks: long static stretches are where viewers leave.
  const risks = [];
  const boundaries = [0, ...cuts, duration];
  for (let i = 1; i < boundaries.length; i += 1) {
    const start = boundaries[i - 1];
    const gap = boundaries[i] - start;
    if (gap >= 5) {
      risks.push({
        at: Number(start.toFixed(1)),
        atLabel: fmtTime(start),
        seconds: Number(gap.toFixed(1)),
        severity: gap >= 8 ? 'high' : 'medium',
        message: `مشهد ثابت ${gap.toFixed(1)} ثانية بدون تغيّر بصري — اقطعه أو أضف Pattern Interrupt.`,
      });
    }
  }

  const recommendations = [];
  const weakest = [...dimensions].sort((a, b) => a.score - b.score)[0];

  if (hook.score < 75) {
    recommendations.push({
      priority: 1,
      area: 'hook',
      title: 'قوِّ أول 3 ثوانٍ',
      body:
        hook.reasons[0] ||
        'اجعل الجملة الأولى تصف مشكلة المشاهد بكلماته، لا تعريفًا بنفسك أو بالموضوع.',
    });
  }
  if (durationScore < 75) {
    recommendations.push({
      priority: 2,
      area: 'duration',
      title: `اضبط المدة لـ${target.name}`,
      body:
        duration > target.ideal[1]
          ? `المدة ${fmtTime(duration)}. أفضل نطاق هنا ${target.ideal[0]}–${target.ideal[1]} ثانية؛ احذف أي مشهد لا يضيف معلومة.`
          : `المدة ${fmtTime(duration)} قصيرة على الفكرة. أضف مثالًا واحدًا ملموسًا قبل الـCTA.`,
    });
  }
  if (pacing.longestHold >= 5) {
    recommendations.push({
      priority: 2,
      area: 'pacing',
      title: `عالج الثبات عند ${fmtTime(pacing.longestHoldAt)}`,
      body: `أطول مشهد ثابت ${pacing.longestHold} ثانية. أضف قطعًا أو زووم أو نصًا متحركًا في منتصفه.`,
    });
  }
  if (!input.hasCaptions) {
    recommendations.push({
      priority: 1,
      area: 'captions',
      title: 'أضف نصوصًا محروقة على الفيديو',
      body: 'أغلب المشاهدات تبدأ بدون صوت. النص على الشاشة هو ما يوقف التمرير.',
    });
  }
  if (framing.score < 75) {
    recommendations.push({
      priority: 3,
      area: 'framing',
      title: 'صحّح أبعاد الفيديو',
      body: `الأبعاد الحالية ${framing.aspectLabel}. ${target.name} يعرض ${
        target.aspect === 1 ? '1:1 أو 4:5' : '9:16'
      } بأفضل شكل.`,
    });
  }
  if (cta.score < 70) {
    recommendations.push({
      priority: 2,
      area: 'cta',
      title: 'اجعل الطلب واحدًا وواضحًا',
      body: cta.reasons[0] || 'اطلب فعلًا واحدًا فقط، مرتبطًا بما شرحته للتو.',
    });
  }

  return {
    platform,
    platformName: target.name,
    overall,
    verdict: overall >= 85 ? 'قوي' : overall >= 70 ? 'جيد' : overall >= 55 ? 'يحتاج تحسين' : 'ضعيف',
    dimensions: dimensions.map(({ key, label, score }) => ({ key, label, score })),
    weakest: { key: weakest.key, label: weakest.label, score: weakest.score },
    measurements: {
      durationSeconds: Number(duration.toFixed(1)),
      durationLabel: fmtTime(duration),
      width: Number(input.width) || null,
      height: Number(input.height) || null,
      aspectLabel: framing.aspectLabel,
      cuts: cuts.length,
      cutsPerMinute: pacing.cutsPerMinute,
      longestHold: pacing.longestHold,
      sizeBytes: Number(input.sizeBytes) || null,
    },
    notes: [...hook.reasons, ...cta.reasons],
    risks: risks.slice(0, 5),
    recommendations: recommendations.sort((a, b) => a.priority - b.priority).slice(0, 5),
    method: 'heuristic',
    disclaimer:
      'التحليل قائم على قياسات الفيديو (المدة، الأبعاد، تغيّرات المشهد) وما أدخلته من هوك وCTA — وليس تنبؤًا بعدد المشاهدات.',
  };
}

module.exports = { analyzeVideo, PLATFORM_TARGETS };

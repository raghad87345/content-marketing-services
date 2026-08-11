'use strict';

/**
 * Claude adapter for the Content Studio.
 *
 * Optional by design: when ANTHROPIC_API_KEY is absent (or any request fails)
 * the deterministic generator in `studio.js` answers instead, so the product is
 * fully usable out of the box and degrades to templates rather than to an error.
 */

const config = require('../config');
const { generatePackage, GOAL_PLAYBOOK, PLATFORM_SPEC, TONE_TOUCH } = require('./studio');
const { findTrend, nicheLabel } = require('./trends');

let client = null;

function getClient() {
  if (!config.ai.enabled) return null;
  if (client) return client;
  // Required lazily so the dependency is never loaded in template-only mode.
  const Anthropic = require('@anthropic-ai/sdk');
  client = new Anthropic({ apiKey: config.ai.apiKey });
  return client;
}

const stringArray = (description, maxItems) => ({
  type: 'array',
  description,
  items: { type: 'string' },
  maxItems,
});

const PACKAGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    hooks: stringArray('أربع صيغ مختلفة لأول جملة في المحتوى، كل واحدة أقل من 14 كلمة.', 4),
    script: {
      type: 'array',
      description: 'مقاطع السكربت بالترتيب الزمني.',
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string', description: 'المدة أو اسم المقطع، مثل "0–3 ثوانٍ".' },
          text: { type: 'string', description: 'ما يُقال أو يُعرض في هذا المقطع.' },
        },
        required: ['label', 'text'],
      },
    },
    shotList: stringArray('قائمة اللقطات أو الشرائح، لقطة في كل عنصر.', 6),
    caption: { type: 'string', description: 'الكابشن الجاهز للنشر.' },
    hashtags: stringArray('هاشتاقات عربية مناسبة، تبدأ بـ #.', 5),
    cta: { type: 'string', description: 'طلب واحد واضح في جملة واحدة.' },
    notes: stringArray('ملاحظات تنفيذية قصيرة للمنشئ.', 3),
  },
  required: ['hooks', 'script', 'shotList', 'caption', 'hashtags', 'cta', 'notes'],
};

const SYSTEM_PROMPT = [
  'أنت استراتيجي محتوى عربي يعمل داخل منصة MOHTAWA.',
  'مهمتك تحويل هدف تجاري إلى محتوى جاهز للتصوير أو النشر، لا إلى نصائح عامة.',
  'اكتب بالعربية دائمًا، بجمل قصيرة قابلة للنطق، وبلا مقدمات ترحيبية.',
  'كل مخرج يجب أن يكون قابلًا للتنفيذ اليوم: أمثلة ملموسة، أرقام حين تتوفر، وطلب واحد فقط في الـCTA.',
  'لا تخترع أرقامًا أو نتائج عن البراند؛ استخدم فقط ما ورد في المدخلات.',
].join(' ');

function buildUserPrompt(input) {
  const trend = input.trendKey ? findTrend(input.trendKey) : null;
  const playbook = GOAL_PLAYBOOK[input.goal] || GOAL_PLAYBOOK.reach;
  const spec = PLATFORM_SPEC[input.platform] || PLATFORM_SPEC.instagram;

  const lines = [
    `الموضوع: ${input.topic}`,
    `الهدف: ${playbook.label} — المطلوب محتوى ${playbook.intent}.`,
    `المنصة: ${spec.label} (الطول المستهدف ${spec.lengthHint}).`,
    `طريقة التنفيذ: ${input.execution}.`,
    `النبرة: ${TONE_TOUCH[input.tone] || TONE_TOUCH.saudi}`,
    `المجال: ${nicheLabel(input.niche)}.`,
  ];
  if (input.brandName) lines.push(`اسم البراند: ${input.brandName}.`);
  if (input.audience) lines.push(`الجمهور: ${input.audience}.`);
  if (input.brandVoice) lines.push(`صوت البراند: ${input.brandVoice}.`);
  if (input.offer) lines.push(`ما يبيعه البراند: ${input.offer}.`);
  if (trend) {
    lines.push(`استخدم فورمات الترند: "${trend.title}" — ${trend.summary}`);
  }
  lines.push(`عدد الهاشتاقات المطلوب: ${spec.hashtags}.`);
  lines.push(spec.captionHint);
  return lines.join('\n');
}

/**
 * Asks Claude for a content package, falling back to the template generator.
 * @returns {Promise<object>} The package, with `source` set to 'ai' or 'template'.
 */
async function generateWithAI(input) {
  const fallback = () => generatePackage(input);
  const anthropic = getClient();
  if (!anthropic) return fallback();

  const request = {
    model: config.ai.model,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(input) }],
    output_config: {
      effort: config.ai.effort,
      format: { type: 'json_schema', schema: PACKAGE_SCHEMA },
    },
  };

  let message;
  try {
    // Server-side fallbacks re-run a declined request on another model in the
    // same call; if the beta is unavailable we simply retry without it.
    message = await anthropic.beta.messages.create({
      ...request,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
  } catch {
    try {
      message = await anthropic.messages.create(request);
    } catch (err) {
      console.error('[ai] generation failed, using template generator:', err.message);
      return { ...fallback(), aiError: err.message };
    }
  }

  if (message.stop_reason === 'refusal') {
    console.warn('[ai] request was declined by safety classifiers; using template generator.');
    return fallback();
  }

  const textBlock = message.content.find((block) => block.type === 'text');
  if (!textBlock) return fallback();

  let parsed;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    console.error('[ai] response was not valid JSON; using template generator.');
    return fallback();
  }

  const base = fallback();
  return {
    ...base,
    hook: parsed.hooks?.[0] || base.hook,
    hooks: parsed.hooks?.length ? parsed.hooks : base.hooks,
    script: parsed.script?.length ? parsed.script : base.script,
    shotList: parsed.shotList?.length ? parsed.shotList : base.shotList,
    caption: parsed.caption || base.caption,
    hashtags: parsed.hashtags?.length ? parsed.hashtags : base.hashtags,
    cta: parsed.cta || base.cta,
    notes: parsed.notes?.length ? parsed.notes : base.notes,
    source: 'ai',
    model: config.ai.model,
  };
}

module.exports = { generateWithAI, PACKAGE_SCHEMA, buildUserPrompt };

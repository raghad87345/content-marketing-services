'use strict';

/**
 * Smart calendar.
 *
 * A month of content is planned as a repeating weekly rhythm that balances the
 * three jobs a post can do — reach, trust, conversion — instead of publishing
 * whatever comes to mind. The mix shifts with the brand's primary goal, and the
 * plan is deterministic for a given month so re-opening the calendar does not
 * reshuffle everything the user already scheduled.
 */

const { listTrends } = require('./trends');

const MIX_BY_GOAL = {
  reach: { reach: 0.5, trust: 0.3, conversion: 0.2 },
  trust: { reach: 0.3, trust: 0.5, conversion: 0.2 },
  conversion: { reach: 0.3, trust: 0.3, conversion: 0.4 },
  sales: { reach: 0.25, trust: 0.25, conversion: 0.5 },
};

const PILLAR_LABELS = {
  reach: { label: 'وصول', tone: 'purple' },
  trust: { label: 'ثقة', tone: 'green' },
  conversion: { label: 'تحويل', tone: 'yellow' },
};

// Publishing days that consistently perform for Gulf audiences: mid-week and
// the start of the weekend. Index matches JS getDay() (0 = Sunday).
const PREFERRED_DAYS = [0, 2, 4, 6, 1, 3, 5];

const FORMAT_BY_PILLAR = {
  reach: 'Reel',
  trust: 'Carousel',
  conversion: 'Reel',
};

/** Distributes N slots across pillars according to the goal's mix. */
function pillarSequence(perWeek, goal) {
  const mix = MIX_BY_GOAL[goal] || MIX_BY_GOAL.reach;
  const counts = Object.entries(mix).map(([pillar, share]) => ({
    pillar,
    exact: share * perWeek,
    count: Math.floor(share * perWeek),
  }));
  let assigned = counts.reduce((sum, item) => sum + item.count, 0);
  // Hand out the remainder to whichever pillar lost the most to rounding.
  const byRemainder = [...counts].sort(
    (a, b) => b.exact - b.count - (a.exact - a.count)
  );
  let i = 0;
  while (assigned < perWeek) {
    byRemainder[i % byRemainder.length].count += 1;
    assigned += 1;
    i += 1;
  }
  const sequence = [];
  // Interleave rather than grouping, so a week never opens with three sales posts.
  const pools = counts.filter((c) => c.count > 0).map((c) => ({ ...c }));
  while (sequence.length < perWeek) {
    for (const pool of pools) {
      if (pool.count > 0 && sequence.length < perWeek) {
        sequence.push(pool.pillar);
        pool.count -= 1;
      }
    }
  }
  return sequence;
}

/**
 * @param {object} options
 * @param {number} options.year
 * @param {number} options.month 1-12
 * @param {number} options.perWeek posts per week (1-14)
 * @param {string} options.goal primary brand goal
 * @param {string} options.niche
 * @param {string} options.platform
 * @returns {object} plan with slots keyed by ISO date
 */
function buildMonthPlan({
  year,
  month,
  perWeek = 3,
  goal = 'reach',
  niche = 'marketing',
  platform = 'instagram',
} = {}) {
  const now = new Date();
  const y = year || now.getUTCFullYear();
  const m = month || now.getUTCMonth() + 1;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cadence = Math.max(1, Math.min(14, Number(perWeek) || 3));

  const trends = listTrends({ platform, niche, goal });
  const sequence = pillarSequence(cadence, goal);
  const publishDays = PREFERRED_DAYS.slice(0, cadence);

  const slots = [];
  let index = 0;
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(Date.UTC(y, m - 1, day));
    const weekday = date.getUTCDay();
    if (!publishDays.includes(weekday)) continue;
    const pillar = sequence[index % sequence.length];
    const trend = trends[index % trends.length];
    slots.push({
      date: date.toISOString().slice(0, 10),
      day,
      weekday,
      pillar,
      pillarLabel: PILLAR_LABELS[pillar].label,
      tone: PILLAR_LABELS[pillar].tone,
      format: FORMAT_BY_PILLAR[pillar],
      suggestion: trend ? trend.title : 'فكرة من Content Studio',
      trendKey: trend ? trend.key : null,
      goal: pillar,
    });
    index += 1;
  }

  const distribution = slots.reduce((acc, slot) => {
    acc[slot.pillar] = (acc[slot.pillar] || 0) + 1;
    return acc;
  }, {});

  return {
    year: y,
    month: m,
    daysInMonth,
    perWeek: cadence,
    goal,
    slots,
    distribution,
    rationale: `خطة ${slots.length} منشورًا هذا الشهر بتوزيع ${Object.entries(distribution)
      .map(([pillar, count]) => `${count} ${PILLAR_LABELS[pillar].label}`)
      .join(' · ')}، مبنية على هدفك الأساسي.`,
  };
}

module.exports = { buildMonthPlan, PILLAR_LABELS, MIX_BY_GOAL };

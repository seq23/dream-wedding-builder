// Brand social posts for Dream Wedding (Instagram + TikTok @dreamweddingbuilder), made at
// $0 from the Pinterest pin pipeline (spry brain, 8 Nov 2026: "4-6 slide carousels /
// TikTok photo posts reused from the Pinterest pin designs, plus one screen-recorded tool
// video a week per brand ... posts via the second Buffer a few a week").
//
// Pure functions only: what each post says, which page it comes from and when it is due.
// scripts/brand_social/render_posts.mjs draws the slides and the video;
// scripts/brand_social/queue_posts.mjs hands due posts to Buffer. Tests:
// tests/unit/brand-social-posts.test.ts.
//
// Copy rules (design-dream-wedding, approved 6 Nov 2026):
// - every word on a slide comes from data/pinterest/angles.json (her approved pin copy) or
//   the page's own name; nothing is invented and no price but the approved $9 appears;
// - no couple photos (brand: "no stock couples"), so slides are type on ivory;
// - free planner first, then the $9 checklist PDF.

export const SITE = 'https://weddingchecklistpdf.com';
export const PLANNER_PATH = '/free-wedding-planner';
export const MIN_ANGLES = 4;
export const BODY_SLIDES = 4; // cover + 4 + closing = 6 slides (the brain's 4-6)
// Words that keep their capitals when a Title Case pin headline becomes a sentence.
const KEEP = new Map(['diy', 'pdf', 'dj', 'rsvp', 'id', 'i', 'ii'].map((w) => [w, w.toUpperCase()]));
const PROPER = new Set(['City', 'Hall']);

/** "Plan Buffers Into Your Wedding Day Timeline" -> "Plan buffers into your wedding day timeline". */
export function sentenceCase(text) {
  const words = String(text).replace(/\s+/g, ' ').trim().split(' ');
  return words
    .map((word, i) => {
      const bare = word.replace(/[^A-Za-z]/g, '').toLowerCase();
      if (KEEP.has(bare)) return word.replace(new RegExp(bare, 'i'), KEEP.get(bare));
      if (i === 0 || /[?!.:]$/.test(words[i - 1])) return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      if (PROPER.has(word.replace(/[^A-Za-z]/g, ''))) return word;
      return word.toLowerCase();
    })
    .join(' ');
}

/** The UTM link a post's caption and closing slide name (counted by the visits reader). */
export function postLink(pagePath, platform, postId) {
  const url = new URL(pagePath, SITE);
  url.searchParams.set('utm_source', platform);
  url.searchParams.set('utm_medium', 'social');
  url.searchParams.set('utm_campaign', 'brand-social');
  url.searchParams.set('utm_content', postId);
  return url.toString();
}

/** Pages with enough approved angles for one carousel, in angles.json order. */
export function carouselPages(angles) {
  return Object.entries(angles)
    .filter(([path, list]) => path.startsWith('/') && Array.isArray(list) && list.length >= MIN_ANGLES)
    .map(([path]) => path);
}

const clean = (s) => String(s ?? '').replace(/\s*\n\s*/g, ' ').trim();

/**
 * One carousel: a cover naming the page, four approved angles as the body slides, and a
 * closing slide with the free planner first. Null when the page has too few angles.
 */
export function carouselFor(pagePath, angles, pageName, hashtags) {
  const list = (angles[pagePath] ?? []).slice(0, BODY_SLIDES);
  if (list.length < MIN_ANGLES || !pageName) return null;
  const id = `dw-${pagePath.replace(/^\/(guides\/)?/, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-c1`;
  const eyebrow = clean(list[0].eyebrow) || 'WEDDING PLANNING';
  const body = list.map((a, i) => ({ kind: 'point', step: `${i + 1} of ${list.length}`, headline: sentenceCase(clean(a.headline)), subline: clean(a.subline) }));
  const slides = [
    { kind: 'cover', eyebrow, headline: clean(pageName), subline: `${list.length} things to get right` },
    ...body,
    { kind: 'close', headline: 'Plan it in one place.', primary: 'Open the free wedding planner ›', secondary: 'Get the Wedding Checklist PDF — $9 ›', site: 'weddingchecklistpdf.com' }
  ];
  const lines = body.map((b) => `${b.step.split(' ')[0]}. ${b.headline}${/[.?!]$/.test(b.headline) ? '' : '.'}`);
  const caption = [
    `${clean(pageName)}: ${list.length} things to get right.`,
    '',
    ...lines,
    '',
    'Free wedding planner, no account: link in bio.'
  ].join('\n');
  return { id, type: 'carousel', page: pagePath, title: clean(pageName), slides, caption, hashtags };
}

/**
 * The weekly tool video: the free planner, recorded live on the site with captions on
 * screen. `picks` change each week so no two videos show the same plan.
 */
export const VIDEO_PICKS = [
  ['Fall', 'Outdoors', 'Garden', 'Relaxed', 'Sage'],
  ['Spring', 'Indoors', 'Elegant', 'City', 'Navy'],
  ['Summer', 'Either', 'Party', 'Intimate', 'Terracotta'],
  ['Winter', 'Indoors', 'Cultural', 'Elegant', 'Burgundy']
];

export function videoFor(week, hashtags) {
  const picks = VIDEO_PICKS[week % VIDEO_PICKS.length];
  const id = `dw-planner-video-w${week}`;
  const caption = [
    `Planning a ${picks[3].toLowerCase()} ${picks[0].toLowerCase()} wedding? Tap a few things you like and the free planner turns them into a plan.`,
    '',
    'Free, with no account and no email: link in bio.'
  ].join('\n');
  return { id, type: 'video', page: PLANNER_PATH, title: 'The free wedding planner', week, picks, caption, hashtags };
}

/** ISO week number since 2026-01-05 (a Monday), so the same day always gives the same week. */
export function weekIndex(now) {
  return Math.floor((Date.parse(new Date(now).toISOString().slice(0, 10)) - Date.parse('2026-01-05')) / (7 * 86_400_000));
}

/**
 * How many more posts a channel may have queued: the plan's per-channel cap, never more
 * than the free plan's organisation-wide scheduled-post limit minus what is already
 * scheduled anywhere in it.
 */
export function roomInQueue({ channelScheduled, orgScheduled, perChannelMax, orgLimit }) {
  return Math.max(0, Math.min(perChannelMax - channelScheduled, orgLimit - orgScheduled));
}

/** The tags a platform gets: every researched tag on Instagram, the first `tiktokMax` on TikTok. */
export function tagsForPlatform(post, platform, tiktokMax = 5) {
  const tags = post.hashtags ?? [];
  return platform === 'tiktok' ? tags.slice(0, tiktokMax) : tags;
}

/** The exact text a platform posts: the caption, a blank line, its hashtags. */
export function postText(post, platform, tiktokMax = 5) {
  const tags = tagsForPlatform(post, platform, tiktokMax);
  return tags.length ? `${post.caption}\n\n${tags.join(' ')}` : post.caption;
}

/** NAMED STOP BRAND_SOCIAL_HASHTAGS_STALE once the researched set passes its refresh date. */
export function hashtagsFresh(doc, now) {
  return new Date(now).toISOString().slice(0, 10) <= doc.refresh_by;
}

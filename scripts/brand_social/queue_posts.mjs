// The weekly brand social job (.github/workflows/brand-social-posts.yml, Mondays).
//
//   --render  draw the posts this week can use (this week's video + the next carousels)
//             into public/social, so the commit that follows deploys them
//   --queue   hand them to the brands Buffer, within the free plan's limits, and record
//             each in data/brand-social/posted.json (never posted twice)
//
// Switched OFF until her yes to the sample page: data/brand-social/plan.json `enabled`.
// Off prints `OUTPUT brand-social ...: OFF` and does nothing else. On, every stage ends
// in an OUTPUT line with its count, or a NAMED STOP (scripts/brand_social/buffer_queue.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NamedStop, TOKEN_ENV, bufferClient, createPost, planWeek, postInput, readState, waitLive } from './buffer_queue.mjs';
import { SITE, hashtagsFresh, postText, roomInQueue, weekIndex } from './posts.mjs';
import { allCarousels, loadHashtags, loadPlan, render, weekVideo } from './render_posts.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LEDGER = path.join(ROOT, 'data', 'brand-social', 'posted.json');
const BRAND = 'Dream Wedding';

export const mediaUrl = (post, file) => `${SITE}/social/${post.id}/${file}`;
const mediaFiles = (post) => (post.type === 'video' ? ['video.mp4', 'cover.jpg'] : post.slides.map((_, i) => `${i + 1}.jpg`));
const readLedger = () => (fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : { posts: {} });
const writeLedger = (l) => fs.writeFileSync(LEDGER, `${JSON.stringify(l, null, 2)}\n`);

/** The posts any channel could take this week, before Buffer is asked. */
export function candidates(plan, ledger, week) {
  const carousels = allCarousels();
  const platforms = Object.keys(plan.channels);
  const unposted = carousels.filter((c) => platforms.some((p) => !ledger.posts?.[c.id]?.[p]));
  return { carousels: unposted, video: weekVideo(week), all: carousels };
}

async function main(mode, now = Date.now()) {
  const plan = loadPlan();
  const label = `brand-social ${mode.replace('--', '')} (${BRAND})`;
  if (!plan.enabled) { console.log(`OUTPUT ${label}: OFF - plan.enabled is false until her yes to the sample page; nothing drawn or queued`); return; }
  const tags = loadHashtags();
  if (!hashtagsFresh(tags, now)) throw new NamedStop('BRAND_SOCIAL_HASHTAGS_STALE', `data/brand-social/hashtags.json was due a refresh on ${tags.refresh_by}: re-read the counts and pick again`);
  const ledger = readLedger();
  const week = weekIndex(now);
  const { carousels, video } = candidates(plan, ledger, week);
  if (!carousels.length) throw new NamedStop('BRAND_SOCIAL_EXHAUSTED', 'every carousel the pin copy can make has posted; add angles to data/pinterest/angles.json or a second carousel per page');
  const need = [video, ...carousels.slice(0, plan.posts_per_week)];
  if (mode === '--render') {
    const missing = need.filter((p) => !mediaFiles(p).every((f) => fs.existsSync(path.join(ROOT, 'public', 'social', p.id, f))));
    if (missing.length) await render(missing);
    const still = missing.filter((p) => !mediaFiles(p).every((f) => fs.existsSync(path.join(ROOT, 'public', 'social', p.id, f))));
    if (still.length) throw new NamedStop('BRAND_SOCIAL_RENDER_FAILED', still.map((p) => p.id).join(', '));
    console.log(`OUTPUT ${label}: ${missing.length} post(s) drawn, ${need.length} ready for week ${week}`);
    return;
  }
  const token = process.env[TOKEN_ENV];
  if (!token) throw new NamedStop('BUFFER_TOKEN_MISSING', `${TOKEN_ENV} is not set (repository secret)`);
  const call = bufferClient(token);
  const state = await readState(call, plan);
  const picks = planWeek({ plan, carousels, video, ledger, week, state, roomInQueue });
  const total = Object.values(picks).flat().length;
  const thisWeek = Object.values(ledger.posts ?? {}).filter((v) => Object.values(v).some((x) => x.week === week)).length;
  if (!total && !thisWeek) {
    const full = Object.entries(state.channels).map(([p, c]) => `${p} ${c.scheduled} waiting`).join(', ');
    throw new NamedStop('BUFFER_QUEUE_FULL', `no room this week (${full}; organisation ${state.orgScheduled} of ${state.orgLimit}): last week's posts have not gone out - check the Buffer queue is not paused`);
  }
  const wanted = [...new Set(Object.values(picks).flat())];
  await waitLive(wanted.flatMap((p) => mediaFiles(p).map((f) => mediaUrl(p, f))));
  let queued = 0;
  for (const [platform, list] of Object.entries(picks)) {
    for (const post of list) {
      const made = await createPost(call, postInput(post, platform, state.channels[platform].id, mediaUrl, postText(post, platform, tags.tiktok_max)));
      ledger.posts[post.id] = { ...(ledger.posts[post.id] ?? {}), [platform]: { buffer_id: made.id, due_at: made.dueAt ?? null, week, queued_at: new Date(now).toISOString() } };
      writeLedger(ledger);
      queued += 1;
    }
  }
  const per = Object.entries(picks).map(([p, l]) => `${p} ${l.length}`).join(', ');
  console.log(`OUTPUT ${label}: ${queued} post(s) queued in Buffer for week ${week} (${per}); organisation ${state.orgScheduled + queued} of ${state.orgLimit} scheduled`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const mode = process.argv[2];
  if (!['--render', '--queue'].includes(mode)) { console.error('usage: queue_posts.mjs --render | --queue'); process.exit(2); }
  main(mode).catch((e) => {
    if (e instanceof NamedStop) { console.error(`NAMED STOP: ${e.message}`); process.exit(1); }
    throw e;
  });
}

// Draws Dream Wedding's brand social posts: carousel slides (1080x1350 JPEG) and the
// weekly screen-recorded planner video (1080x1920 MP4), into public/social/<post id>/.
// $0: Playwright's Chromium draws the slides from the brand fonts in
// scripts/pinterest/fonts; the video is real screenshots of the live free planner taken
// while it is used, joined by ffmpeg. No model, no paid tool, no stock couple photos.
//
//   node scripts/brand_social/render_posts.mjs --ids a,b     draw these posts
//   node scripts/brand_social/render_posts.mjs --sample      draw the sample set
//
// Prints one OUTPUT line. Exits 1 with NAMED STOP BRAND_SOCIAL_RENDER_FAILED when a post
// it was asked for has no files afterwards.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { carouselFor, carouselPages, videoFor } from './posts.mjs';
import { pinBoards } from '../../lib/pinboards.mjs';
import { concatSeconds, muxArgs, writeTrack } from './music.mjs';
import { pageSource } from '../pinterest/pin_sources.mjs';

const MUSIC_PRESET = 'dream-wedding';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'public', 'social');
const FONTS = path.join(ROOT, 'scripts', 'pinterest', 'fonts');
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const font = (file) => `data:font/ttf;base64,${fs.readFileSync(path.join(FONTS, file)).toString('base64')}`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function loadPlan() {
  // BRAND_SOCIAL_PLAN: another plan file, for tests only.
  return process.env.BRAND_SOCIAL_PLAN ? JSON.parse(fs.readFileSync(process.env.BRAND_SOCIAL_PLAN, 'utf8')) : readJson('data/brand-social/plan.json');
}

/** Every carousel the pin copy can make today, in order. */
export const loadHashtags = () => readJson('data/brand-social/hashtags.json');
const tagList = (doc, set, page) => {
  const fix = doc.pages?.[page] ?? {};
  const drop = new Set(fix.drop ?? []);
  return [...(doc.sets[set] ?? []).filter((t) => !drop.has(t.tag)), ...(fix.add ?? [])].map((t) => t.tag);
};

/** Every carousel the pin copy can make today, in order, each with its board's researched tags. */
export function allCarousels() {
  const angles = readJson('data/pinterest/angles.json');
  const boards = pinBoards(readJson('data/pinterest/boards.json'));
  const tags = loadHashtags();
  return carouselPages(angles)
    .map((p) => carouselFor(p, angles, pageSource(p)?.name ?? null, tagList(tags, boards.boardFor(p).slug, p)))
    .filter(Boolean);
}

/** This week's planner video, with the video's researched tags. */
export const weekVideo = (week) => { const tags = loadHashtags(); return videoFor(week, tagList(tags, tags.video)); };

const CSS = () => `
@font-face{font-family:'Instrument Serif';src:url(${font('InstrumentSerif-Regular.ttf')})}
@font-face{font-family:'Instrument Serif';font-style:italic;src:url(${font('InstrumentSerif-Italic.ttf')})}
@font-face{font-family:'Instrument Sans';src:url(${font('InstrumentSans.ttf')})}
@font-face{font-family:'DM Mono';src:url(${font('DMMono-Medium.ttf')})}
:root{--ivory:#FAF7F2;--midnight:#1B1F3B;--blue:#2747D9;--coral:#F28C6B;--rule:#E6DFD3}
*{box-sizing:border-box;margin:0}
html,body{width:1080px;height:1350px;background:var(--ivory);color:var(--midnight)}
.s{position:relative;width:1080px;height:1350px;padding:96px 96px 88px;display:flex;flex-direction:column}
.brand{display:flex;align-items:center;gap:20px}
.tabs{position:relative;width:46px;height:56px}
.tabs i{position:absolute;display:block;width:34px;height:46px;border-radius:6px}
.tabs i:first-child{left:12px;top:0;background:var(--coral)}
.tabs i:last-child{left:0;top:10px;background:var(--blue)}
.word{font:44px/1 'Instrument Serif';letter-spacing:-.01em}
.word em{font-style:italic}
.eyebrow{font:500 26px/1.2 'DM Mono';letter-spacing:.14em;text-transform:uppercase;color:var(--blue)}
.mid{flex:1;display:flex;flex-direction:column;justify-content:center;gap:40px}
h1{font:400 136px/1.0 'Instrument Serif';letter-spacing:-.02em;text-wrap:balance}
h2{font:400 108px/1.04 'Instrument Serif';letter-spacing:-.015em;text-wrap:balance}
.sub{font:400 50px/1.3 'Instrument Sans';max-width:840px}
.tabrow{display:flex;gap:10px}
.tabrow span{font:500 24px/1 'DM Mono';letter-spacing:.08em;padding:16px 22px;border-radius:12px 12px 0 0;background:var(--coral);color:var(--midnight)}
.tabrow span.on{background:var(--blue);color:#fff}
.foot{display:flex;justify-content:space-between;align-items:center;border-top:2px solid var(--rule);padding-top:28px;font:500 26px/1 'DM Mono';letter-spacing:.08em}
.btn{display:inline-block;background:var(--blue);color:#fff;font:600 46px/1 'Instrument Sans';padding:36px 48px;border-radius:20px}
.btn2{font:500 40px/1.2 'Instrument Sans';text-decoration:underline;text-underline-offset:8px}
.tag{font:italic 400 46px/1.25 'Instrument Serif'}
`;

const brand = `<div class="brand"><div class="tabs"><i></i><i></i></div><div class="word">Dream <em>Wedding</em></div></div>`;

export function slideHtml(slide, index, total) {
  const foot = (left) => `<div class="foot"><span>${esc(left)}</span><span>${index + 1} / ${total}</span></div>`;
  let inner;
  if (slide.kind === 'cover') {
    inner = `${brand}<div class="mid"><div class="eyebrow">${esc(slide.eyebrow)}</div><h1>${esc(slide.headline)}</h1><p class="sub">${esc(slide.subline)}</p></div>${foot('Swipe ›')}`;
  } else if (slide.kind === 'point') {
    inner = `${brand}<div class="mid"><div class="tabrow"><span class="on">${esc(slide.step.toUpperCase())}</span></div><h2>${esc(slide.headline)}</h2><p class="sub">${esc(slide.subline)}</p></div>${foot('weddingchecklistpdf.com')}`;
  } else {
    inner = `${brand}<div class="mid"><h1>${esc(slide.headline)}</h1><p class="tag">The planner's whole system, without the planner's fee.</p><div><span class="btn">${esc(slide.primary)}</span></div><div class="btn2">${esc(slide.secondary)}</div></div>${foot(slide.site)}`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS()}</style></head><body><div class="s">${inner}</div></body></html>`;
}

async function drawCarousel(browser, post) {
  const dir = path.join(OUT, post.id);
  fs.mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  const files = [];
  for (const [i, slide] of post.slides.entries()) {
    await page.setContent(slideHtml(slide, i, post.slides.length), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const file = path.join(dir, `${i + 1}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
    files.push(file);
  }
  await page.close();
  return files;
}

// The caption band drawn over the live page in each video frame.
const bandCss = `body{padding-top:74px!important}#bs-band{position:fixed;left:0;right:0;top:0;z-index:2147483647;min-height:74px;display:flex;align-items:center;justify-content:center;padding:10px 18px;background:#1B1F3B;color:#FAF7F2;font:400 27px/1.1 'Instrument Serif',Georgia,serif;text-align:center}`;
async function band(page, text) {
  await page.evaluate(({ text, css }) => {
    let el = document.getElementById('bs-band');
    if (!el) {
      const st = document.createElement('style'); st.textContent = css; document.head.append(st);
      el = document.createElement('div'); el.id = 'bs-band'; document.body.append(el);
    }
    el.textContent = text;
  }, { text, css: bandCss });
}

/** The planner, used live: each beat is (caption, action, seconds held). */
async function drawVideo(browser, post) {
  const dir = path.join(OUT, post.id);
  const frames = path.join(dir, 'frames');
  fs.rmSync(frames, { recursive: true, force: true });
  fs.mkdirSync(frames, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 8 / 3 });
  const page = await ctx.newPage();
  const list = [];
  let n = 0;
  const shot = async (seconds) => {
    const file = path.join(frames, `${String(n++).padStart(3, '0')}.png`);
    await page.screenshot({ path: file });
    list.push(`file '${file}'\nduration ${seconds}`);
  };
  const scroll = async (px, steps, each) => {
    for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, px / steps); await page.waitForTimeout(120); await shot(each); }
  };
  await page.goto(`https://weddingchecklistpdf.com${post.page}`, { waitUntil: 'networkidle' });
  await band(page, 'A wedding plan, free, from a few taps'); await shot(2.2);
  await page.getByText('I don’t know yet').click(); await page.waitForTimeout(400);
  await band(page, 'Not sure what you want? Tap what you like'); await shot(1.2);
  for (const t of post.picks) { await page.getByRole('button', { name: t, exact: true }).first().click(); await page.waitForTimeout(150); await shot(0.45); }
  await page.getByRole('button', { name: /step 1 of 4/ }).click();
  await page.waitForFunction(() => !/Reading your wedding/.test(document.body.innerText), null, { timeout: 90000 });
  await page.waitForTimeout(1200); await page.evaluate(() => window.scrollTo(0, 0));
  await band(page, 'It reads your wedding back to you'); await shot(2.4);
  await scroll(1400, 8, 0.35);
  await page.getByRole('button', { name: /step 2 of 4/ }).click(); await page.waitForTimeout(1500); await page.evaluate(() => window.scrollTo(0, 0));
  await band(page, 'Keep what belongs. Skip the rest'); await shot(2.0);
  await scroll(1100, 6, 0.35);
  await page.getByRole('button', { name: /step 3 of 4/ }).click(); await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /don.t have a date yet/ }).click(); await page.waitForTimeout(2500); await page.evaluate(() => window.scrollTo(0, 0));
  await band(page, 'Then your plan, month by month'); await shot(2.4);
  await scroll(1600, 8, 0.35);
  await ctx.close();
  // Closing card: the carousel close slide, scaled into the frame.
  const end = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  const close = { kind: 'close', headline: 'Free, with no account.', primary: 'Open the free wedding planner ›', secondary: 'Get the Wedding Checklist PDF — $9 ›', site: 'weddingchecklistpdf.com' };
  await end.setContent(slideHtml(close, 0, 1).replace('height:1350px;padding', 'height:1920px;padding').replace(/height:1350px/g, 'height:1920px').replace('<span>1 / 1</span>', '<span>link in bio</span>'), { waitUntil: 'load' });
  await end.evaluate(() => document.fonts.ready);
  const last = path.join(frames, `${String(n++).padStart(3, '0')}.png`);
  await end.screenshot({ path: last }); await end.close();
  list.push(`file '${last}'\nduration 3`, `file '${last}'`);
  fs.writeFileSync(path.join(frames, 'list.txt'), `${list.join('\n')}\n`);
  const mp4 = path.join(dir, 'video.mp4');
  const silent = path.join(frames, 'silent.mp4');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(frames, 'list.txt'), '-vf', 'scale=1080:1920:flags=lanczos,format=yuv420p', '-r', '30', '-c:v', 'libx264', '-crf', '23', '-an', silent]);
  // Original music under it (scripts/brand_social/music.mjs; data/brand-social/music.json).
  const seconds = concatSeconds(fs.readFileSync(path.join(frames, 'list.txt'), 'utf8')); // no ffprobe: the static ffmpeg build has none
  const wav = writeTrack(path.join(frames, 'music.wav'), { preset: MUSIC_PRESET, seconds, week: post.week ?? 0 });
  execFileSync('ffmpeg', muxArgs(silent, wav, seconds, mp4));
  const cover = path.join(dir, 'cover.jpg');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', path.join(frames, '000.png'), '-vf', 'scale=1080:1920', '-q:v', '3', cover]);
  fs.rmSync(frames, { recursive: true, force: true });
  return [mp4, cover];
}

export async function render(posts) {
  const browser = await chromium.launch();
  const made = {};
  try {
    for (const post of posts) made[post.id] = post.type === 'video' ? await drawVideo(browser, post) : await drawCarousel(browser, post);
  } finally {
    await browser.close();
  }
  return made;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const plan = loadPlan();
  const carousels = allCarousels();
  const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
  let posts;
  if (process.argv.includes('--sample')) posts = [...carousels.filter((c) => plan.sample.carousels.includes(c.id)), weekVideo(plan.sample.video_week)];
  else {
    const ids = new Set((arg('--ids') ?? '').split(',').filter(Boolean));
    const weeks = arg('--week') != null ? [Number(arg('--week'))] : [0, 1, 2, 3];
    posts = [...carousels, ...weeks.map((w) => weekVideo(w))].filter((p) => ids.has(p.id));
  }
  const made = await render(posts);
  const missing = posts.filter((p) => !(made[p.id] ?? []).every((f) => fs.existsSync(f)) || !(made[p.id] ?? []).length);
  console.log(`OUTPUT brand-social render: ${posts.length - missing.length} of ${posts.length} post(s) drawn into public/social`);
  if (missing.length) { console.error(`NAMED STOP: BRAND_SOCIAL_RENDER_FAILED - ${missing.map((p) => p.id).join(', ')}`); process.exit(1); }
}

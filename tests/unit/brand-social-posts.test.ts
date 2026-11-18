import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NamedStop, bufferClient, planWeek, postInput, waitLive } from '../../scripts/brand_social/buffer_queue.mjs';
import { carouselFor, carouselPages, hashtagsFresh, postLink, postText, roomInQueue, sentenceCase, videoFor } from '../../scripts/brand_social/posts.mjs';
import { synth } from '../../scripts/brand_social/music.mjs';

const angles = JSON.parse(readFileSync('data/pinterest/angles.json', 'utf8'));
const plan = JSON.parse(readFileSync('data/brand-social/plan.json', 'utf8'));
const hashtagDoc = JSON.parse(readFileSync('data/brand-social/hashtags.json', 'utf8'));
const tags: string[] = hashtagDoc.sets['wedding-day'].map((t: { tag: string }) => t.tag);

describe('brand social posts are made from the approved pin copy (spry brain, 8 Nov 2026)', () => {
  it('makes a 6-slide carousel from four approved angles, free planner first', () => {
    const pages = carouselPages(angles);
    expect(pages.length).toBeGreaterThanOrEqual(10);
    const c = carouselFor('/guides/wedding-day-timeline', angles, 'Wedding Day Timeline', tags)!;
    expect(c.slides.map((s: { kind: string }) => s.kind)).toEqual(['cover', 'point', 'point', 'point', 'point', 'close']);
    const approved = angles['/guides/wedding-day-timeline'].slice(0, 4).map((a: { headline: string }) => sentenceCase(a.headline.replace(/\s+/g, ' ')));
    expect(c.slides.slice(1, 5).map((s: { headline: string }) => s.headline)).toEqual(approved);
    const close = c.slides[5];
    expect(close.primary).toMatch(/^Open the free wedding planner/);
    expect(close.secondary).toMatch(/\$9/);
    expect(c.caption).toContain('link in bio');
    const ig = postText(c, 'instagram');
    for (const t of tags) expect(ig).toContain(t);
    expect(postText(c, 'tiktok', 5).match(/#\w+/g)).toHaveLength(5);
  });

  it('prints no price but the approved $9 on any carousel', () => {
    for (const p of carouselPages(angles)) {
      const c = carouselFor(p, angles, 'Page', tags)!;
      const prices = JSON.stringify(c).match(/\$\d+/g) ?? [];
      expect(prices.every((x) => x === '$9'), p).toBe(true);
    }
  });

  it('keeps capitals after a question mark and on acronyms', () => {
    expect(sentenceCase('Eloping? Know the Waiting Period Before You Pick a Date')).toBe('Eloping? Know the waiting period before you pick a date');
    expect(sentenceCase('Print the DIY Wedding PDF')).toBe('Print the DIY wedding PDF');
  });

  it('gives each week a different planner video and a counted link', () => {
    expect(videoFor(0, tags).picks).not.toEqual(videoFor(1, tags).picks);
    expect(new URL(postLink('/free-wedding-planner', 'instagram', 'x')).searchParams.get('utm_source')).toBe('instagram');
  });
});

describe('the Buffer queue stays inside the free plan', () => {
  const carousels = ['a', 'b', 'c', 'd'].map((id) => ({ id, type: 'carousel' }));
  const video = { id: 'v', type: 'video' };
  const state = (ig: number, tt: number, org = ig + tt) => ({ orgLimit: 10, orgScheduled: org, channels: { instagram: { scheduled: ig }, tiktok: { scheduled: tt } } });

  it('never queues past 3 per channel or 10 in the organisation', () => {
    expect(roomInQueue({ channelScheduled: 1, orgScheduled: 2, perChannelMax: 3, orgLimit: 10 })).toBe(2);
    expect(roomInQueue({ channelScheduled: 0, orgScheduled: 9, perChannelMax: 3, orgLimit: 10 })).toBe(1);
    const picks = planWeek({ plan, carousels, video, ledger: { posts: {} }, week: 5, state: state(0, 0, 8), roomInQueue });
    expect(picks.instagram.length + picks.tiktok.length).toBe(2);
  });

  it('puts the video first, never posts a post twice and stops at the week count', () => {
    const picks = planWeek({ plan, carousels, video, ledger: { posts: { a: { instagram: { week: 4 } } } }, week: 5, state: state(0, 0), roomInQueue });
    expect(picks.instagram.map((p: { id: string }) => p.id)).toEqual(['v', 'b', 'c']);
    expect(picks.tiktok.map((p: { id: string }) => p.id)).toEqual(['v', 'a', 'b']);
    const done = planWeek({ plan, carousels, video, ledger: { posts: { v: { instagram: { week: 5 } }, b: { instagram: { week: 5 } }, c: { instagram: { week: 5 } } } }, week: 5, state: state(0, 0), roomInQueue });
    expect(done.instagram).toEqual([]);
  });

  it('builds an Instagram carousel, a reel and a TikTok post Buffer accepts', () => {
    const c = carouselFor('/guides/wedding-day-timeline', angles, 'Wedding Day Timeline', tags)!;
    const url = (p: { id: string }, f: string) => `https://weddingchecklistpdf.com/social/${p.id}/${f}`;
    const ig = postInput(c, 'instagram', 'ch1', url);
    expect(ig.metadata.instagram.type).toBe('carousel');
    expect(ig.assets).toHaveLength(6);
    expect(ig.mode).toBe('addToQueue');
    const reel = postInput(videoFor(0, tags), 'instagram', 'ch1', url);
    expect(reel.metadata.instagram.type).toBe('reel');
    expect(reel.assets[0].video.url).toMatch(/video\.mp4$/);
    const tt = postInput(c, 'tiktok', 'ch2', url);
    expect(tt.metadata.tiktok.title.length).toBeLessThanOrEqual(90);
  });

  it('names its stops: refused token, files not live', async () => {
    const refused = bufferClient('t', (async () => new Response('', { status: 401 })) as typeof fetch);
    await expect(refused('{x}')).rejects.toMatchObject({ code: 'BUFFER_TOKEN_REFUSED' });
    await expect(waitLive(['https://x/y.jpg'], { waitMs: 0, fetchImpl: (async () => new Response('', { status: 404 })) as typeof fetch })).rejects.toBeInstanceOf(NamedStop);
  });

  it('switched off, draws and queues nothing and says so', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'bs-')), 'plan.json');
    writeFileSync(file, JSON.stringify({ ...plan, enabled: false }));
    const out = execFileSync('node', ['scripts/brand_social/queue_posts.mjs', '--queue'], { encoding: 'utf8', env: { ...process.env, BRAND_SOCIAL_PLAN: file, BUFFER_BRANDS_ACCESS_TOKEN: '' } });
    expect(out).toMatch(/^OUTPUT brand-social queue \(Dream Wedding\): OFF/);
  });
});

describe('switched on with no token', () => {
  it('is the named stop BUFFER_TOKEN_MISSING, not a quiet pass', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'bs-')), 'plan.json');
    writeFileSync(file, JSON.stringify({ ...plan, enabled: true }));
    let err = '';
    try { execFileSync('node', ['scripts/brand_social/queue_posts.mjs', '--queue'], { encoding: 'utf8', stdio: 'pipe', env: { ...process.env, BRAND_SOCIAL_PLAN: file, BUFFER_BRANDS_ACCESS_TOKEN: '' } }); } catch (e) { err = String((e as { stderr: string }).stderr); }
    expect(err).toMatch(/NAMED STOP: BUFFER_TOKEN_MISSING/);
  });
});

describe('researched hashtags and original music', () => {
  it('every set mixes broad, mid (100k-2M) and niche tags with a count and date, and expires monthly', () => {
    for (const [name, set] of Object.entries(hashtagDoc.sets) as [string, { tag: string; tier: string; posts: number; as_of: string }[]][]) {
      expect(set.filter((t) => t.tier === 'broad').length, name).toBe(2);
      const mid = set.filter((t) => t.tier === 'mid');
      expect(mid.length, name).toBeGreaterThanOrEqual(3);
      for (const t of mid) expect(t.posts >= 100_000 && t.posts <= 2_000_000, t.tag).toBe(true);
      for (const t of set) { expect(t.tag).toMatch(/^#[a-z0-9]+$/); expect(t.as_of).toMatch(/^\d{4}-\d\d-\d\d$/); }
    }
    expect(hashtagsFresh(hashtagDoc, hashtagDoc.read_on)).toBe(true);
    const after = new Date(Date.parse(hashtagDoc.refresh_by) + 86_400_000);
    expect(hashtagsFresh(hashtagDoc, after)).toBe(false);
  });

  it('makes the same non-silent track for the same week, and a different one next week', () => {
    const a = synth({ preset: 'dream-wedding', seconds: 4, week: 0 })[0];
    const b = synth({ preset: 'dream-wedding', seconds: 4, week: 0 })[0];
    const c = synth({ preset: 'dream-wedding', seconds: 4, week: 1 })[0];
    const rms = Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
    expect(rms).toBeGreaterThan(0.01);
    expect(Array.from(a.slice(0, 2000))).toEqual(Array.from(b.slice(0, 2000)));
    expect(Array.from(a.slice(44100, 46000))).not.toEqual(Array.from(c.slice(44100, 46000)));
  });
});

describe('the weekly job runs as CI runs it (18 Nov 2026: Node 20 could not load the pin copy)', () => {
  it('the real entrypoint loads the whole pin-copy chain and names the week it would draw', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'bs-')), 'plan.json');
    writeFileSync(file, JSON.stringify({ ...plan, enabled: true }));
    const out = execFileSync('node', ['scripts/brand_social/queue_posts.mjs', '--render'], { encoding: 'utf8', env: { ...process.env, BRAND_SOCIAL_PLAN: file, BRAND_SOCIAL_DRY_RUN: '1' } });
    expect(out).toMatch(/^OUTPUT brand-social render \(Dream Wedding\): dry run - would draw dw-planner-video-w\d+, dw-/);
  });

  it('the workflow uses the Node the pin drip uses (it loads the same .ts data)', () => {
    const major = (f: string) => Number(readFileSync(f, 'utf8').match(/node-version:\s*'?(\d+)/)![1]);
    expect(major('.github/workflows/brand-social-posts.yml')).toBe(major('.github/workflows/pinterest-drip.yml'));
    expect(major('.github/workflows/brand-social-posts.yml')).toBeGreaterThanOrEqual(22);
  });
});

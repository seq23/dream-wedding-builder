#!/usr/bin/env node
// Load check for the Builder's AI draft (lib/ai-draft.ts): replays a day of 3,000
// drafts against the real handler and a real SQLite (the D1 shape), with every
// provider mocked. No network, no key, no model.
//
// Scenarios: free quotas enforced by the mock (including one model whose real
// daily limit is lower than the configured one), random 429s, a billing-attached
// Gemini key, and every provider down.
//
// Fails (exit 1) when any request errors or ends without a draft, any ceiling in
// config/llm_routing.json capacity is passed (day or minute), or anything but a
// $0 route is called (a Gemini free model or the billing probe; an OpenRouter
// ":free" model with max_price 0). Prints one LOAD_AI_DRAFT_DAY line per scenario.
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DRAFTS = Number(process.env.LOAD_DRAFTS || 3000);

async function loadHandler() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-draft-load-'));
  const out = path.join(dir, 'bundle.mjs');
  await build({
    stdin: { contents: "export * from '@/lib/ai-draft'; export * from '@/tests/support/ai-draft-fakes';", resolveDir: ROOT, loader: 'ts' },
    bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: out, logLevel: 'error',
    alias: { '@': ROOT }, external: ['node:*']
  });
  return import(pathToFileURL(out).href);
}

const SENTENCES = [
  '200 guests, June in Memphis, small budget',
  'about 120 guests next June in Nashville, TN, budget $20k',
  'Wedding on 6/12/27 for around 80 people, budget 20,000',
  'October 3, 2027 at a vineyard in Napa, 150 guests, $45,000',
  'small fall wedding in Asheville with 40 guests and a tight budget',
  'beach wedding in Destin in May 2027, ~90 guests'
];

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

async function scenario(h, name, opts) {
  const cfg = h.POOLS;
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'llm_routing.json'), 'utf8'));
  const freeGemini = new Set(config.gemini.models.map((m) => m.id));
  const probeModel = config.gemini.billing_probe.model;
  const freeOR = new Set(config.models.map((m) => m.id));
  const emails = Array.from({ length: DRAFTS }, (_, i) => `load${i}@example.com`);
  const { db } = h.fakeD1(emails);
  const rand = rng(opts.seed ?? 7);
  const violations = [];
  const perPoolDay = {};
  const perPoolMinute = {};
  const trueLimits = opts.trueLimits ?? {};
  const providerUsed = {};
  let now = new Date('2026-11-10T06:00:00Z'); // 00:00 Central
  const count = (poolId) => {
    const pool = cfg[poolId];
    const day = h.dayIn(pool.resets_tz, now);
    const minute = now.toISOString().slice(0, 16);
    perPoolDay[`${poolId}|${day}`] = (perPoolDay[`${poolId}|${day}`] ?? 0) + 1;
    perPoolMinute[`${poolId}|${minute}`] = (perPoolMinute[`${poolId}|${minute}`] ?? 0) + 1;
    if (perPoolDay[`${poolId}|${day}`] > pool.ceiling_day) violations.push(`${poolId} passed its day ceiling ${pool.ceiling_day}`);
    if (perPoolMinute[`${poolId}|${minute}`] > pool.ceiling_minute) violations.push(`${poolId} passed its minute ceiling ${pool.ceiling_minute} at ${minute}`);
    // The provider's own (mocked) limit: a real daily limit lower than configured is answered with a daily-quota 429.
    const used = (providerUsed[`${poolId}|${day}`] = (providerUsed[`${poolId}|${day}`] ?? 0) + 1);
    return trueLimits[poolId] !== undefined && used > trueLimits[poolId];
  };
  let probes = 0;
  const net = h.fakeNet({
    billing: () => { probes++; return opts.billingAttached ? h.geminiAnswer('O') : opts.allDown ? { status: 503, body: {} } : h.geminiQuota(true); },
    gemini: (model) => {
      if (!freeGemini.has(model)) violations.push(`called a Gemini model off the free list: ${model}`);
      const overReal = count(`gemini:${model}`);
      if (opts.allDown) return { status: 503, body: {} };
      if (overReal) return h.geminiQuota(true);
      if (rand() < (opts.rate429 ?? 0)) return h.geminiQuota(false);
      return h.geminiAnswer(JSON.stringify({ weddingDate: '2027-06-15', guestCount: '150', locations: 'Memphis', season: 'summer', budgetTarget: '', budgetMode: '', priorities: [], notes: [] }));
    },
    openrouter: (model) => {
      if (!freeOR.has(model) || !model.endsWith(':free')) violations.push(`called an OpenRouter model off the $0 list: ${model}`);
      const overReal = count('openrouter:free');
      if (opts.allDown) return h.orDown(502);
      if (overReal) return h.orDown(429, 'Rate limit exceeded: free-models-per-day');
      if (rand() < (opts.rate429 ?? 0)) return h.orDown(429, 'Rate limit exceeded: limit_rpm/free');
      return h.orAnswer(model, JSON.stringify({ guestCount: '150', locations: 'Memphis' }));
    }
  });
  const fetchImpl = async (url, init) => {
    const body = String(init?.body ?? '');
    if (url.startsWith('https://openrouter.ai/')) {
      const b = JSON.parse(body);
      if (b.provider?.max_price?.prompt !== 0 || b.provider?.max_price?.completion !== 0) violations.push('an OpenRouter call without max_price 0');
    } else if (!h.GEMINI_URL.test(url)) {
      violations.push(`a call to a route that is not $0: ${url}`);
    } else if (url.includes('key=')) violations.push('a Gemini key in a URL');
    try { return await net.fetchImpl(url, init); } catch (e) { violations.push(String(e.message)); throw e; }
  };

  const filled = { gemini: 0, openrouter: 0, rules: 0 };
  let errors = 0;
  const stepMs = (24 * 3600 * 1000) / DRAFTS;
  for (let i = 0; i < DRAFTS; i++) {
    // A peak: a third of the day's drafts land in one hour (the minute ceilings get hit).
    const t = i < DRAFTS / 3 ? 12 * 3600e3 + (i * 3600e3) / (DRAFTS / 3) : i * stepMs;
    now = new Date(Date.UTC(2026, 10, 10, 6) + t);
    try {
      const r = await h.draftPlan({ db, apiKey: 'or-load', geminiKey: 'gem-load', enabled: true, consent: true, email: emails[i], description: SENTENCES[i % SENTENCES.length], ip: `10.${(i / 250) | 0}.${i % 250}.1`, today: '2026-11-10', now, salt: 'load', log: () => {}, fetchImpl });
      if (r.status !== 200 || !r.body.ok) { errors++; if (errors < 4) violations.push(`request ${i} ended ${r.status} ${r.body.code}`); }
      else filled[r.body.filledBy]++;
    } catch (e) { errors++; violations.push(`request ${i} threw ${e.message}`); }
  }
  if (opts.billingAttached && filled.gemini) violations.push(`billing attached but ${filled.gemini} drafts came from Gemini`);
  if (opts.billingAttached && net.calls.some((c) => freeGemini.has(c.model))) violations.push('billing attached but a Gemini draft model was called');
  // A proved answer (free or attached) is cached for the Central day; an unproven
  // one (provider down) is retried at most every 15 minutes.
  const maxProbes = opts.allDown ? 24 * 4 + 1 : 1;
  if (probes > maxProbes) violations.push(`billing probe ran ${probes} times in one Central day (max ${maxProbes})`);
  if (opts.allDown && filled.rules !== DRAFTS - errors) violations.push('all down: not every draft came from the rules parser');
  const calls = net.calls.filter((c) => c.model !== probeModel).length;
  console.log(`LOAD_AI_DRAFT_DAY ${JSON.stringify({ scenario: name, drafts: DRAFTS, errors, filled, model_calls: calls, billing_probes: probes, violations: [...new Set(violations)].slice(0, 5) })}`);
  return violations.length === 0 && errors === 0;
}

const h = await loadHandler();
const results = [
  // The real daily limits are lower than configured here, so the daily-quota 429 path is exercised.
  await scenario(h, 'quotas', { trueLimits: { 'gemini:gemma-4-31b-it': 1500, 'gemini:gemini-3.5-flash-lite': 300, 'gemini:gemini-flash-latest': 10, 'openrouter:free': 500 } }),
  await scenario(h, 'random-429s', { rate429: 0.25, seed: 11 }),
  await scenario(h, 'billing-attached', { billingAttached: true }),
  await scenario(h, 'all-down', { allDown: true })
];
if (results.every(Boolean)) console.log('LOAD_AI_DRAFT_DAY PASS: 4 scenarios, no errors, no ceiling passed, $0 routes only');
else { console.error('LOAD_AI_DRAFT_DAY FAIL'); process.exit(1); }

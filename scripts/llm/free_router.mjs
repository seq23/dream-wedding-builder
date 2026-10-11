#!/usr/bin/env node
// The only door a model call may go through in this repo.
//
// Owner policy, 11 Oct 2026: "nothing should be paid". This router reads
// config/llm_routing.json, refuses to load unless max_cost_usd is exactly 0 and
// every listed model is priced $0 prompt and $0 completion, tries those models
// in order, and NEVER falls back to a paid model. When no free model answers it
// returns a named stop (nothing generated) instead of reaching for one that
// costs money. A non-zero cost reported by the provider throws: that is a
// policy breach and must fail the run loudly, not be logged and forgotten.
//
// CLI (used by the scheduled cycle and by hand):
//   node scripts/llm/free_router.mjs --check          live pricing still $0 for every configured model
//   node scripts/llm/free_router.mjs --check --ping   ...and one free model answers a one-line prompt
// Every CLI run prints exactly one `LLM_ROUTER_RECEIPT {...}` line.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CONFIG_PATH = path.join(ROOT, 'config', 'llm_routing.json');
export const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

export class PaidCostError extends Error {
  constructor(message, detail) { super(message); this.code = 'PAID_COST_REPORTED'; this.detail = detail; }
}

export function readConfig(file = CONFIG_PATH) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Every reason the routing config is not a $0-only policy. Empty means it is.
export function policyErrors(c) {
  const e = [];
  if (!c || typeof c !== 'object') return ['config/llm_routing.json is missing or not an object'];
  if (c.policy?.max_cost_usd !== 0) e.push(`policy.max_cost_usd must be exactly 0 (found ${JSON.stringify(c.policy?.max_cost_usd)})`);
  if (c.policy?.paid_fallback !== false) e.push('policy.paid_fallback must be false');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(c.pricing_snapshot?.date || ''))) e.push('pricing_snapshot.date must be YYYY-MM-DD');
  const models = Array.isArray(c.models) ? c.models : [];
  if (models.length < 3 || models.length > 4) e.push(`models must be an ordered fallback list of 3-4 (found ${models.length})`);
  const seen = new Set();
  for (const m of models) {
    const id = m?.id;
    if (!id) { e.push('a model entry has no id'); continue; }
    if (seen.has(id)) e.push(`${id}: listed twice`);
    seen.add(id);
    const p = m.pricing || {};
    if (!('prompt' in p) || !('completion' in p)) e.push(`${id}: pricing.prompt and pricing.completion are required`);
    for (const [k, v] of Object.entries(p)) if (String(v) !== '0') e.push(`${id}: pricing.${k} is ${JSON.stringify(v)}, not "0"`);
    if (!(Number(m.context_length) >= 32000)) e.push(`${id}: context_length ${m.context_length} is under 32k`);
  }
  return e;
}

export function loadPolicy(config = readConfig()) {
  const errors = policyErrors(config);
  if (errors.length) {
    const err = new Error(`llm routing policy refused: ${errors.join('; ')}`);
    err.code = 'POLICY_REFUSED';
    throw err;
  }
  return config;
}

function stop(stopName, reason, extra = {}) {
  return { status: 'NAMED_STOP', stop: stopName, reason, generated: false, cost_usd: 0, ...extra };
}

// Ask the free models in order. Returns {status:'OK', model, content, cost_usd:0}
// or a NAMED_STOP. Throws PaidCostError on any non-zero reported cost.
export async function routeChat({
  messages,
  maxTokens = 1024,
  temperature = 0,
  purpose = 'unspecified',
  apiKey = process.env.OPENROUTER_API_KEY || '',
  fetchImpl = globalThis.fetch,
  config = readConfig(),
  timeoutMs = Number(process.env.LLM_ROUTER_TIMEOUT_MS || 45000),
} = {}) {
  const policy = loadPolicy(config);
  if (!Array.isArray(messages) || !messages.length) throw new Error('routeChat: messages are required');
  if (!apiKey) return stop('NO_FREE_MODEL_KEY', 'OPENROUTER_API_KEY absent; nothing was generated', { purpose, attempts: [] });
  const freeIds = new Set(policy.models.map((m) => m.id));
  const attempts = [];
  for (const m of policy.models) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    let json;
    try {
      res = await fetchImpl(`${OPENROUTER_BASE}/chat/completions`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: m.id,
          messages,
          max_tokens: maxTokens,
          temperature,
          usage: { include: true },
          // Server-side guard as well: no provider may be picked above $0.
          provider: { max_price: { prompt: 0, completion: 0 }, allow_fallbacks: true },
        }),
      });
      json = await res.json().catch(() => null);
    } catch (err) {
      attempts.push({ model: m.id, outcome: 'error', error: String(err?.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : err?.message || err) });
      continue;
    } finally {
      clearTimeout(timer);
    }
    const cost = Number(json?.usage?.cost ?? 0);
    if (cost > 0) {
      throw new PaidCostError(`PAID COST REPORTED: ${m.id} returned usage.cost=${cost} USD; policy max_cost_usd is 0`, { model: m.id, usage: json.usage, purpose });
    }
    if (json?.model && !freeIds.has(json.model) && !freeIds.has(`${json.model}:free`)) {
      throw new PaidCostError(`provider answered with ${json.model}, which is not on the $0 list`, { requested: m.id, answered: json.model, purpose });
    }
    // A refused credential is not a model failure: every model would refuse it
    // the same way, so stop here and say so rather than walk the list.
    if (res && [401, 403].includes(res.status)) {
      attempts.push({ model: m.id, outcome: 'credential_refused', http: res.status, error: String(json?.error?.message || '').slice(0, 200) || null });
      return stop('CREDENTIAL_REFUSED', 'OpenRouter key disabled or invalid; free routing needs an enabled key with a $0 limit', { purpose, attempts });
    }
    const content = json?.choices?.[0]?.message?.content;
    if (!res?.ok || typeof content !== 'string' || !content.trim()) {
      attempts.push({ model: m.id, outcome: 'no_answer', http: res?.status ?? null, error: String(json?.error?.message || '').slice(0, 200) || null });
      continue;
    }
    attempts.push({ model: m.id, outcome: 'answered', http: res.status });
    return { status: 'OK', purpose, model: m.id, content, cost_usd: 0, usage: json.usage || null, attempts };
  }
  return stop('NO_FREE_MODEL_ANSWERED', 'no $0 model answered; nothing was generated and no paid model was tried', { purpose, attempts });
}

// Live pricing check without a key: every configured model must still exist and
// still be $0. A configured model that now costs money fails loudly.
export async function checkLivePricing({ config = readConfig(), fetchImpl = globalThis.fetch } = {}) {
  const policy = loadPolicy(config);
  let data;
  try {
    const res = await fetchImpl(`${OPENROUTER_BASE}/models`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = (await res.json())?.data;
  } catch (err) {
    return { state: 'NAMED_STOP', stop: 'MODEL_CATALOGUE_UNREACHABLE', reason: String(err?.message || err) };
  }
  const live = new Map((data || []).map((m) => [m.id, m]));
  const nowPaid = [];
  const missing = [];
  const free = [];
  for (const m of policy.models) {
    const l = live.get(m.id);
    if (!l) { missing.push(m.id); continue; }
    const paidFields = Object.entries(l.pricing || {}).filter(([, v]) => Number(v) !== 0).map(([k, v]) => `${k}=${v}`);
    if (paidFields.length) nowPaid.push(`${m.id} (${paidFields.join(', ')})`);
    else free.push(m.id);
  }
  return { state: nowPaid.length ? 'FAIL' : free.length ? 'OK' : 'NAMED_STOP', stop: free.length ? undefined : 'NO_CONFIGURED_MODEL_LISTED', free, missing, now_paid: nowPaid };
}

function receipt(obj) {
  console.log(`LLM_ROUTER_RECEIPT ${JSON.stringify({ at: new Date().toISOString(), max_cost_usd: 0, ...obj })}`);
}

async function main(argv) {
  const ping = argv.includes('--ping');
  if (!argv.includes('--check')) {
    console.error('usage: free_router.mjs --check [--ping]');
    process.exit(2);
  }
  const pricing = await checkLivePricing();
  if (pricing.state === 'FAIL') {
    receipt({ check: 'pricing', ...pricing });
    console.error(`::error::A configured model is no longer $0: ${pricing.now_paid.join('; ')}. Refresh config/llm_routing.json from the free list.`);
    process.exit(1);
  }
  if (pricing.missing?.length) console.log(`::warning::Configured free models no longer listed by OpenRouter: ${pricing.missing.join(', ')}`);
  if (!ping) { receipt({ check: 'pricing', ...pricing }); return; }
  let result;
  try {
    result = await routeChat({ purpose: 'router-health-ping', maxTokens: 512, messages: [{ role: 'user', content: 'Reply with the single word OK.' }] });
  } catch (err) {
    receipt({ check: 'pricing+ping', pricing, state: 'FAIL', error: err.message, code: err.code });
    console.error(`::error::${err.message}`);
    process.exit(1);
  }
  const { content, ...rest } = result;
  receipt({ check: 'pricing+ping', pricing, ...rest, answer_chars: content ? content.length : 0 });
  if (result.status !== 'OK') console.log(`NAMED STOP ${result.stop}: ${result.reason}\n::warning::NAMED STOP ${result.stop}: ${result.reason}`);
  else console.log(`free model answered: ${result.model} (cost $0)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((err) => { console.error(err); process.exit(1); });
}

// Paid lanes (the citation probes) are off by owner policy. A lane may only run
// when a human dispatched it with confirm_paid=true, which the workflow passes
// through as CONFIRM_PAID=true. Anything else is a named stop: exit 0, a
// receipt, and nothing asked of any provider.
export function refuseUnlessPaidConfirmed(lane) {
  if (process.env.CONFIRM_PAID === 'true') return;
  console.log(`NAMED STOP PAID_LANE_REFUSED: ${lane} is disabled by owner policy (11 Oct 2026, "nothing should be paid"). Dispatch its workflow with confirm_paid=true to run it once; nothing was asked of any provider.`);
  receipt({ lane, state: 'NAMED_STOP', stop: 'PAID_LANE_REFUSED', disabled_by: 'owner policy 2026-10-11', generated: false });
  process.exit(0);
}

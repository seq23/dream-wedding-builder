#!/usr/bin/env node
// Guard for the owner's zero-paid-LLM policy (11 Oct 2026: "nothing should be paid").
//
// Fails when:
//   1. config/llm_routing.json is not a $0-only policy (max_cost_usd 0, no paid
//      fallback, 3-4 models each priced "0", a pricing snapshot date);
//   2. any code file calls a model/search provider endpoint other than the free
//      router or a declared paid lane (config.paid_lanes[].scripts);
//   3. any scheduled workflow reaches a paid-lane script (through `node`, `bash`
//      or `npm run`, followed through package.json and relative imports), or
//      hands a provider key to a step that is not the free router;
//   4. a paid-lane workflow has a schedule, or lacks a confirm_paid input
//      defaulting to false that gates the paid step and refuses otherwise;
//   5. a paid-lane entry script, run without CONFIRM_PAID, does anything but a
//      named stop with no network call;
//   6. the router, exercised with a stubbed provider, falls back to paid, keeps
//      a reported cost, or generates without a key.
// Hard-fails on zero items at every stage.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { policyErrors, readConfig, routeChat, loadPolicy, PaidCostError, describeKey } from './free_router.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const errors = [];
const notes = [];
const config = readConfig();

// 1. Policy -------------------------------------------------------------------
for (const e of policyErrors(config)) errors.push(`policy: ${e}`);
const ROUTER = 'scripts/llm/free_router.mjs';
const SELF = 'scripts/llm/validate_zero_paid_llm.mjs';
const lanes = Array.isArray(config.paid_lanes) ? config.paid_lanes : [];
const laneScripts = new Set(lanes.flatMap((l) => l.scripts || []));
const markers = (config.provider_endpoint_markers || []).map((m) => new RegExp(m, 'i'));
if (markers.length < 5) errors.push('config.provider_endpoint_markers must list the provider endpoints (found fewer than 5)');

// 2. Every model/provider call site is the router or a declared paid lane -------
const CODE_EXT = /\.(m?js|cjs|ts|tsx|py|sh)$/;
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', '.open-next', 'dist', '.wrangler', '.astro', 'playwright-report', 'test-results', 'product-builds']);
function walk(dir, out = []) {
  if (CODE_EXT.test(dir) && fs.existsSync(dir) && fs.statSync(dir).isFile()) { out.push(dir); return out; }
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const d of ents) {
    if (SKIP_DIRS.has(d.name)) continue;
    const p = path.join(dir, d.name);
    if (d.isDirectory()) walk(p, out);
    else if (CODE_EXT.test(d.name)) out.push(p);
  }
  return out;
}
const codeFiles = (config.scan_roots || ['scripts']).flatMap((r) => walk(path.join(ROOT, r)));
if (!codeFiles.length) errors.push('scan: zero code files scanned');
const callers = [];
for (const f of codeFiles) {
  const r = rel(f);
  if (r === SELF) continue;
  const text = fs.readFileSync(f, 'utf8');
  if (markers.some((m) => m.test(text))) callers.push(r);
}
for (const r of callers) {
  if (r === ROUTER || laneScripts.has(r)) continue;
  errors.push(`model/provider call outside the free router: ${r} (route it through ${ROUTER}, or declare it a paid lane)`);
}
for (const s of laneScripts) if (!fs.existsSync(path.join(ROOT, s))) errors.push(`paid lane script ${s} does not exist`);
if (!callers.includes(ROUTER)) errors.push(`scan did not find the router's own endpoint marker in ${ROUTER}; the scan is not reaching code`);

// 3/4. Workflows -----------------------------------------------------------------
const WF_DIR = path.join(ROOT, '.github', 'workflows');
const workflows = fs.readdirSync(WF_DIR).filter((f) => /\.ya?ml$/.test(f));
if (!workflows.length) errors.push('workflows: zero workflow files found');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const npmScripts = pkg.scripts || {};

const stripComment = (l) => (/^\s*#/.test(l) ? '' : l);
export function isScheduled(text) {
  return text.split('\n').map(stripComment).some((l) => /^\s+schedule:\s*$/.test(l) || /^\s*schedule:\s*$/.test(l));
}
// Split a workflow into steps (text blocks) using indentation only.
export function steps(text) {
  const lines = text.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*steps:\s*$/.test(lines[i])) continue;
    let indent = null;
    let cur = null;
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (!l.trim() || /^\s*#/.test(l)) { if (cur) cur.push(l); continue; }
      const ind = l.match(/^(\s*)/)[1].length;
      if (indent === null) { const m = l.match(/^(\s*)- /); if (!m) break; indent = m[1].length; }
      if (ind < indent || (ind === indent && !/^\s*- /.test(l))) { i = j - 1; break; }
      if (ind === indent && /^\s*- /.test(l)) { cur = [l]; out.push(cur); } else if (cur) cur.push(l);
    }
  }
  return out.map((b) => b.filter((l) => !/^\s*#/.test(l)).join('\n'));
}
// Files a shell command reaches: node/bash/sh paths and npm run expansions.
function reached(cmd, seen = new Set()) {
  const files = new Set();
  for (const m of cmd.matchAll(/(?:^|[\s;&|(])(?:node|bash|sh|python3?)\s+(?:-[^\s]+\s+)*([\w./-]+\.(?:m?js|cjs|sh|py))/g)) files.add(m[1].replace(/^\.\//, ''));
  for (const m of cmd.matchAll(/(?:^|[\s;&|(])(scripts\/[\w./-]+\.(?:sh|m?js|py))/g)) files.add(m[1]);
  for (const m of cmd.matchAll(/npm\s+(?:run(?:-script)?|run)\s+([\w:.-]+)/g)) {
    const name = m[1];
    if (seen.has(name) || !npmScripts[name]) continue;
    seen.add(name);
    for (const f of reached(npmScripts[name], seen)) files.add(f);
  }
  return files;
}
function withImports(files) {
  const out = new Set(files);
  const queue = [...files];
  while (queue.length) {
    const f = queue.shift();
    const abs = path.join(ROOT, f);
    if (!/\.(m?js|cjs)$/.test(f) || !fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, 'utf8');
    for (const m of text.matchAll(/(?:import\s[^'"]*?from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const r = rel(path.resolve(path.dirname(abs), m[1]));
      if (!out.has(r)) { out.add(r); queue.push(r); }
    }
  }
  return out;
}
const KEY_RE = /secrets\.(OPENROUTER_API_KEY|GEMINI_API_KEY|GOOGLE_GEMINI_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|PERPLEXITY_API_KEY|SERPAPI_KEY|SERPAPI_API_KEY|SEMRUSH_API_KEY|AHREFS_API_KEY|APIFY_TOKEN|APIFY_API_TOKEN)/;
let scheduledCount = 0;
let routerSteps = 0;
for (const wf of workflows) {
  const text = fs.readFileSync(path.join(WF_DIR, wf), 'utf8');
  if (!isScheduled(text)) continue;
  scheduledCount++;
  for (const step of steps(text)) {
    const files = withImports(reached(step));
    const hits = [...files].filter((f) => laneScripts.has(f));
    if (hits.length) errors.push(`scheduled workflow ${wf} reaches paid lane script(s) ${hits.join(', ')}`);
    const viaRouter = files.has(ROUTER) && [...files].every((f) => !callers.includes(f) || f === ROUTER);
    if (KEY_RE.test(step) && !viaRouter) errors.push(`scheduled workflow ${wf} hands a provider key to a step that is not the free router:\n${step.split('\n').slice(0, 3).join('\n')}`);
    if (KEY_RE.test(step) && viaRouter) routerSteps++;
  }
}
if (!scheduledCount) errors.push('workflows: zero scheduled workflows found; the schedule scan is not reaching anything');
if (!routerSteps) errors.push('no scheduled workflow runs the free router check (npm run llm:check); the $0 routing is never proven live');

if (!lanes.length) errors.push('config.paid_lanes is empty; every probe must be declared');
for (const lane of lanes) {
  const file = path.join(WF_DIR, lane.workflow || '');
  if (!lane.workflow || !fs.existsSync(file)) { errors.push(`paid lane ${lane.id}: workflow ${lane.workflow} missing`); continue; }
  if (lane.status !== 'disabled_by_owner_policy') errors.push(`paid lane ${lane.id}: status must be disabled_by_owner_policy`);
  const text = fs.readFileSync(file, 'utf8');
  if (isScheduled(text)) errors.push(`paid lane ${lane.id}: ${lane.workflow} has a schedule; paid lanes are dispatch-only`);
  const noComments = text.split('\n').map(stripComment).join('\n');
  if (!/workflow_dispatch:/.test(noComments)) errors.push(`paid lane ${lane.id}: ${lane.workflow} has no workflow_dispatch`);
  const input = noComments.match(/\n(\s+)confirm_paid:\s*\n((?:\1\s+.*\n)+)/);
  if (!input) errors.push(`paid lane ${lane.id}: ${lane.workflow} has no confirm_paid input`);
  else {
    if (!/type:\s*boolean/.test(input[2])) errors.push(`paid lane ${lane.id}: confirm_paid must be type boolean`);
    if (!/default:\s*false/.test(input[2])) errors.push(`paid lane ${lane.id}: confirm_paid must default to false`);
  }
  const st = steps(text);
  const paidSteps = st.filter((s) => [...withImports(reached(s))].some((f) => laneScripts.has(f)));
  if (!paidSteps.length) errors.push(`paid lane ${lane.id}: ${lane.workflow} has no step reaching its scripts`);
  for (const s of paidSteps) {
    if (!/if:\s*.*inputs\.confirm_paid/.test(s)) errors.push(`paid lane ${lane.id}: a paid step in ${lane.workflow} is not gated by inputs.confirm_paid`);
    if (!/CONFIRM_PAID:\s*\$\{\{\s*inputs\.confirm_paid\s*\}\}/.test(s)) errors.push(`paid lane ${lane.id}: a paid step in ${lane.workflow} does not pass CONFIRM_PAID from the input`);
  }
  if (!st.some((s) => /if:\s*.*(!\s*inputs\.confirm_paid|inputs\.confirm_paid\s*!=\s*true)/.test(s) && /NAMED STOP/.test(s))) errors.push(`paid lane ${lane.id}: ${lane.workflow} has no refusal step that prints a NAMED STOP when confirm_paid is false`);

  // 5. Behaviour: the entry refuses without CONFIRM_PAID and touches no network.
  if (lane.entry) {
    const env = { ...process.env, OPENROUTER_API_KEY: 'sk-validator-dummy', GEMINI_API_KEY: 'validator-dummy', CONFIRM_PAID: '' };
    const preload = 'data:text/javascript,globalThis.fetch=()=>{process.stderr.write("FETCH_ATTEMPTED\\n");throw new Error("network blocked by validator")};';
    const r = spawnSync(process.execPath, ['--import', preload, lane.entry, ...(lane.entry_args || [])], { cwd: ROOT, env, encoding: 'utf8', timeout: 30000 });
    const out = `${r.stdout}\n${r.stderr}`;
    if (r.status !== 0) errors.push(`paid lane ${lane.id}: entry exited ${r.status} without CONFIRM_PAID (expected a named stop, exit 0)\n${out.slice(0, 400)}`);
    if (!/NAMED STOP PAID_LANE_REFUSED/.test(out)) errors.push(`paid lane ${lane.id}: entry did not print NAMED STOP PAID_LANE_REFUSED without CONFIRM_PAID`);
    if (/FETCH_ATTEMPTED/.test(out)) errors.push(`paid lane ${lane.id}: entry attempted a network call without CONFIRM_PAID`);
  } else errors.push(`paid lane ${lane.id}: no entry declared to prove the refusal`);
}

// 6. Router behaviour against a stubbed provider --------------------------------
const policy = (() => { try { return loadPolicy(config); } catch { return null; } })();
if (policy) {
  const ids = policy.models.map((m) => m.id);
  const msg = [{ role: 'user', content: 'x' }];
  const resp = (status, body) => async () => ({ ok: status < 300, status, json: async () => body });
  const calls = [];
  const failing = async (url, init) => { calls.push(JSON.parse(init.body).model); return { ok: false, status: 503, json: async () => ({ error: { message: 'down' } }) }; };
  const r1 = await routeChat({ messages: msg, apiKey: 'k', fetchImpl: failing, config });
  if (r1.status !== 'NAMED_STOP' || r1.stop !== 'NO_FREE_MODEL_ANSWERED' || r1.generated !== false) errors.push('router: all free models down did not end in NAMED_STOP NO_FREE_MODEL_ANSWERED');
  if (calls.join() !== ids.join()) errors.push(`router: tried ${calls.join()} instead of exactly the free list in order`);
  let threw = false;
  try { await routeChat({ messages: msg, apiKey: 'k', config, fetchImpl: resp(200, { model: ids[0], choices: [{ message: { content: 'hi' } }], usage: { cost: 0.0003 } }) }); } catch (e) { threw = e instanceof PaidCostError; }
  if (!threw) errors.push('router: a non-zero reported cost did not throw PaidCostError');
  threw = false;
  try { await routeChat({ messages: msg, apiKey: 'k', config, fetchImpl: resp(200, { model: 'openai/gpt-4o-mini', choices: [{ message: { content: 'hi' } }], usage: { cost: 0 } }) }); } catch (e) { threw = e instanceof PaidCostError; }
  if (!threw) errors.push('router: an answer from a model off the $0 list did not throw');
  const ok = await routeChat({ messages: msg, apiKey: 'k', config, fetchImpl: resp(200, { model: ids[0], choices: [{ message: { content: 'hi' } }], usage: { cost: 0 } }) });
  if (ok.status !== 'OK' || ok.model !== ids[0] || ok.cost_usd !== 0) errors.push('router: a $0 answer was not returned as OK');
  const refused = [];
  const r401 = await routeChat({ messages: msg, apiKey: 'k', config, fetchImpl: async (u, i) => { refused.push(1); return { ok: false, status: 401, json: async () => ({ error: { message: 'User not found.' } }) }; } });
  if (r401.stop !== 'CREDENTIAL_REFUSED' || refused.length !== 1) errors.push('router: a refused key did not stop at once as CREDENTIAL_REFUSED');
  const walked = [];
  const r403 = await routeChat({ messages: msg, apiKey: 'k', config, fetchImpl: async (u, i) => { const model = JSON.parse(i.body).model; walked.push(model); return walked.length === 1 ? { ok: false, status: 403, json: async () => ({ error: { message: `${model} is only available on agentic harnesses` } }) } : { ok: true, status: 200, json: async () => ({ model, choices: [{ message: { content: 'ok' } }], usage: { cost: 0 } }) }; } });
  if (r403.status !== 'OK' || walked.length !== 2) errors.push('router: a model-specific 403 stopped the walk instead of trying the next free model');
  let fetched = false;
  const nokey = await routeChat({ messages: msg, apiKey: '', config, fetchImpl: async () => { fetched = true; return {}; } });
  if (nokey.stop !== 'NO_FREE_MODEL_KEY' || fetched) errors.push('router: no key did not end in NAMED_STOP without a network call');
  for (const bad of [{ ...config, policy: { ...config.policy, max_cost_usd: 0.01 } }, { ...config, policy: { ...config.policy, paid_fallback: true } }, { ...config, models: [...config.models.slice(0, 2), { id: 'openai/gpt-4o-mini', context_length: 128000, pricing: { prompt: '0.00000015', completion: '0.0000006' } }] }]) {
    let refusedLoad = false;
    try { await routeChat({ messages: msg, apiKey: 'k', config: bad, fetchImpl: failing }); } catch (e) { refusedLoad = e.code === 'POLICY_REFUSED'; }
    if (!refusedLoad) errors.push('router: a non-$0 policy was loaded instead of refused');
  }
  const secret = 'sk-or-v1-validator-secret-0123456789';
  const kinfo = await describeKey({ apiKey: secret, fetchImpl: resp(200, { data: { label: 'sk-or-v1-val...789', limit: 0, usage: 0, is_free_tier: false, limit_remaining: 0, extra: secret } }) });
  if (kinfo.key_label !== 'sk-or-v1-val...789' || JSON.stringify(kinfo).includes(secret)) errors.push('router: describeKey did not return the label alone, or leaked the key');
  const kref = await describeKey({ apiKey: secret, fetchImpl: resp(401, { error: { message: 'disabled' } }) });
  if (kref.key_state !== 'REFUSED') errors.push('router: a refused key was not described as REFUSED');
  notes.push(`router behaviour: 11 cases`);
}

if (errors.length) {
  console.error(`zero-paid-llm: FAIL (${errors.length})`);
  for (const e of errors) console.error(` - ${e}`);
  process.exit(1);
}
console.log(`zero-paid-llm: PASS — ${policy.models.length} $0 models (snapshot ${config.pricing_snapshot.date}), ${codeFiles.length} code files scanned, provider callers: ${callers.join(', ')}; ${scheduledCount} scheduled workflows clear, ${routerSteps} free-router step(s); ${lanes.length} paid lane(s) dispatch-only behind confirm_paid and refusing without it; ${notes.join('; ')}`);

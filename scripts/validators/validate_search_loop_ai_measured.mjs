#!/usr/bin/env node
// The committed weekly search-loop report must carry a NUMBER for AI-referral
// visits and for AI-bot reads whenever the reason it does not is a credential
// the repository controls.
//
// Why: Search Readiness item f11 ("AI-referral visits and AI-bot reads are
// measured every week") reads the newest search-loop-week report and fails when
// either field is not a number. On 3 November 2026 both had read
// "not read: Cloudflare analytics refused the query: Actor
// 'com.cloudflare.api.token...' does not have permission ..." — the
// SEARCH_LOOP_CF_USAGE_TOKEN secret was scoped to account analytics for the
// Workers AI usage read but not to Zone:Read + Zone Analytics, which is what
// src/analytics.mjs in the engine needs for the bot and referral queries. Half of
// the loop's purpose (AEO/GEO) was unmeasured and nothing in this repository said
// so; the report was committed every day with the refusal inside it.
//
// Her rule "a stop the next scheduled run retries is a note, not a red main"
// decides the severity split: a reason that names a token, a permission or a
// missing environment variable never clears itself and is a HARD_FAIL, while any
// other refusal (a Cloudflare outage, a timeout) is a NAMED NOTE and exit 0.
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] || '.';
const file = path.join(root, 'data/search-loop/search-loop-week.json');
const FIELDS = [['ai_visitors', 'AI-referral visits'], ['ai_bot_hits', 'AI-bot reads']];
// Reasons the next run cannot clear on its own.
const CREDENTIAL = /permission|not authoris|not authoriz|unauthor|forbidden|\btoken\b|is not set|needs Zone|invalid|expired|turn on Web Analytics/i;

if (!fs.existsSync(file)) {
  console.error(`[validate:search-loop-ai-measured] FAIL: ${file} is missing; the engine's commit step writes it on every run, so nothing could be checked`);
  process.exit(1);
}

let report;
try { report = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
  console.error(`[validate:search-loop-ai-measured] FAIL: ${file} is not valid JSON (${String(e.message).slice(0, 80)})`);
  process.exit(1);
}

const hard = [];
const notes = [];
let measured = 0;

for (const [key, label] of FIELDS) {
  const v = report[key];
  if (typeof v === 'number' && Number.isFinite(v)) { measured += 1; continue; }
  if (typeof v === 'string' && v.startsWith('not read: ')) {
    const why = v.slice('not read: '.length);
    (CREDENTIAL.test(why) ? hard : notes).push(`${label} (${key}): ${why.slice(0, 200)}`);
    continue;
  }
  hard.push(`${label} (${key}) is ${JSON.stringify(v)}, which is neither a number nor "not read: <reason>"`);
}

// Rule 0: the two fields are the whole subject; a run that measured neither and
// named no reason must not exit 0.
if (measured === 0 && hard.length === 0 && notes.length === 0) {
  console.error('[validate:search-loop-ai-measured] FAIL: neither field was read and no reason was given; nothing was checked');
  process.exit(1);
}

if (hard.length) {
  console.error(`[validate:search-loop-ai-measured] FAIL: ${hard.length} of ${FIELDS.length} AI measurement(s) are unread for a reason this repository controls:`);
  for (const x of hard) console.error(`  - ${x}`);
  console.error(`  Report: ${report.generated_at ?? 'no generated_at'} (${report.run_url ?? 'no run_url'})`);
  console.error('  Repair: SEARCH_LOOP_CF_USAGE_TOKEN needs Zone:Read + Zone Analytics:Read AND Account Analytics:Read');
  console.error('  (the engine uses the one CLOUDFLARE_API_TOKEN for the zone bot/referral queries and the Workers AI usage read).');
  console.error('  The vault holds a token with all three: cd ~/GitHub/boss-os && npm run -s vault:run -- bash -c \'printf "%s" "$CLOUDFLARE_ANALYTICS_READ_TOKEN" | gh secret set SEARCH_LOOP_CF_USAGE_TOKEN -R seq23/dream-wedding-builder\'');
  console.error('  Then re-run the Search Loop workflow with stage=check so a fresh report is committed.');
  process.exit(1);
}

for (const x of notes) console.log(`[validate:search-loop-ai-measured] NAMED NOTE [AI_MEASURE_RETRY] ${x} — the next scheduled run retries it`);
console.log(`[validate:search-loop-ai-measured] OK: ${measured} of ${FIELDS.length} measured in the report of ${report.generated_at ?? 'unknown date'} (ai_visitors=${JSON.stringify(report.ai_visitors)}, ai_bot_hits=${JSON.stringify(report.ai_bot_hits)})`);

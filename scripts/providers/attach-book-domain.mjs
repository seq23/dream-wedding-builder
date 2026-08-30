#!/usr/bin/env node
/**
 * Attach the domain printed inside the books to this Worker.
 *
 * Five published Kindle EPUBs print https://weddingpdfchecklist.com/amazon/<slug>
 * on their last page. The domain is registered in the owner's Cloudflare account
 * but answers nothing until it is bound to something. This script binds it, as a
 * Workers custom domain on both the apex and the www form, which is what creates
 * the proxied DNS record and provisions the TLS certificate. Nothing else is
 * needed: middleware.ts already answers every request on that host with a 301 to
 * the same path on weddingchecklistpdf.com, so the host resolves but never
 * publishes a second copy of the site.
 *
 * Why a custom domain rather than a zone-level Redirect Rule
 * ----------------------------------------------------------
 * A whole-zone Redirect Rule would be the lighter mechanism - it answers at the
 * edge without waking the Worker. It was not available: the credential this
 * property is administered with holds #worker:edit and #zone:read, and both
 * /zones/:id/dns_records and the http_request_dynamic_redirect ruleset return
 * 403 Authentication error under it (checked 2026-08-29). Creating the rule
 * would also still require a proxied DNS record on the apex, which is the same
 * denied permission. The custom domain reaches the identical outcome for a
 * reader - one hop, path preserved, one set of indexed URLs - using the
 * permission that is actually granted. If zone-edit is ever added to the token,
 * a Redirect Rule can replace this and the middleware branch stays as the
 * backstop; scripts/validate-book-domain.mjs asserts the behaviour, not the
 * mechanism, so it would keep passing.
 *
 * Idempotent: a hostname already attached to this Worker is reported and skipped.
 * It never detaches anything, and it refuses to touch a hostname that is bound to
 * a different Worker rather than stealing it.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ZONE_NAME = 'weddingpdfchecklist.com';
const HOSTNAMES = [ZONE_NAME, `www.${ZONE_NAME}`];
const SERVICE = 'dream-wedding-builder';
const ENVIRONMENT = 'production';

// CLOUDFLARE_API_TOKEN is the documented input (see .env.example and
// scripts/providers/cloudflare-discover.mjs). The wrangler credential is a
// fallback so an operator already logged in with `wrangler login` does not have
// to mint a second token to run a one-off binding. It is read, never printed.
function credential() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  const cfg = path.join(os.homedir(), '.wrangler', 'config', 'default.toml');
  if (fs.existsSync(cfg)) {
    const match = fs.readFileSync(cfg, 'utf8').match(/^\s*oauth_token\s*=\s*"([^"]+)"/m);
    if (match) return match[1];
  }
  throw new Error('Set CLOUDFLARE_API_TOKEN in the current shell, or run `wrangler login` first.');
}

const token = credential();
const account = process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || '8d147e242033699dd37c6f5a451f48d2';
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function cf(method, endpoint, body) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(`${method} ${endpoint} -> ${res.status} ${JSON.stringify(json.errors ?? json)}`);
  }
  return json.result;
}

const zones = await cf('GET', `/zones?name=${encodeURIComponent(ZONE_NAME)}`);
const zone = zones[0];
if (!zone) throw new Error(`Zone ${ZONE_NAME} is not in account ${account}. Register or transfer it before running this.`);
if (zone.status !== 'active') throw new Error(`Zone ${ZONE_NAME} is ${zone.status}, not active. A custom domain on a pending zone will not serve.`);
console.log(`zone ${ZONE_NAME}: ${zone.id} (${zone.status})`);

const existing = await cf('GET', `/accounts/${account}/workers/domains?per_page=100`);
const byHostname = new Map(existing.map((d) => [d.hostname, d]));

let created = 0;
let alreadyBound = 0;
for (const hostname of HOSTNAMES) {
  const current = byHostname.get(hostname);
  if (current) {
    if (current.service !== SERVICE) throw new Error(`${hostname} is already a custom domain of Worker "${current.service}". Refusing to steal it; detach it deliberately first.`);
    alreadyBound += 1;
    console.log(`  ${hostname}: already bound to ${SERVICE} (${current.id})`);
    continue;
  }
  const result = await cf('PUT', `/accounts/${account}/workers/domains`, {
    zone_id: zone.id, hostname, service: SERVICE, environment: ENVIRONMENT,
  });
  created += 1;
  console.log(`  ${hostname}: attached to ${SERVICE} (${result.id})`);
}

// Rule 0: a run that bound nothing and found nothing bound has done nothing.
if (created === 0 && alreadyBound === 0) {
  console.error('attach-book-domain: examined 0 hostnames. This cannot be a success.');
  process.exit(2);
}
console.log(`attach-book-domain: ${created} attached, ${alreadyBound} already bound, ${HOSTNAMES.length} examined.`);
console.log('Verify with: npm run validate:book-domain');

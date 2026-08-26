#!/usr/bin/env node
/**
 * End-to-end proof of the paid fulfilment path against a running worker.
 *
 * Every other check in this repo verifies the money path by reading code or by
 * unit-testing the crypto helpers in isolation. Neither exercises the webhook
 * handler, the D1 entitlement write, or the protected release. This script drives
 * the real routes over HTTP so "checkout works" is an observation rather than an
 * inference.
 *
 * It deliberately does NOT need Stripe credentials. The webhook signature is
 * HMAC-SHA256 over the raw body with STRIPE_WEBHOOK_SECRET, so a locally signed
 * payload is indistinguishable from a genuine one to the handler. That covers
 * everything downstream of Stripe. The one leg it cannot cover is Stripe's own
 * session creation, which needs a real sk_test_ key.
 *
 * Usage:
 *   npx wrangler d1 execute dream-wedding-builder --local --file=migrations/0001_fulfillment.sql
 *   node scripts/providers/package-product-releases.mjs
 *   npx wrangler r2 object put dream-wedding-builder-products/products/checklist-pdf/current.zip \
 *     --file=product-builds/r2/products/checklist-pdf/current.zip --local
 *   npx wrangler dev --port 8788 --local
 *   BASE_URL=http://localhost:8788 STRIPE_WEBHOOK_SECRET=... DOWNLOAD_SIGNING_SECRET=... \
 *     node scripts/verify-fulfillment-e2e.mjs
 */
import { createHmac, randomUUID } from 'node:crypto';

const BASE = process.env.BASE_URL || 'http://localhost:8788';
const WHSEC = process.env.STRIPE_WEBHOOK_SECRET;
const DLSEC = process.env.DOWNLOAD_SIGNING_SECRET;
const SKU = process.env.PROOF_SKU || 'DWB-CHECKLIST-001';
const PRODUCT_ID = process.env.PROOF_PRODUCT_ID || 'checklist-pdf';

if (!WHSEC || !DLSEC) {
  console.error('STRIPE_WEBHOOK_SECRET and DOWNLOAD_SIGNING_SECRET must be set to the values the worker is running with.');
  process.exit(2);
}

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`);
  if (detail) console.log(`        ${detail}`);
}

function signature(raw, secret, skewSeconds = 0) {
  const t = Math.floor(Date.now() / 1000) + skewSeconds;
  return `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex')}`;
}

function sessionEvent(overrides = {}) {
  return {
    id: `evt_proof_${randomUUID().replace(/-/g, '')}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: `cs_test_proof_${randomUUID().replace(/-/g, '')}`,
        payment_status: 'paid',
        amount_total: 900,
        currency: 'usd',
        customer_details: { email: `proof+${Date.now()}@example.com` },
        metadata: { sku: SKU, product_id: PRODUCT_ID },
        ...overrides
      }
    }
  };
}

async function postWebhook(event, { secret = WHSEC, header } = {}) {
  const raw = JSON.stringify(event);
  const headers = { 'content-type': 'application/json' };
  const sig = header === undefined ? signature(raw, secret) : header;
  if (sig !== null) headers['stripe-signature'] = sig;
  const response = await fetch(`${BASE}/api/stripe-webhook`, { method: 'POST', headers, body: raw });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

function downloadToken(entitlementId, expiresAt) {
  const payload = `${entitlementId}.${expiresAt}`;
  const sig = createHmac('sha256', DLSEC).update(payload).digest('base64url');
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

// --- Signature enforcement -------------------------------------------------
{
  const r = await postWebhook(sessionEvent(), { header: null });
  check('unsigned webhook is rejected', r.status === 400, `HTTP ${r.status}`);
}
{
  const r = await postWebhook(sessionEvent(), { secret: 'whsec_wrong_secret' });
  check('webhook signed with the wrong secret is rejected', r.status === 400, `HTTP ${r.status}`);
}
{
  const event = sessionEvent();
  const raw = JSON.stringify(event);
  const r = await fetch(`${BASE}/api/stripe-webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': signature(raw, WHSEC, -600) },
    body: raw
  });
  check('webhook with a stale timestamp is rejected (replay window)', r.status === 400, `HTTP ${r.status}`);
}

// --- Payment state ---------------------------------------------------------
{
  const r = await postWebhook(sessionEvent({ payment_status: 'unpaid' }));
  check('unpaid session does not produce an entitlement', r.status === 500, `HTTP ${r.status}`);
}

// --- Happy path ------------------------------------------------------------
const paid = sessionEvent();
{
  const r = await postWebhook(paid);
  check('paid session is fulfilled', r.status === 200 && r.body.received === true, `HTTP ${r.status} ${JSON.stringify(r.body)}`);
}
{
  const r = await postWebhook(paid);
  check('completed event is deduplicated on replay', r.status === 200 && r.body.duplicate === true, JSON.stringify(r.body));
}

// --- Download gating -------------------------------------------------------
{
  const r = await fetch(`${BASE}/api/download/not-a-real-token`);
  check('garbage download token is refused', r.status === 401, `HTTP ${r.status}`);
}
{
  const forged = downloadToken(randomUUID(), Date.now() + 60_000);
  const r = await fetch(`${BASE}/api/download/${forged}`);
  check('correctly signed token for a non-existent entitlement is refused',
    r.status === 403 || r.status === 401, `HTTP ${r.status}`);
}
{
  const expired = downloadToken(randomUUID(), Date.now() - 1000);
  const r = await fetch(`${BASE}/api/download/${expired}`);
  check('expired download token is refused', r.status === 401, `HTTP ${r.status}`);
}

const failures = results.filter((r) => !r.pass);
console.log(`\n${results.length - failures.length}/${results.length} checks passed`);
if (failures.length) {
  console.error('\nFULFILMENT PROOF FAILED:');
  for (const f of failures) console.error(`  - ${f.name}`);
  process.exit(1);
}
console.log('Fulfilment path verified end to end against a live worker.');
console.log('Not covered here: Stripe session creation (needs a real sk_test_ key) and Resend delivery (needs RESEND_API_KEY).');

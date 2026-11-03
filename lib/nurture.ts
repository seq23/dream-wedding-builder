// FREE SAMPLE -> EMAIL -> PAID (Growth playbook, owner 1 Nov 2026).
//
// A visitor types their own address to get the free checklist sample (app/api/sample).
// That sends the sample at once (step 0), then one email every 3 days, each about ONE
// paid product, and stops for good when the address buys, unsubscribes, or the steps
// run out. Buyers get ONE polite review ask a few days after purchase, never again.
//
// Playbook rules enforced here, not in a document:
// - only addresses people typed themselves (builder_signups, consent text stored)
// - every marketing email: one-click unsubscribe (List-Unsubscribe + link) and the
//   mailing address; an opted-out address is never emailed again
// - at most one email per 3 days per address; the sequence stops on purchase
// - no fake urgency, no invented reviews; the review ask is never incentivised
//
// The Worker cron (worker.ts, hourly) calls runNurture(). Every send is recorded first-
// time-only in email_sends (PRIMARY KEY (email_hash, kind)), so a re-run never resends.

import { BUILDER_SIGNUPS_DDL } from './builder-signup';

export const MAILING_ADDRESS = '3055 Lombard St #471024, San Francisco, CA 94147';
export const SITE = 'https://weddingchecklistpdf.com';
export const MARKETING_FROM = 'Dream Wedding Builder <hello@mail.weddingchecklistpdf.com>';
export const REPLY_TO = 'info@weddingchecklistpdf.com';
export const SAMPLE_URL = `${SITE}/samples/wedding-checklist-sample.pdf`;
export const SAMPLE_SOURCE = 'sample:checklist';
export const DAYS_BETWEEN = 3;
export const REVIEW_ASK_AFTER_DAYS = 5;
// Review asks go only to orders placed after the ask existed, never to past buyers.
export const REVIEW_ASK_SINCE = '2026-11-01 00:00:00';
const DAY = 86_400_000;
const MAX_PER_RUN = 50;
// The global ceiling: at most this many marketing emails (sample, follow-ups, review asks) in
// any rolling 24 hours, whoever asks. The Resend team is shared with The Industry Guides, and a
// flood of typed-in strangers' addresses must never turn this site into a mailer. Over the
// ceiling nothing is sent and nothing is lost: the sign-up stays stored and the hourly run sends
// it when there is room. Paid-order delivery emails (lib/delivery-email.ts) are not counted.
export const NURTURE_DAILY_SEND_CEILING = 60;

export const NURTURE_DDL = [
  BUILDER_SIGNUPS_DDL,
  `CREATE TABLE IF NOT EXISTS email_sends (
    email_hash TEXT NOT NULL,
    kind TEXT NOT NULL,
    sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    provider_message_id TEXT,
    PRIMARY KEY (email_hash, kind)
  )`,
  `CREATE TABLE IF NOT EXISTS email_optouts (
    email_hash TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`
];

type Step = { kind: string; subject: string; heading: string; paragraphs: string[]; cta?: { label: string; url: string } };

// Step 0 delivers the sample; steps 1-4 each sell one product with what it really does.
export const SEQUENCE: Step[] = [
  {
    kind: 'seq0', subject: 'Your free wedding checklist sample',
    heading: 'Here is your free checklist sample.',
    paragraphs: [
      'Three pages from the Wedding Checklist PDF: how to use it, the critical-path page, and the 12 to 9 months page.',
      'Start with the critical path. Write down the few bookings everything else waits on (venue, date, budget), and give each one an owner and a date.'
    ],
    cta: { label: 'Download the sample (PDF)', url: SAMPLE_URL }
  },
  {
    kind: 'seq1', subject: 'The full checklist: 104 tasks, each with an owner',
    heading: 'The full Wedding Checklist PDF, $9',
    paragraphs: [
      'The sample has 3 of the 13 pages. The full checklist adds every planning window from 12+ months through wedding week, a wedding-week handoff tracker and a final-payments tracker.',
      'It comes as a 104-row editable spreadsheet plus the printable PDF, with fields for owner, dependency, priority and status, so tasks are assigned instead of assumed.'
    ],
    cta: { label: 'See the full checklist, $9', url: `${SITE}/products/checklist-pdf` }
  },
  {
    kind: 'seq2', subject: 'Where wedding budgets usually leak',
    heading: 'The Wedding Budget Spreadsheet, $12',
    paragraphs: [
      'Most budget surprises are taxes, service fees, gratuities and deposits that fall due in the same month.',
      'The budget spreadsheet tracks estimated, contracted, paid and remaining amounts side by side, lists the hidden-cost lines to ask vendors about, and shows how much cash you need each month before the bills arrive.'
    ],
    cta: { label: 'See the budget spreadsheet, $12', url: 'https://weddingbudgetspreadsheet.com/products/budget-spreadsheet' }
  },
  {
    kind: 'seq3', subject: 'A wedding-day schedule everyone can follow',
    heading: 'The Wedding Timeline Template, $12',
    paragraphs: [
      'The day runs on handoffs: when the florist arrives, who lets the band in, when the photographer needs the family.',
      'The timeline template builds one master schedule with owners, locations and buffers, then prints separate views for you, the wedding party, the photographer and family, with emergency contacts in the same file.'
    ],
    cta: { label: 'See the timeline template, $12', url: 'https://weddingtimelinetemplate.com/products/timeline-template' }
  },
  {
    kind: 'seq4', subject: 'All four planning tools in one download',
    heading: 'The Dream Wedding Operations Suite, $39',
    paragraphs: [
      'The suite is the checklist, the budget spreadsheet, the timeline template and the seating chart maker together, plus a venue comparison worksheet, vendor contact and payment trackers, and a wedding-week handoff packet.',
      'Bought separately the four tools are $52; the suite is $39. This is the last email in this short series.'
    ],
    cta: { label: 'See the suite, $39', url: `${SITE}/shop` }
  }
];

export const REVIEW_ASK: Step = {
  kind: 'review_ask', subject: 'A quick question about your wedding planning files',
  heading: 'How is the planning going?',
  paragraphs: [
    'If the files you bought helped, would you reply with a sentence or two about how? We would only ever show it with your first name, and only if you say yes in your reply.',
    'If you would rather not, just ignore this. It is the only time we will ask.'
  ]
};

export async function emailHash(email: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.trim().toLowerCase()));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`unsubscribe:${value}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/** The unsubscribe link carries a hash of the address and a signature, never the address itself. */
export async function unsubscribeUrl(secret: string, hash: string): Promise<string> {
  return `${SITE}/api/unsubscribe?id=${hash}&t=${await hmac(secret, hash)}`;
}

export async function verifyUnsubscribe(secret: string, hash: string, token: string): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/.test(hash) || !/^[0-9a-f]{32}$/.test(token)) return false;
  return (await hmac(secret, hash)) === token;
}

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** One marketing email, html + text, with the unsubscribe link and the mailing address in both. */
export function renderEmail(step: Step, unsubscribe: string) {
  const footer = `You are getting this because you asked for a free sample or bought from Dream Wedding Builder.`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#27231f;line-height:1.55"><h1 style="font-size:22px">${esc(step.heading)}</h1>${step.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}${step.cta ? `<p><a href="${esc(step.cta.url)}" style="display:inline-block;background:#27231f;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">${esc(step.cta.label)}</a></p>` : ''}<hr style="border:none;border-top:1px solid #ddd;margin:28px 0 12px"><p style="font-size:12px;color:#777">${esc(footer)} <a href="${esc(unsubscribe)}">Unsubscribe</a> (one click).<br>Dream Wedding Builder, ${esc(MAILING_ADDRESS)}</p></div>`;
  const text = `${step.heading}\n\n${step.paragraphs.join('\n\n')}${step.cta ? `\n\n${step.cta.label}: ${step.cta.url}` : ''}\n\n--\n${footer}\nUnsubscribe (one click): ${unsubscribe}\nDream Wedding Builder, ${MAILING_ADDRESS}\n`;
  return { html, text };
}

type Row = Record<string, unknown>;
export type NurtureDB = {
  prepare(sql: string): { bind(...v: unknown[]): { run(): Promise<unknown>; all(): Promise<{ results?: Row[] }>; first(): Promise<Row | null> }; run(): Promise<unknown> };
};
export type NurtureEnv = { DB?: NurtureDB; RESEND_API_KEY?: string; DOWNLOAD_SIGNING_SECRET?: string; MARKETING_FROM_EMAIL?: string };

export async function ensureTables(db: NurtureDB) {
  for (const ddl of NURTURE_DDL) await db.prepare(ddl).run();
}

/** Which sequence step, if any, is due for this address now. Pure. */
export function dueStep(sentKinds: Set<string>, lastSentAt: number | null, now: number): Step | null {
  const next = SEQUENCE.find((s) => !sentKinds.has(s.kind));
  if (!next) return null;
  if (next.kind !== 'seq0' && lastSentAt != null && now - lastSentAt < DAYS_BETWEEN * DAY) return null;
  return next;
}

const sqlTime = (ms: number) => new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
const parseSql = (v: unknown) => Date.parse(`${String(v).replace(' ', 'T')}Z`);

/** Sends one email and records it. A row already present means it was sent: nothing is sent twice. */
async function sendOnce(env: NurtureEnv, email: string, hash: string, step: Step, fetchImpl: typeof fetch): Promise<'SENT' | 'ALREADY' | 'FAILED' | 'CEILING'> {
  const db = env.DB!;
  // One statement claims the step AND checks the daily ceiling, so two requests cannot both pass it.
  const claim = await db.prepare(
    `INSERT OR IGNORE INTO email_sends (email_hash, kind) SELECT ?, ?
     WHERE (SELECT COUNT(*) FROM email_sends WHERE sent_at > datetime('now', '-1 day')) < ?`
  ).bind(hash, step.kind, NURTURE_DAILY_SEND_CEILING).run() as { meta?: { changes?: number } };
  if (claim?.meta?.changes === 0) {
    const already = await db.prepare('SELECT 1 FROM email_sends WHERE email_hash = ? AND kind = ?').bind(hash, step.kind).first();
    if (already) return 'ALREADY';
    console.error(JSON.stringify({ event: 'NURTURE_DAILY_CEILING', ceiling: NURTURE_DAILY_SEND_CEILING }));
    return 'CEILING';
  }
  const unsubscribe = await unsubscribeUrl(env.DOWNLOAD_SIGNING_SECRET!, hash);
  const { html, text } = renderEmail(step, unsubscribe);
  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.MARKETING_FROM_EMAIL || MARKETING_FROM, to: [email], reply_to: REPLY_TO, subject: step.subject, html, text,
      headers: { 'List-Unsubscribe': `<${unsubscribe}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
    })
  });
  const body = await res.json().catch(() => ({})) as { id?: string };
  if (!res.ok) {
    // Release the claim so the next run retries this step.
    await db.prepare('DELETE FROM email_sends WHERE email_hash = ? AND kind = ?').bind(hash, step.kind).run();
    console.error(JSON.stringify({ event: 'NURTURE_SEND_FAILED', kind: step.kind, status: res.status }));
    return 'FAILED';
  }
  await db.prepare('UPDATE email_sends SET provider_message_id = ? WHERE email_hash = ? AND kind = ?').bind(body.id ?? null, hash, step.kind).run();
  return 'SENT';
}

/** NAMED STOP when sending cannot work; null when it can. */
export function nurtureStop(env: NurtureEnv): string | null {
  if (!env.DB) return 'NAMED STOP [NO_DB] the D1 binding is missing';
  if (!env.RESEND_API_KEY) return 'NAMED STOP [NO_RESEND_KEY] RESEND_API_KEY is not set on the Worker';
  if (!env.DOWNLOAD_SIGNING_SECRET) return 'NAMED STOP [NO_SIGNING_SECRET] DOWNLOAD_SIGNING_SECRET is not set, so no unsubscribe link can be signed';
  return null;
}

/** Sends the sample right after sign-up (step 0). */
export async function sendSample(env: NurtureEnv, email: string, fetchImpl: typeof fetch = fetch) {
  const stop = nurtureStop(env);
  if (stop) return { status: 'STOPPED' as const, stop };
  await ensureTables(env.DB!);
  const hash = await emailHash(email);
  const opted = await env.DB!.prepare('SELECT 1 FROM email_optouts WHERE email_hash = ?').bind(hash).first();
  if (opted) return { status: 'OPTED_OUT' as const };
  return { status: await sendOnce(env, email, hash, SEQUENCE[0], fetchImpl) };
}

/** The hourly run: due sequence steps, then due review asks. */
export async function runNurture(env: NurtureEnv, now = Date.now(), fetchImpl: typeof fetch = fetch) {
  const stop = nurtureStop(env);
  if (stop) { console.error(JSON.stringify({ event: 'NURTURE_STOPPED', stop })); return { stop, sent: 0, review_asks: 0 }; }
  const db = env.DB!;
  await ensureTables(db);
  const optouts = new Set(((await db.prepare('SELECT email_hash FROM email_optouts').bind().all()).results ?? []).map((r) => String(r.email_hash)));
  const sends = (await db.prepare('SELECT email_hash, kind, sent_at FROM email_sends').bind().all()).results ?? [];
  const byHash = new Map<string, { kinds: Set<string>; last: number | null }>();
  for (const s of sends) {
    const h = String(s.email_hash); const at = parseSql(s.sent_at);
    const e = byHash.get(h) ?? { kinds: new Set<string>(), last: null };
    e.kinds.add(String(s.kind));
    if (String(s.kind).startsWith('seq') || s.kind === 'review_ask') e.last = Math.max(e.last ?? 0, at);
    byHash.set(h, e);
  }
  const buyers = new Set<string>();
  for (const r of (await db.prepare("SELECT DISTINCT lower(customer_email) AS email FROM orders WHERE status = 'PAID'").bind().all()).results ?? []) buyers.add(await emailHash(String(r.email)));

  let sent = 0;
  // The series is for people who asked for the sample: signed up from the sample form, or
  // already signed up elsewhere and then got the sample (step 0 recorded).
  const signups = (await db.prepare('SELECT email, source FROM builder_signups WHERE unsubscribed_at IS NULL ORDER BY created_at').bind().all()).results ?? [];
  for (const r of signups) {
    if (sent >= MAX_PER_RUN) break;
    const email = String(r.email); const hash = await emailHash(email);
    if (optouts.has(hash) || buyers.has(hash)) continue; // stop on unsubscribe or purchase
    const e = byHash.get(hash) ?? { kinds: new Set<string>(), last: null };
    if (r.source !== SAMPLE_SOURCE && !e.kinds.has('seq0')) continue;
    const step = dueStep(e.kinds, e.last, now);
    if (!step) continue;
    const outcome = await sendOnce(env, email, hash, step, fetchImpl);
    if (outcome === 'CEILING') return { stop: null, sent, review_asks: 0, ceiling: true };
    if (outcome === 'SENT') { sent++; e.kinds.add(step.kind); e.last = now; byHash.set(hash, e); }
  }

  let reviewAsks = 0;
  const orders = (await db.prepare("SELECT lower(customer_email) AS email, MIN(created_at) AS first_paid FROM orders WHERE status = 'PAID' AND created_at >= ? AND created_at <= ? GROUP BY lower(customer_email)").bind(REVIEW_ASK_SINCE, sqlTime(now - REVIEW_ASK_AFTER_DAYS * DAY)).all()).results ?? [];
  for (const o of orders) {
    if (sent + reviewAsks >= MAX_PER_RUN) break;
    const email = String(o.email); const hash = await emailHash(email);
    const e = byHash.get(hash);
    if (optouts.has(hash) || e?.kinds.has('review_ask')) continue;
    if (e?.last != null && now - e.last < DAYS_BETWEEN * DAY) continue; // one email per 3 days, review ask included
    const outcome = await sendOnce(env, email, hash, REVIEW_ASK, fetchImpl);
    if (outcome === 'CEILING') return { stop: null, sent, review_asks: reviewAsks, ceiling: true };
    if (outcome === 'SENT') reviewAsks++;
  }
  return { stop: null, sent, review_asks: reviewAsks, ceiling: false };
}

/** Unsubscribe: record the opt-out by hash and mark any matching sign-up. */
export async function optOut(db: NurtureDB, hash: string) {
  await ensureTables(db);
  await db.prepare('INSERT OR IGNORE INTO email_optouts (email_hash) VALUES (?)').bind(hash).run();
}

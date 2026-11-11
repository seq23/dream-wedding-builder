// "Email me a fresh link": how a buyer gets back to what she paid for, with no account
// and no password, after the links in her order email have timed out (or on a second
// phone, or when she cannot find the email). She types the email she bought with; every
// ACTIVE purchase under that address gets the same order email again, with fresh links.
//
// What must hold (tests/unit/fresh-link.test.ts):
//  - the answer is the same sentence whether or not a purchase was found, so the form
//    never tells anyone who is a customer;
//  - a revoked or refunded purchase gets no email;
//  - one caller gets 5 asks an hour and one address 3 emails a day (lib/abuse-limits.ts),
//    so the form cannot be used to flood a buyer's inbox;
//  - it is order mail, sent through the one order-email path (lib/delivery-email.ts):
//    not marketing, so no opt-out list and no marketing ceiling apply to it.
import { EMAIL_LINK_TTL_MS, createDownloadToken } from './fulfillment';
import { productBySku } from './products';
import { sendDeliveryEmail, type DeliveryEnv } from './delivery-email';
import { DEFAULT_BASE_URL } from './delivery-retry';

export const FRESH_LINK_CHANNEL = 'email_fresh_link';
/** Said for every well-formed ask, found or not. */
export const FRESH_LINK_ANSWER = 'If that email has a purchase with us, a fresh link is on its way to it now. Give it a few minutes and look in spam. Nothing? Check the spelling, or write to info@weddingchecklistpdf.com.';

export type FreshLinkEnv = DeliveryEnv & { DOWNLOAD_SIGNING_SECRET?: string; APP_BASE_URL?: string };

// Newest first; one email per product, so a buyer who bought the same thing twice gets one.
export const ACTIVE_PURCHASES_SQL = `SELECT e.id AS entitlement_id, e.order_id AS order_id, e.sku AS sku
  FROM entitlements e JOIN orders o ON o.id = e.order_id
  WHERE e.customer_email = ? AND e.status = 'ACTIVE' AND o.payment_status = 'paid'
  ORDER BY e.created_at DESC LIMIT 10`;

/** Sends the order email again for each active purchase under this address. Returns counts only. */
export async function sendFreshLinks(env: FreshLinkEnv, email: string, now = Date.now(), fetchImpl: typeof fetch = fetch): Promise<{ sent: number; failed: number }> {
  const secret = env.DOWNLOAD_SIGNING_SECRET;
  if (!env.DB || !secret) throw new Error('DB or DOWNLOAD_SIGNING_SECRET is unavailable');
  const rows = ((await env.DB.prepare(ACTIVE_PURCHASES_SQL).bind(email).all())?.results || []) as { entitlement_id: string; order_id: string; sku: string }[];
  const base = (env.APP_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  const seen = new Set<string>();
  let sent = 0; let failed = 0;
  for (const row of rows) {
    const product = productBySku(row.sku);
    if (!product || seen.has(row.sku)) continue;
    seen.add(row.sku);
    const token = createDownloadToken(row.entitlement_id, now + EMAIL_LINK_TTL_MS, secret);
    try {
      // Records the attempt row and logs DELIVERY_EMAIL_FAILED on any failure.
      await sendDeliveryEmail(env, row.order_id, email, product.name, `${base}/api/download/${token}`, fetchImpl, FRESH_LINK_CHANNEL);
      sent++;
    } catch { failed++; }
  }
  return { sent, failed };
}

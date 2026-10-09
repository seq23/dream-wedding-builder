// The one code path that emails a buyer their download link. The Stripe webhook
// calls it, and so does any owner test send, so a test proves what a buyer gets.
//
// Incident, 2026-07-11: the only real $9 order's email was rejected by Resend
// ("domain is not verified") and the failure went only into a D1 row nobody read.
// Every outcome other than SENT now also writes a DELIVERY_EMAIL_FAILED log line
// (Workers observability) and is counted by undeliveredPaidOrders(), which the
// admin page and /api/health/delivery surface.

export const DEFAULT_FROM = 'Dream Wedding Builder <orders@mail.weddingchecklistpdf.com>';
export const DEFAULT_REPLY_TO = 'info@weddingchecklistpdf.com';

export type DeliveryEnv = {
  DB?: any;
  RESEND_API_KEY?: string;
  APP_FROM_EMAIL?: string;
  APP_REPLY_TO_EMAIL?: string;
};

export type DeliveryResult = { status: 'SENT' | 'FAILED' | 'PENDING_PROVIDER'; messageId: string | null; error: string | null };

export function emailDomain(email: string) {
  const at = email.lastIndexOf('@');
  return at >= 0 ? email.slice(at) : '(none)';
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function deliveryEmailBody(productName: string, downloadUrl: string) {
  const name = escapeHtml(productName);
  return `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h1>Your wedding planning tool is ready.</h1><p>Thank you for purchasing <strong>${name}</strong>.</p><p><a href="${escapeHtml(downloadUrl)}" style="display:inline-block;background:#27231f;color:#fff;padding:14px 22px;border-radius:999px;text-decoration:none;font-weight:700">Download ${name}</a></p><p>This secure link expires in 24 hours. You can return to your order success page to generate a fresh link.</p><p>Support: info@weddingchecklistpdf.com</p></div>`;
}

function reportFailure(orderId: string, email: string, status: string, error: string) {
  // One structured line per failure. No full address: the domain is enough to triage.
  console.error(JSON.stringify({ event: 'DELIVERY_EMAIL_FAILED', order_id: orderId, status, email_domain: emailDomain(email), error }));
}

export async function sendDeliveryEmail(
  env: DeliveryEnv,
  orderId: string,
  email: string,
  productName: string,
  downloadUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<DeliveryResult> {
  const record = (status: DeliveryResult['status'], messageId: string | null, error: string | null) =>
    env.DB!.prepare('INSERT INTO delivery_attempts (order_id, channel, status, provider_message_id, error_message) VALUES (?, ?, ?, ?, ?)')
      .bind(orderId, 'email', status, messageId, error).run();

  if (!env.RESEND_API_KEY) {
    const error = 'RESEND_API_KEY is not configured';
    await record('PENDING_PROVIDER', null, error);
    reportFailure(orderId, email, 'PENDING_PROVIDER', error);
    // Not configured is a failure for a paid order: throwing leaves the Stripe event
    // unprocessed so Stripe retries once the key exists.
    throw new Error(error);
  }

  let response: Response;
  let payload: any = {};
  try {
    response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.APP_FROM_EMAIL || DEFAULT_FROM,
        to: [email],
        reply_to: env.APP_REPLY_TO_EMAIL || DEFAULT_REPLY_TO,
        subject: `Your ${productName} is ready`,
        html: deliveryEmailBody(productName, downloadUrl)
      })
    });
    payload = await response.json().catch(() => ({}));
  } catch (cause) {
    const error = `Resend request failed: ${cause instanceof Error ? cause.message : String(cause)}`;
    await record('FAILED', null, error);
    reportFailure(orderId, email, 'FAILED', error);
    throw new Error(error);
  }

  if (!response.ok) {
    const error = payload?.message || `Resend request failed (HTTP ${response.status})`;
    await record('FAILED', null, error);
    reportFailure(orderId, email, 'FAILED', error);
    throw new Error(error);
  }
  await record('SENT', payload?.id || null, null);
  return { status: 'SENT', messageId: payload?.id || null, error: null };
}

// Paid orders with no SENT delivery attempt. Ids and email domains only.
export const UNDELIVERED_SQL = `SELECT o.id AS order_id, o.customer_email AS email, o.created_at AS created_at,
  (SELECT d.error_message FROM delivery_attempts d WHERE d.order_id = o.id ORDER BY d.id DESC LIMIT 1) AS last_error
  FROM orders o
  WHERE o.payment_status = 'paid'
    AND NOT EXISTS (SELECT 1 FROM delivery_attempts s WHERE s.order_id = o.id AND s.status = 'SENT')
  ORDER BY o.created_at`;

export type UndeliveredOrder = { order_id: string; email_domain: string; created_at: string; last_error: string | null };

export async function undeliveredPaidOrders(db: any): Promise<UndeliveredOrder[]> {
  const result = await db.prepare(UNDELIVERED_SQL).all();
  return (result?.results || []).map((r: any) => ({
    order_id: r.order_id,
    email_domain: emailDomain(String(r.email || '')),
    created_at: r.created_at,
    last_error: r.last_error ?? null
  }));
}

import { createHmac, timingSafeEqual } from 'node:crypto';
import { productBySku } from '@/lib/products';

export type StripeSession = {
  id: string;
  payment_status?: string;
  status?: string;
  amount_total?: number;
  currency?: string;
  customer_details?: { email?: string | null } | null;
  customer_email?: string | null;
  metadata?: Record<string, string> | null;
};

export function verifyStripeSignature(raw: string, header: string, secret: string, now = Date.now()) {
  const pairs = header.split(',').map(part => part.split('='));
  const timestamp = pairs.find(([key]) => key === 't')?.[1];
  const signatures = pairs.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex');
  return signatures.some(signature => {
    try {
      return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
    } catch {
      return false;
    }
  });
}

export function releaseKeyForSku(sku: string) {
  const product = productBySku(sku);
  if (!product) throw new Error(`Unknown SKU: ${sku}`);
  return `products/${product.id}/current.zip`;
}

export function createDownloadToken(entitlementId: string, expiresAt: number, secret: string) {
  const payload = `${entitlementId}.${expiresAt}`;
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return Buffer.from(`${payload}.${signature}`).toString('base64url');
}

export function verifyDownloadToken(token: string, secret: string, now = Date.now()) {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [entitlementId, expiresRaw, signature] = decoded.split('.');
    const expiresAt = Number(expiresRaw);
    if (!entitlementId || !signature || !Number.isFinite(expiresAt) || expiresAt <= now) return null;
    const expected = createHmac('sha256', secret).update(`${entitlementId}.${expiresAt}`).digest('base64url');
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    return { entitlementId, expiresAt };
  } catch {
    return null;
  }
}

export function safeEmail(value?: string | null) {
  const email = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

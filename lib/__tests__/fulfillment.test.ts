import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createDownloadToken, releaseKeyForSku, verifyDownloadToken, verifyStripeSignature } from '@/lib/fulfillment';

describe('fulfillment security', () => {
  it('verifies a Stripe signature and rejects a changed payload', () => {
    const raw = JSON.stringify({ id: 'evt_test', type: 'checkout.session.completed' });
    const secret = 'whsec_test_secret';
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex');
    const header = `t=${timestamp},v1=${signature}`;
    expect(verifyStripeSignature(raw, header, secret)).toBe(true);
    expect(verifyStripeSignature(`${raw}x`, header, secret)).toBe(false);
  });

  it('creates expiring download tokens that fail after expiry', () => {
    const secret = 'download-secret';
    const expires = Date.now() + 60_000;
    const token = createDownloadToken('ent_123', expires, secret);
    expect(verifyDownloadToken(token, secret)?.entitlementId).toBe('ent_123');
    expect(verifyDownloadToken(token, secret, expires + 1)).toBeNull();
    expect(verifyDownloadToken(token, 'wrong-secret')).toBeNull();
  });

  it('maps governed SKUs to private R2 release keys', () => {
    expect(releaseKeyForSku('DWB-CHECKLIST-001')).toBe('products/checklist-pdf/current.zip');
    expect(releaseKeyForSku('DWB-SUITE-001')).toBe('products/operations-suite/current.zip');
  });
});

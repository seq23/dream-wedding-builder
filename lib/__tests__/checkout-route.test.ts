import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/checkout/route';
import { products, suite } from '@/lib/products';

const originalEnv = { ...process.env };
const originalFetch = global.fetch;

function applyCheckoutEnv() {
  process.env.APP_BASE_URL = 'https://weddingchecklistpdf.com';
  process.env.STRIPE_MODE = 'test';
  process.env.STRIPE_SECRET_KEY = 'sk_test_checkout_contract_only';
  process.env.STRIPE_SEATING_CHART_MAKER_PRICE_ID = 'price_test_seating';
  process.env.STRIPE_BUDGET_SPREADSHEET_PRICE_ID = 'price_test_budget';
  process.env.STRIPE_TIMELINE_TEMPLATE_PRICE_ID = 'price_test_timeline';
  process.env.STRIPE_CHECKLIST_PDF_PRICE_ID = 'price_test_checklist';
  process.env.STRIPE_OPERATIONS_SUITE_PRICE_ID = 'price_test_suite';
}

function jsonRequest(sku: string) {
  return new NextRequest('https://weddingchecklistpdf.com/api/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sku })
  });
}

beforeEach(() => {
  process.env = { ...originalEnv };
  applyCheckoutEnv();
  global.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const params = new URLSearchParams(String(init?.body ?? ''));
    const productId = params.get('metadata[product_id]') ?? 'unknown';
    return new Response(JSON.stringify({ id: `cs_test_${productId}`, url: `https://checkout.stripe.test/session/${productId}` }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }) as typeof fetch;
});

afterEach(() => {
  process.env = { ...originalEnv };
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('checkout environment contract', () => {
  it('creates a Stripe Checkout request for every governed SKU using its exact price env variable', async () => {
    const governed = [...products, suite];
    for (const product of governed) {
      const response = await POST(jsonRequest(product.sku));
      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe(`https://checkout.stripe.test/session/${product.id}`);
    }

    expect(global.fetch).toHaveBeenCalledTimes(governed.length);
    const expectedPrices: Record<string, string> = {
      'seating-chart-maker': 'price_test_seating',
      'budget-spreadsheet': 'price_test_budget',
      'timeline-template': 'price_test_timeline',
      'checklist-pdf': 'price_test_checklist',
      'operations-suite': 'price_test_suite'
    };

    for (const call of vi.mocked(global.fetch).mock.calls) {
      const [url, init] = call;
      expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer sk_test_checkout_contract_only',
        'Content-Type': 'application/x-www-form-urlencoded'
      });
      const params = new URLSearchParams(String(init?.body ?? ''));
      const productId = params.get('metadata[product_id]')!;
      expect(params.get('line_items[0][price]')).toBe(expectedPrices[productId]);
      expect(params.get('line_items[0][quantity]')).toBe('1');
      expect(params.get('mode')).toBe('payment');
      expect(params.get('success_url')).toBe('https://weddingchecklistpdf.com/order/success?session_id={CHECKOUT_SESSION_ID}');
      expect(params.get('cancel_url')).toContain('https://weddingchecklistpdf.com/');
      expect(params.get('metadata[stripe_mode]')).toBe('test');
    }
  });

  it('accepts the browser form-encoded checkout contract', async () => {
    const form = new URLSearchParams({ sku: 'DWB-CHECKLIST-001' });
    const request = new NextRequest('https://weddingchecklistpdf.com/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form
    });
    const response = await POST(request);
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('/checklist-pdf');
  });

  it('fails closed when required checkout environment variables are missing or mismatched', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect((await POST(jsonRequest('DWB-CHECKLIST-001'))).status).toBe(503);

    process.env.STRIPE_SECRET_KEY = 'sk_live_wrong_for_test_mode';
    expect((await POST(jsonRequest('DWB-CHECKLIST-001'))).status).toBe(500);

    process.env.STRIPE_SECRET_KEY = 'sk_test_checkout_contract_only';
    process.env.STRIPE_MODE = 'staging';
    expect((await POST(jsonRequest('DWB-CHECKLIST-001'))).status).toBe(500);

    process.env.STRIPE_MODE = 'test';
    process.env.STRIPE_CHECKLIST_PDF_PRICE_ID = 'not-a-stripe-price';
    expect((await POST(jsonRequest('DWB-CHECKLIST-001'))).status).toBe(500);

    delete process.env.STRIPE_CHECKLIST_PDF_PRICE_ID;
    expect((await POST(jsonRequest('DWB-CHECKLIST-001'))).status).toBe(503);
  });

  it('rejects unknown SKUs before contacting Stripe', async () => {
    const response = await POST(jsonRequest('UNKNOWN-SKU'));
    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

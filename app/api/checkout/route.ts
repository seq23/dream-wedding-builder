import { NextRequest, NextResponse } from 'next/server';
import { productBySku } from '@/lib/products';
import { buildCheckoutContract, isCheckoutContractFailure } from '@/lib/checkout-contract';

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  let sku = '';
  if (contentType.includes('application/json')) {
    sku = String((await request.json()).sku || '');
  } else {
    sku = String((await request.formData()).get('sku') || '');
  }

  const product = productBySku(sku);
  if (!product) return NextResponse.json({ error: 'Unknown SKU' }, { status: 400 });

  const contract = buildCheckoutContract(product, process.env, request.nextUrl.origin);
  if (isCheckoutContractFailure(contract)) {
    return NextResponse.json({ error: contract.error }, { status: contract.status });
  }

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${contract.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: contract.params
  });
  const payload = await response.json();

  if (!response.ok || !payload.url) {
    return NextResponse.json(
      { error: 'Stripe checkout creation failed', details: payload?.error?.message || 'unknown' },
      { status: 502 }
    );
  }
  return NextResponse.redirect(payload.url, 303);
}

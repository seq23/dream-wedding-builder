import { NextRequest, NextResponse } from 'next/server';
import { productBySku } from '@/lib/products';
export async function POST(request: NextRequest){
  const contentType=request.headers.get('content-type')||''; let sku='';
  if(contentType.includes('application/json')) sku=String((await request.json()).sku||''); else sku=String((await request.formData()).get('sku')||'');
  const product=productBySku(sku); if(!product) return NextResponse.json({error:'Unknown SKU'},{status:400});
  const key=process.env.STRIPE_SECRET_KEY; const mode=process.env.STRIPE_MODE;
  if(!key || !mode) return NextResponse.json({error:'Checkout is not configured. Required: STRIPE_MODE and STRIPE_SECRET_KEY.'},{status:503});
  if(mode==='test' && !key.startsWith('sk_test_')) return NextResponse.json({error:'Stripe mode/key mismatch'},{status:500});
  if(mode==='live' && !key.startsWith('sk_live_')) return NextResponse.json({error:'Stripe mode/key mismatch'},{status:500});
  const envKey=`STRIPE_${product.id.replaceAll('-','_').toUpperCase()}_PRICE_ID`; const price=process.env[envKey];
  if(!price) return NextResponse.json({error:`Missing ${envKey}`},{status:503});
  const base=process.env.APP_BASE_URL||request.nextUrl.origin; const params=new URLSearchParams();
  params.set('mode','payment'); params.set('success_url',`${base}/order/success?session_id={CHECKOUT_SESSION_ID}`); params.set('cancel_url',`${base}${product.route}`); params.set('line_items[0][price]',price); params.set('line_items[0][quantity]','1'); params.set('metadata[sku]',product.sku); params.set('metadata[product_id]',product.id); params.set('metadata[stripe_mode]',mode); params.set('customer_creation','always');
  const response=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/x-www-form-urlencoded'},body:params}); const payload=await response.json();
  if(!response.ok || !payload.url) return NextResponse.json({error:'Stripe checkout creation failed',details:payload?.error?.message||'unknown'},{status:502});
  return NextResponse.redirect(payload.url,303);
}

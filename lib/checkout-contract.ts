export type CheckoutProduct = {
  id: string;
  sku: string;
  route: string;
};

export type CheckoutEnvironment = Record<string, string | undefined>;

export type CheckoutContract = {
  mode: 'test' | 'live';
  secretKey: string;
  priceId: string;
  priceEnvKey: string;
  params: URLSearchParams;
};

export type CheckoutContractFailure = {
  status: 500 | 503;
  error: string;
};

function normalizedBaseUrl(raw: string) {
  return raw.replace(/\/+$/, '');
}

export function priceEnvKeyForProduct(productId: string) {
  return `STRIPE_${productId.replaceAll('-', '_').toUpperCase()}_PRICE_ID`;
}

export function buildCheckoutContract(
  product: CheckoutProduct,
  env: CheckoutEnvironment,
  requestOrigin: string
): CheckoutContract | CheckoutContractFailure {
  const mode = env.STRIPE_MODE;
  const secretKey = env.STRIPE_SECRET_KEY;

  if (!mode || !secretKey) {
    return { status: 503, error: 'Checkout is not configured. Required: STRIPE_MODE and STRIPE_SECRET_KEY.' };
  }
  if (mode !== 'test' && mode !== 'live') {
    return { status: 500, error: 'STRIPE_MODE must be test or live.' };
  }
  if (mode === 'test' && !secretKey.startsWith('sk_test_')) {
    return { status: 500, error: 'Stripe mode/key mismatch' };
  }
  if (mode === 'live' && !secretKey.startsWith('sk_live_')) {
    return { status: 500, error: 'Stripe mode/key mismatch' };
  }

  const priceEnvKey = priceEnvKeyForProduct(product.id);
  const priceId = env[priceEnvKey];
  if (!priceId) {
    return { status: 503, error: `Missing ${priceEnvKey}` };
  }
  if (!priceId.startsWith('price_')) {
    return { status: 500, error: `${priceEnvKey} must be a Stripe price ID.` };
  }

  const base = normalizedBaseUrl(env.APP_BASE_URL || requestOrigin);
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', `${base}/order/success?session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${base}${product.route}`);
  params.set('line_items[0][price]', priceId);
  params.set('line_items[0][quantity]', '1');
  params.set('metadata[sku]', product.sku);
  params.set('metadata[product_id]', product.id);
  params.set('metadata[stripe_mode]', mode);
  params.set('customer_creation', 'always');

  return { mode, secretKey, priceId, priceEnvKey, params };
}

export function isCheckoutContractFailure(
  result: CheckoutContract | CheckoutContractFailure
): result is CheckoutContractFailure {
  return 'error' in result;
}

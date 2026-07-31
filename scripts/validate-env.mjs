import fs from 'node:fs';

const examples = ['.env.example', '.dev.vars.example'];
const required = [
  'APP_BASE_URL',
  'STRIPE_MODE',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_SEATING_CHART_MAKER_PRICE_ID',
  'STRIPE_BUDGET_SPREADSHEET_PRICE_ID',
  'STRIPE_TIMELINE_TEMPLATE_PRICE_ID',
  'STRIPE_CHECKLIST_PDF_PRICE_ID',
  'STRIPE_OPERATIONS_SUITE_PRICE_ID',
  'DOWNLOAD_SIGNING_SECRET',
  'APPS_SCRIPT_TREND_ENDPOINT',
  'APPS_SCRIPT_TREND_SECRET'
];

for (const file of examples) {
  const env = fs.readFileSync(file, 'utf8');
  for (const key of required) {
    if (!new RegExp(`^${key}=`, 'm').test(env)) {
      console.error(`Missing ${key} in ${file}`);
      process.exit(1);
    }
  }
}

const checkout = fs.readFileSync('app/api/checkout/route.ts', 'utf8') + fs.readFileSync('lib/checkout-contract.ts', 'utf8');
for (const token of ['STRIPE_SECRET_KEY', 'STRIPE_MODE', '_PRICE_ID', 'success_url', 'cancel_url']) {
  if (!checkout.includes(token)) {
    console.error(`Checkout route is missing environment/contract token: ${token}`);
    process.exit(1);
  }
}

const trendApi = fs.readFileSync('app/api/submit-trend/route.ts', 'utf8');
if (!trendApi.includes('APPS_SCRIPT_TREND_ENDPOINT')) {
  console.error('Trend API does not reference Apps Script endpoint contract');
  process.exit(1);
}

console.log('env and checkout contract validation passed');

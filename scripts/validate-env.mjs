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
  'STRIPE_COURTHOUSE_WEDDING_KIT_PRICE_ID',
  'STRIPE_WEDDING_VOWS_WORKBOOK_PRICE_ID',
  'STRIPE_MAID_OF_HONOR_KIT_PRICE_ID',
  'DOWNLOAD_SIGNING_SECRET'
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
// The idea form keeps ONE path: the site's own D1 (lib/trend-ideas.ts). The Apps Script forward it
// replaced was never configured and answered "received" while keeping nothing (27 Nov 2026).
if (!trendApi.includes('saveIdea(') || trendApi.includes('APPS_SCRIPT_TREND')) {
  console.error('Trend API must save each idea with saveIdea() and must not forward to Apps Script');
  process.exit(1);
}

console.log('env and checkout contract validation passed');

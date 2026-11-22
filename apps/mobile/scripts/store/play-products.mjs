// Dream Wedding's Google Play one-time products, built from the app's own code: the product list is the
// RevenueCat catalog (scripts/revenuecat/setup.ts, from src/billing/offers.ts), the USD prices are
// PRODUCTS[id].priceUsd, the titles are the buy screen's names (OFFER_NAME) and the descriptions are the
// approved App Store in-app purchase texts (store/paid-files.json storeText) or, where none exists, the
// buy screen's own line (OFFER_DETAIL). How it decides and what it never does: play-engine.mjs.
// Dry run (reads Play, changes nothing):
//   cd ~/GitHub/boss-os && npm run -s vault:run -- npx --prefix ~/GitHub/dream-wedding-builder/apps/mobile tsx ~/GitHub/dream-wedding-builder/apps/mobile/scripts/store/play-products.mjs
// Add --apply to create and activate what is missing. Docs: store/google-play.md.
// Play has no consumable flag: RevenueCat holds dw_new_event as a consumable (setup.ts) and consumes each purchase.
import { fileURLToPath } from 'node:url';
import { catalog as revenuecat } from '../revenuecat/setup.ts';
import { PRODUCTS, OFFER_NAME, OFFER_DETAIL } from '../../src/billing/offers.ts';
import paidFiles from '../../store/paid-files.json' with { type: 'json' };
// @ts-ignore shared site module is JavaScript
import { gscToken } from '../../../../scripts/search_intelligence/lib.mjs';
import { run } from './play-engine.mjs';

export const catalog = {
  app: 'Dream Wedding', packageName: revenuecat.bundleId,
  products: revenuecat.products.map(p => ({
    id: p.id, title: OFFER_NAME[p.id], priceUsd: PRODUCTS[p.id]?.priceUsd ?? null,
    description: paidFiles.storeText[p.id]?.[0] ?? OFFER_DETAIL[p.id],
  })),
};

async function getToken() {
  const raw = process.env.GOOGLE_PLAY_UPLOAD_SA_JSON;
  if (!raw) return '';
  return gscToken(JSON.parse(raw), 'https://www.googleapis.com/auth/androidpublisher');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) run(catalog, { getToken }).then(code => { process.exitCode = code; });

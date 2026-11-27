// Dream Wedding's Google Play one-time products, as a catalog for the shared tool in seq-bin
// (~/bin/play-products, which creates, activates and reads back; how it decides and what it never does
// is in its header). Built from the app's own code: the product list is the RevenueCat catalog
// (scripts/revenuecat/setup.ts, from src/billing/offers.ts), the USD prices are PRODUCTS[id].priceUsd,
// the titles are the buy screen's names (OFFER_NAME), the descriptions are the Play lines in
// store/in-app-products.json (held to the app and to Play's limits by test/storeFiles.unit.ts), and the
// launch price is a Play discount offer from LAUNCH_OFFER.
// Dry run, then --apply (docs: store/google-play.md):
//   cd ~/GitHub/boss-os && npm run -s vault:run -- ~/bin/play-products ~/GitHub/dream-wedding-builder/apps/mobile/scripts/store/play-products.mjs
import { catalog as revenuecat } from '../revenuecat/setup.ts';
import { PRODUCTS, OFFER_NAME, LAUNCH_OFFER } from '../../src/billing/offers.ts';
import inAppProducts from '../../store/in-app-products.json' with { type: 'json' };

const DAY = 86_400_000;
/** The launch offer as the tool reads it: no start date yet means it waits and nothing is created. */
export function launchOffer(o = LAUNCH_OFFER) {
  const start = o.startTime ? new Date(o.startTime) : null;
  return { id: o.id, priceUsd: o.priceUsd, startTime: start?.toISOString() ?? null, endTime: start ? new Date(start.getTime() + o.days * DAY).toISOString() : null };
}

export const catalog = {
  app: 'Dream Wedding', packageName: revenuecat.bundleId,
  // The tool's order guard: no Play write until RevenueCat holds every product here with its code type.
  revenuecat,
  products: revenuecat.products.map(p => ({
    id: p.id, title: OFFER_NAME[p.id], priceUsd: PRODUCTS[p.id]?.priceUsd ?? null,
    description: inAppProducts.products[p.id]?.play ?? null,
    ...(p.id === LAUNCH_OFFER.product ? { offers: [launchOffer()] } : {}),
  })),
};

// Dream Wedding's RevenueCat setup, built from the app's own product code (src/billing/offers.ts and
// the screens' offering names), so the dashboard can never drift from what the app sells.
// How to run and what each flag does: engine.mjs. Remaining store-side steps: docs/APP_PLAN.md task 8.
import release from '../../release/config.json';
import { PRODUCTS, type Entitlement, type ProductId } from '../../src/billing/offers';
// @ts-ignore plain JavaScript module
import { run } from './engine.mjs';

const NAMES: Record<ProductId, string> = {
  dw_full_plan: 'Full plan', dw_planner_printables: 'Planner + Printables', dw_printables_topup: 'Printables top-up',
  dw_day_of_kit: 'Day-of kit', dw_new_event: 'New event',
};
const ids = Object.keys(PRODUCTS) as ProductId[];
const products = ids.map(id => ({ id, kind: id === 'dw_new_event' ? 'consumable' : 'non_consumable', name: `${NAMES[id]} $${PRODUCTS[id].priceUsd.toFixed(2)}` }));
const ENTITLEMENT_NAMES: Record<Entitlement, string> = { full_plan: 'Full plan', printables: 'Printables', day_of_kit: 'Day-of kit' };

export const catalog = {
  app: 'Dream Wedding', projectName: 'Dream Wedding', vaultPrefix: 'DW', secretEnv: 'REVENUECAT_DW_V2_SECRET_KEY',
  // release/config.json holds a ".placeholder" id until the company store accounts exist; RevenueCat gets
  // the id without it, and the script is re-run if the real id differs.
  bundleId: release.bundleId.replace(/\.placeholder$/, ''),
  products,
  // src/billing/revenuecat.ts reads entitlements.active['full_plan' | 'printables' | 'day_of_kit'].
  entitlements: (Object.keys(ENTITLEMENT_NAMES) as Entitlement[]).map(key => ({ key, name: ENTITLEMENT_NAMES[key], products: ids.filter(id => PRODUCTS[id].grants.includes(key)) })),
  // The offerings the screens ask for (full-plan.tsx, useFullPlanPrice.ts), packages in offersFor order.
  offerings: [
    { key: 'default', name: 'First purchase', current: true, packages: ['dw_planner_printables', 'dw_full_plan'] },
    { key: 'after_unlock', name: 'Full plan owners', packages: ['dw_printables_topup', 'dw_day_of_kit'] },
    { key: 'new_event', name: 'New event', packages: ['dw_new_event'] },
  ],
};

if (process.argv[1]?.endsWith('setup.ts')) run(catalog).then(code => { process.exitCode = code; });

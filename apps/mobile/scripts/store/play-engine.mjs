// Creates and activates one app's Google Play one-time products from a catalog built from the app's
// own code (scripts/store/play-products.mjs). The same file sits in every app repo that sells on Play.
// Google retired the inappproducts API for these apps ("Please migrate to the new publishing API", 403),
// so this uses monetization.onetimeproducts: one "buy" purchase option per product, legacy compatible,
// USD price from the code and Google's own conversion for every other region.
// Safe to run twice: it only creates what is missing and activates what is not active. It never
// deletes, deactivates or reprices anything; a price on Play that differs from the code is a mismatch
// line, and that product is left exactly as it is.
// Dry run by default (reads Play, prints the plan); --apply writes, then reads everything back.
// Exit: 0 = Play matches the code, 1 = an API failure or a mismatch, 2 = a NAMED STOP (no key, a product
// with no price in the code). Prints one OUTPUT line.
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
export const OPTION_ID = 'buy';

/** Dollars to Google's Money ({ units, nanos }), exact to the cent. */
export function money(usd, currencyCode = 'USD') {
  const c = Math.round(usd * 100);
  return { currencyCode, units: String(Math.floor(c / 100)), nanos: (c % 100) * 10_000_000 };
}
const centsOf = m => m ? Number(m.units ?? 0) * 100 + Math.round((m.nanos ?? 0) / 10_000_000) : null;
const usd = c => `$${(c / 100).toFixed(2)}`;

/** The product's US price in cents and its buy option's state, as Play holds them. */
export function liveShape(p) {
  const o = (p.purchaseOptions ?? []).find(x => x.purchaseOptionId === OPTION_ID) ?? (p.purchaseOptions ?? [])[0];
  const us = o?.regionalPricingAndAvailabilityConfigs?.find(r => r.regionCode === 'US');
  return { optionId: o?.purchaseOptionId ?? null, state: o?.state ?? null, usCents: us && us.price?.currencyCode === 'USD' ? centsOf(us.price) : null,
    title: p.listings?.[0]?.title ?? null };
}

/** Why a catalog product cannot be sent to Play, or null. */
export function productStop(p) {
  if (!(Number.isFinite(p.priceUsd) && p.priceUsd > 0)) return `NAMED STOP [PRICE_MISSING] ${p.id}: no price for it in the app code, so it is not created`;
  if (!p.title || p.title.length > 55) return `NAMED STOP [TITLE_INVALID] ${p.id}: title must be 1-55 characters (${p.title?.length ?? 0})`;
  if (!p.description || p.description.length > 200) return `NAMED STOP [DESCRIPTION_INVALID] ${p.id}: description must be 1-200 characters (${p.description?.length ?? 0})`;
  if (!/^[a-z0-9][a-z0-9_.]*$/.test(p.id)) return `NAMED STOP [ID_INVALID] ${p.id}`;
  return null;
}

/** What --apply would do, from the catalog and Play's current list. Pure, so tests hold it. */
export function plan(catalog, liveProducts) {
  const live = new Map(liveProducts.map(p => [p.productId, p]));
  const out = { create: [], activate: [], ok: [], mismatches: [], stops: [], extra: [] };
  for (const p of catalog.products) {
    const stop = productStop(p);
    if (stop) { out.stops.push(stop); continue; }
    const l = live.get(p.id);
    if (!l) { out.create.push(p); continue; }
    const s = liveShape(l);
    const want = Math.round(p.priceUsd * 100);
    if (s.usCents !== want) { out.mismatches.push(`MISMATCH ${p.id}: Play US price ${s.usCents == null ? 'none' : usd(s.usCents)}, code ${usd(want)}; left as it is (never repriced here)`); continue; }
    if (s.state !== 'ACTIVE') out.activate.push({ ...p, optionId: s.optionId });
    else out.ok.push(p);
  }
  const ids = new Set(catalog.products.map(p => p.id));
  for (const l of liveProducts) if (!ids.has(l.productId)) out.extra.push(l.productId);
  return out;
}

/** The new product, priced in every region from Google's conversion of the USD price; US is the code's price exactly. */
export function productBody(packageName, p, conv) {
  const regions = Object.values(conv.convertedRegionPrices ?? {}).map(r => ({ regionCode: r.regionCode, price: r.price, availability: 'AVAILABLE' }));
  const us = regions.find(r => r.regionCode === 'US');
  if (us) us.price = money(p.priceUsd); else regions.push({ regionCode: 'US', price: money(p.priceUsd), availability: 'AVAILABLE' });
  const other = conv.convertedOtherRegionsPrice ?? {};
  return {
    packageName, productId: p.id,
    listings: [{ languageCode: p.languageCode ?? 'en-US', title: p.title, description: p.description }],
    purchaseOptions: [{
      purchaseOptionId: OPTION_ID,
      buyOption: { legacyCompatible: true, multiQuantityEnabled: false },
      regionalPricingAndAvailabilityConfigs: regions,
      ...(other.usdPrice && other.eurPrice ? { newRegionsConfig: { usdPrice: other.usdPrice, eurPrice: other.eurPrice, availability: 'AVAILABLE' } } : {}),
    }],
  };
}

function printPlan(c, pl, log) {
  for (const s of pl.stops) log(s);
  for (const m of pl.mismatches) log(m);
  for (const p of pl.create) log(`create ${p.id} "${p.title}" ${usd(Math.round(p.priceUsd * 100))} and activate`);
  for (const p of pl.activate) log(`activate ${p.id} (exists, not active)`);
  for (const p of pl.ok) log(`ok ${p.id} active at ${usd(Math.round(p.priceUsd * 100))}`);
  for (const id of pl.extra) log(`on Play, not in the app code: ${id} (left alone)`);
}

/**
 * c = { app, packageName, products: [{ id, title, description, priceUsd }] }.
 * getToken() returns a Play access token or '' (never printed). fetchFn is injectable for tests.
 * @param {{ app: string, packageName: string, products: { id: string, title: string, description: string, priceUsd: number | null }[] }} c
 * @param {{ argv?: string[], getToken: () => Promise<string>, fetchFn?: (url: string, init: any) => Promise<any>, log?: (line: string) => void }} opts
 */
export async function run(c, { argv = process.argv.slice(2), getToken, fetchFn = fetch, log = console.log }) {
  const apply = argv.includes('--apply');
  const tag = `OUTPUT play-products ${c.app}`;
  if (!c.products.length) { log(`${tag}: NAMED STOP [NO_PRODUCTS_IN_SOURCE] the app code lists no products`); return 1; }
  let token = '';
  try { token = await getToken(); } catch (e) { log(`${tag}: FAILED PLAY_TOKEN ${String(e?.message ?? e).slice(0, 300)}`); return 1; }
  if (!token) { log(`${tag}: NAMED STOP [PLAY_KEY_MISSING] no Play access token (GOOGLE_PLAY_UPLOAD_SA_JSON from the Boss OS vault)`); return 2; }
  const failures = [];
  let denied = false; // a 401/403 stops every further write: one clear failure, never 14 copies of it
  const call = async (method, path, body) => {
    const r = await fetchFn(`${API}/${c.packageName}${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const text = r.status === 204 ? '' : await r.text();
    if (r.status === 401 || r.status === 403) denied = true;
    if (!r.ok) { failures.push(`FAILED PLAY_API_${r.status} ${method} ${path.split('?')[0]}: ${text.slice(0, 800)}`); return null; }
    return text ? JSON.parse(text) : {};
  };
  const listLive = async () => {
    const all = [];
    let pageToken = '';
    do {
      const j = await call('GET', `/oneTimeProducts?pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`);
      if (!j) return null;
      all.push(...(j.oneTimeProducts ?? []));
      pageToken = j.nextPageToken ?? '';
    } while (pageToken);
    return all;
  };
  const finish = (summary, code) => {
    for (const f of failures) log(f);
    const why = denied ? 'NAMED STOP [PLAY_PERMISSION_DENIED] Play refused the service account (Play Console > Users and permissions: "Manage store presence" on this app; a new grant can take up to 36 hours to reach the API); ' : '';
    log(`${tag}: ${why}${summary}`);
    return failures.length ? 1 : code;
  };

  const before = await listLive();
  if (!before) return finish('could not read Play; nothing changed', 1);
  const pl = plan(c, before);
  printPlan(c, pl, log);
  const bad = pl.stops.length ? 2 : pl.mismatches.length ? 1 : 0;
  const counts = p => `${p.create.length} to create, ${p.activate.length} to activate, ${p.ok.length} already active, ${p.mismatches.length} mismatches, ${p.stops.length} named stops`;
  if (!apply) return finish(`dry run on ${c.packageName}: ${counts(pl)} (--apply writes)`, bad);

  const conversions = new Map();
  const convert = async priceUsd => {
    const k = Math.round(priceUsd * 100);
    if (!conversions.has(k)) conversions.set(k, await call('POST', '/pricing:convertRegionPrices', { price: money(priceUsd) }));
    return conversions.get(k);
  };
  const activate = (id, optionId) => call('POST', `/oneTimeProducts/${id}/purchaseOptions:batchUpdateStates`,
    { requests: [{ activatePurchaseOptionRequest: { packageName: c.packageName, productId: id, purchaseOptionId: optionId ?? OPTION_ID } }] });
  let created = 0, activated = 0;
  for (const p of pl.create) {
    if (denied) break;
    const conv = await convert(p.priceUsd);
    if (!conv?.regionVersion?.version) { if (conv) failures.push(`FAILED ${p.id}: price conversion gave no region version`); continue; }
    const q = `allowMissing=true&regionsVersion.version=${encodeURIComponent(conv.regionVersion.version)}&updateMask=listings,purchaseOptions`;
    if (!(await call('PATCH', `/onetimeproducts/${p.id}?${q}`, productBody(c.packageName, p, conv)))) continue;
    created++;
    if (await activate(p.id)) activated++;
  }
  for (const p of pl.activate) if (!denied && await activate(p.id, p.optionId)) activated++;

  // Read back: every product Play now holds for the code, and a second plan that must be empty.
  const after = await listLive();
  if (!after) return finish(`created ${created}, activated ${activated}; read-back failed`, 1);
  const byId = new Map(after.map(p => [p.productId, liveShape(p)]));
  for (const p of c.products) {
    const s = byId.get(p.id);
    log(s ? `read-back ${p.id}: ${s.state} ${s.usCents == null ? 'no US price' : usd(s.usCents)} "${s.title}"` : `read-back ${p.id}: NOT ON PLAY`);
  }
  const again = plan(c, after);
  const left = again.create.length + again.activate.length;
  if (left) failures.push(`FAILED READBACK_NOT_CLEAN: ${counts(again)}`);
  const activeCount = c.products.filter(p => byId.get(p.id)?.state === 'ACTIVE').length;
  return finish(`applied on ${c.packageName}: created ${created}, activated ${activated}; read-back ${activeCount}/${c.products.length} active, ${again.mismatches.length} mismatches, ${again.stops.length} named stops`,
    again.stops.length ? 2 : again.mismatches.length ? 1 : 0);
}

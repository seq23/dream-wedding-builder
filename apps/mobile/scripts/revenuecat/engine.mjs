// Creates or checks one app's RevenueCat setup from a catalog built from the app's own code.
// Idempotent: anything that already exists is reused. Run from the app's catalog script with the
// project's v2 secret key injected by the Boss OS vault (never on a command line, never in git):
//   cd ~/GitHub/boss-os && npm run -s vault:run -- npx --prefix <repo>/apps/mobile tsx <repo>/apps/mobile/scripts/revenuecat/setup.ts
// Flags: --dry-run prints the plan without calling RevenueCat; --save-keys pipes each public SDK key
// into the vault as REVENUECAT_<APP>_{IOS,ANDROID,TEST}_PUBLIC_KEY (values are never printed).
// Prints one OUTPUT line. Exit 2 = NAMED STOP (no key), 1 = something failed, 0 = all present.
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';

const API = 'https://api.revenuecat.com/v2';
const STORE_SLOT = { app_store: 'IOS', play_store: 'ANDROID', test_store: 'TEST' };

/** Product type for each store: App Store and Test Store know (non_)consumable, Play calls a one-time product one_time. */
export function storeType(appType, kind) {
  if (appType === 'play_store') return kind === 'consumable' ? 'consumable' : 'one_time';
  return kind;
}

/** Every object the catalog needs, as plain lines (also the --dry-run output). */
export function plan(c) {
  const lines = [`apps: app_store ${c.bundleId}, play_store ${c.bundleId}, test_store`];
  for (const p of c.products) lines.push(`product ${p.id} (${p.kind}) on app_store, play_store, test_store`);
  for (const e of c.entitlements) lines.push(`entitlement ${e.key} <- ${e.products.join(', ')}`);
  for (const o of c.offerings) lines.push(`offering ${o.key}${o.current ? ' (current)' : ''}: ${o.packages.join(' > ')}`);
  return lines;
}

/** What is missing or wrong in RevenueCat, compared with the catalog. Empty = matches the code. */
export function diff(c, live) {
  const out = [];
  for (const t of ['app_store', 'play_store', 'test_store']) if (!live.apps.some(a => a.type === t)) out.push(`app ${t} missing`);
  for (const a of live.apps.filter(a => a.type !== 'test_store' && STORE_SLOT[a.type])) {
    const id = a.app_store?.bundle_id ?? a.play_store?.package_name;
    if (id !== c.bundleId) out.push(`app ${a.type} bundle ${id} != ${c.bundleId}`);
  }
  for (const p of c.products) for (const a of live.apps.filter(a => STORE_SLOT[a.type]))
    if (!live.products.some(x => x.app_id === a.id && x.store_identifier === p.id)) out.push(`product ${p.id} missing on ${a.type}`);
  for (const e of c.entitlements) {
    const have = live.entitlementProducts[e.key];
    if (!have) { out.push(`entitlement ${e.key} missing`); continue; }
    for (const id of e.products) if (!have.includes(id)) out.push(`entitlement ${e.key} lacks ${id}`);
  }
  for (const o of c.offerings) {
    const pk = live.offeringPackages[o.key];
    if (!pk) { out.push(`offering ${o.key} missing`); continue; }
    if (o.current && !live.currentOffering?.includes(o.key)) out.push(`offering ${o.key} is not current`);
    o.packages.forEach((id, i) => {
      const p = pk.find(x => x.key === id);
      if (!p) out.push(`offering ${o.key} package ${id} missing`);
      else if (p.position !== i + 1) out.push(`offering ${o.key} package ${id} at ${p.position}, want ${i + 1}`);
      else if (!p.products.includes(id)) out.push(`offering ${o.key} package ${id} has no ${id} product`);
    });
  }
  return out;
}

export async function run(c, argv = process.argv.slice(2)) {
  if (argv.includes('--dry-run')) { for (const l of plan(c)) console.log(l); console.log(`OUTPUT revenuecat-setup ${c.app}: dry run, ${c.products.length} products`); return 0; }
  const key = process.env[c.secretEnv];
  if (!key) { console.log(`OUTPUT revenuecat-setup ${c.app}: NAMED STOP [REVENUECAT_SECRET_MISSING] ${c.secretEnv} is not in the vault`); return 2; }
  const errors = [];
  const call = async (method, path, body) => {
    for (let attempt = 0; ; attempt++) {
      const r = await fetch(API + path, { method, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      if (r.status === 429 && attempt < 5) { await new Promise(res => setTimeout(res, 1000 * (attempt + 1))); continue; }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { errors.push(`${method} ${path}: ${r.status} ${j.message ?? ''}`.trim()); return null; }
      return j;
    }
  };
  const list = async path => (await call('GET', `${path}${path.includes('?') ? '&' : '?'}limit=100`))?.items ?? [];
  const projects = await list('/projects');
  if (projects.length !== 1) { console.log(`OUTPUT revenuecat-setup ${c.app}: NAMED STOP [REVENUECAT_PROJECT_UNCLEAR] key sees ${projects.length} projects`); return 2; }
  const P = `/projects/${projects[0].id}`;
  if (c.projectName && projects[0].name !== c.projectName) { console.log(`OUTPUT revenuecat-setup ${c.app}: NAMED STOP [REVENUECAT_WRONG_PROJECT] key opens "${projects[0].name}", want "${c.projectName}"`); return 2; }

  // Apps
  let apps = await list(`${P}/apps`);
  const wantApps = [
    { type: 'app_store', name: `${c.app} (iOS)`, app_store: { bundle_id: c.bundleId } },
    { type: 'play_store', name: `${c.app} (Android)`, play_store: { package_name: c.bundleId } },
  ];
  for (const w of wantApps) if (!apps.some(a => a.type === w.type)) await call('POST', `${P}/apps`, w);
  apps = (await list(`${P}/apps`)).filter(a => STORE_SLOT[a.type]);

  // Products, one per store app
  let products = await list(`${P}/products`);
  for (const p of c.products) for (const a of apps) {
    if (products.some(x => x.app_id === a.id && x.store_identifier === p.id)) continue;
    const body = { store_identifier: p.id, app_id: a.id, type: storeType(a.type, p.kind), display_name: p.name };
    if (a.type === 'test_store') body.title = p.name;
    await call('POST', `${P}/products`, body);
  }
  products = await list(`${P}/products`);
  const idsFor = sid => products.filter(x => x.store_identifier === sid).map(x => x.id);

  // Entitlements
  let ents = await list(`${P}/entitlements`);
  for (const e of c.entitlements) {
    let ent = ents.find(x => x.lookup_key === e.key) ?? await call('POST', `${P}/entitlements`, { lookup_key: e.key, display_name: e.name });
    if (!ent) continue;
    const have = (await list(`${P}/entitlements/${ent.id}/products`)).map(x => x.id);
    const add = e.products.flatMap(idsFor).filter(id => !have.includes(id));
    if (add.length) await call('POST', `${P}/entitlements/${ent.id}/actions/attach_products`, { product_ids: add });
  }

  // Offerings and packages, in the order the paywall shows them
  let offerings = await list(`${P}/offerings`);
  for (const o of c.offerings) {
    const off = offerings.find(x => x.lookup_key === o.key) ?? await call('POST', `${P}/offerings`, { lookup_key: o.key, display_name: o.name });
    if (!off) continue;
    const pkgs = await list(`${P}/offerings/${off.id}/packages`);
    for (const [i, sid] of o.packages.entries()) {
      let pkg = pkgs.find(x => x.lookup_key === sid);
      if (!pkg) pkg = await call('POST', `${P}/offerings/${off.id}/packages`, { lookup_key: sid, display_name: c.products.find(p => p.id === sid)?.name ?? sid, position: i + 1 });
      else if (pkg.position !== i + 1) await call('POST', `${P}/packages/${pkg.id}`, { position: i + 1 });
      if (!pkg) continue;
      const have = (await list(`${P}/packages/${pkg.id}/products`)).map(x => x.product?.id ?? x.id);
      const add = idsFor(sid).filter(id => !have.includes(id));
      if (add.length) await call('POST', `${P}/packages/${pkg.id}/actions/attach_products`, { products: add.map(product_id => ({ product_id, eligibility_criteria: 'all' })) });
    }
    if (o.current && !off.is_current) await call('POST', `${P}/offerings/${off.id}`, { is_current: true });
  }

  // Read everything back and compare with the code
  offerings = await list(`${P}/offerings`);
  ents = await list(`${P}/entitlements`);
  const byId = Object.fromEntries(products.map(x => [x.id, x.store_identifier]));
  const live = { apps, products, entitlementProducts: {}, offeringPackages: {}, currentOffering: offerings.filter(o => o.is_current).map(o => o.lookup_key) };
  for (const e of ents) live.entitlementProducts[e.lookup_key] = (await list(`${P}/entitlements/${e.id}/products`)).map(x => x.store_identifier);
  for (const o of offerings) live.offeringPackages[o.lookup_key] = await Promise.all((await list(`${P}/offerings/${o.id}/packages`)).map(async p => ({
    key: p.lookup_key, position: p.position, products: (await list(`${P}/packages/${p.id}/products`)).map(x => byId[x.product?.id ?? x.id]) })));
  const missing = diff(c, live);

  // Public SDK keys into the vault, values never printed
  const saved = [];
  if (argv.includes('--save-keys')) for (const a of apps) {
    const k = (await list(`${P}/apps/${a.id}/public_api_keys`))[0]?.key;
    const name = `REVENUECAT_${c.vaultPrefix}_${STORE_SLOT[a.type]}_PUBLIC_KEY`;
    if (!k) { errors.push(`no public key for ${a.type}`); continue; }
    const r = spawnSync('npm', ['run', '-s', 'vault:set', name], { input: k, cwd: process.env.BOSS_OS_DIR ?? `${homedir()}/GitHub/boss-os`, encoding: 'utf8' });
    if (r.status === 0) saved.push(name); else errors.push(`vault:set ${name} failed`);
  }
  for (const l of [...errors, ...missing]) console.log(l);
  console.log(`OUTPUT revenuecat-setup ${c.app}: ${apps.length} apps, ${c.products.length} products x ${apps.length}, ${c.entitlements.length} entitlements, ${c.offerings.length} offerings; ${missing.length} mismatches, ${errors.length} errors${saved.length ? `; saved to the vault as ${saved.join(', ')}` : ''}`);
  return errors.length || missing.length ? 1 : 0;
}

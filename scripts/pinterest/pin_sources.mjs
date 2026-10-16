// Where pin copy and art come from, for the Pinterest daily drip.
//
// Every word on a pin restates the target page's own source data:
//   /products/*  -> data/products/product_catalog.json (name, features, outcomes, promise)
//   /guides/*    -> data/authority/content_registry.json (title, answer, summary)
//                   + data/seo/guide_meta_descriptions.json
//   hub pages    -> data/seo/hub_pages.json (h1, section bullets, description)
// Hand-written angles for a page live in data/pinterest/angles.json and go first;
// when they run out, derivedAngles() builds more from the same source by template
// ($0: no model call). Art is the product's own committed images, never people.
import fs from 'node:fs';
import path from 'node:path';

export const HOST = 'weddingchecklistpdf.com';
const ROOT = process.cwd();
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));

let cache;
function sources() {
  if (cache) return cache;
  const catalog = readJson('data/products/product_catalog.json').products;
  const registry = readJson('data/authority/content_registry.json').pages;
  const metaDescriptions = readJson('data/seo/guide_meta_descriptions.json');
  const hubs = {};
  (function walk(node) {
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (value && typeof value === 'object' && !Array.isArray(value) && typeof value.h1 === 'string' && value.host) hubs[`/${key}`] = value;
      else walk(value);
    }
  })(readJson('data/seo/hub_pages.json'));
  const ownership = readJson('data/seo/route_ownership.json');
  cache = { catalog, registry, metaDescriptions: metaDescriptions.descriptions ?? metaDescriptions, hubs, ownership };
  return cache;
}

/** Product and guide pages this host serves: the pages that may join the drip. */
export function eligiblePaths() {
  return sources().ownership.routes
    .filter((r) => r.host === HOST && r.indexable !== false && /^\/(products|guides)\/[a-z0-9-]+$/.test(r.path))
    .map((r) => r.path)
    .sort();
}

/** The page's own source record, or null when nothing truthful can be said about it. */
export function pageSource(pagePath) {
  const { catalog, registry, metaDescriptions, hubs } = sources();
  const product = catalog.find((p) => p.route === pagePath || `/products/${p.id}` === pagePath);
  if (product) {
    return {
      kind: 'product',
      productId: product.id,
      name: product.name,
      eyebrow: 'WEDDING PLANNER',
      facts: [...(product.features ?? []), ...(product.outcomes ?? [])],
      summary: product.promise ?? product.sub ?? `${product.name}: ${(product.features ?? []).slice(0, 4).join(', ')}.`,
      text: JSON.stringify(product)
    };
  }
  const guideSlug = pagePath.match(/^\/guides\/([a-z0-9-]+)$/)?.[1];
  const guide = guideSlug && registry.find((p) => p.slug === guideSlug);
  if (guide) {
    const facts = String(guide.answer ?? '')
      .split(/(?<=\.)\s+/)
      .flatMap((sentence) => sentence.replace(/\.$/, '').split(/,\s*(?:and\s+)?/))
      .map((s) => s.trim().replace(/^(and|or)\s+/i, ''))
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1));
    return {
      kind: 'guide',
      productId: guide.product_id ?? 'checklist-pdf',
      name: guide.title,
      eyebrow: 'FREE GUIDE',
      facts,
      summary: metaDescriptions[guideSlug] ?? guide.summary,
      text: JSON.stringify({ guide, meta: metaDescriptions[guideSlug] ?? null })
    };
  }
  const hub = hubs[pagePath];
  if (hub) {
    return {
      kind: 'hub',
      productId: 'checklist-pdf',
      name: hub.h1.charAt(0).toUpperCase() + hub.h1.slice(1),
      eyebrow: 'PRINTABLE CHECKLIST',
      facts: (hub.sections ?? []).flatMap((s) => s.bullets ?? []),
      summary: hub.description,
      text: JSON.stringify(hub)
    };
  }
  return null;
}

/** The product's own committed art, most distinctive first. */
export function artFor(productId) {
  const ids = productId === 'operations-suite'
    ? ['operations-suite', 'merch/operations-suite-hero', 'merch/checklist-pdf-card', 'merch/budget-spreadsheet-card', 'merch/timeline-template-card', 'merch/seating-chart-maker-card']
    : [`${productId}`, `${productId}-sample-1`, `merch/${productId}-card`, `${productId}-sample-2`, `${productId}-hero`, `${productId}-sample-3`];
  const found = ids.map((id) => `product-images/${id}.png`).filter((rel) => fs.existsSync(path.join(ROOT, 'public', rel)));
  return found.length ? found : artFor('checklist-pdf');
}

const clip = (text, max) => {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:]$/, '')}…`;
};

/** Wrap a page name into at most three headline lines of ~18 characters. */
export function wrapHeadline(name) {
  const lines = [];
  for (const word of name.split(/\s+/)) {
    const last = lines[lines.length - 1];
    if (last && `${last} ${word}`.length <= 18) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines.slice(0, 3).join('\n');
}

/** Template angles from the page's own facts: one per fact short enough to read on a pin. */
export function derivedAngles(pagePath) {
  const source = pageSource(pagePath);
  if (!source) return [];
  const headline = wrapHeadline(source.name);
  return groupFacts([...new Set(source.facts)])
    .map((fact) => ({
      eyebrow: source.eyebrow,
      headline,
      subline: fact,
      title: clip(`${source.name}: ${fact}`, 100),
      description: clip(source.summary, 500)
    }));
}

/** Short facts are joined three to a line ("Power · Lighting · Restrooms"); long ones stand alone; too long to read on a pin is dropped. */
export function groupFacts(facts) {
  const lines = [];
  let group = [];
  const flush = () => { if (group.length) lines.push(group.join(' · ')); group = []; };
  for (const fact of facts.map((f) => f.trim()).filter(Boolean)) {
    if (fact.length > 44) continue;
    if (fact.length > 22) { flush(); lines.push(fact); continue; }
    const word = fact.charAt(0).toUpperCase() + fact.slice(1);
    if ([...group, word].join(' · ').length > 40 || group.length === 3) flush();
    group.push(word);
  }
  flush();
  return lines.filter((line) => line.length >= 12);
}

export function anglesFor(pagePath) {
  const handWritten = readJson('data/pinterest/angles.json')[pagePath] ?? [];
  return [...handWritten, ...derivedAngles(pagePath)];
}

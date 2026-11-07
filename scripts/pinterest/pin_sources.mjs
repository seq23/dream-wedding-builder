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
  const registry = [...readJson('data/authority/content_registry.json').pages, ...readJson('data/pinterest/retired_guide_sources.json').pages];
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
    const facts = guideFacts(guide.answer);
    return {
      kind: 'guide',
      productId: guide.product_id ?? 'checklist-pdf',
      name: String(guide.title).split(':')[0].trim(),
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

const ARTICLE = /^(the|a|an)\s+/i;
const OPENERS = new Set(['because', 'not', 'which', 'that', 'so', 'but', 'when', 'if', 'this', 'it', 'only', 'then', 'while', 'as', 'or', 'and', 'to', 'for', 'with', 'is', 'are', 'than', 'whether', 'who', 'where', 'how']);
const DANGLING = new Set(['the', 'a', 'an', 'when', 'and', 'or', 'to', 'of', 'for', 'with', 'is', 'are', 'only', 'that', 'than', 'by', 'in', 'on', 'at', 'from', 'whether']);

/**
 * Pin-sized facts from a guide's answer: a whole short sentence, or a short list item
 * (six words at most, leading article dropped) from a longer one. A clause cut out of a sentence ("Because
 * the order window", "Not the need for clear ceremony") never reaches a pin.
 */
export function guideFacts(answer) {
  const out = [];
  for (const raw of String(answer ?? '').split(/(?<=\.)\s+/)) {
    const sentence = raw.trim().replace(/\.$/, '');
    if (!sentence) continue;
    if (sentence.length <= 44) { out.push(sentence); continue; }
    for (const part of sentence.split(/,\s*(?:and\s+|or\s+)?|;\s*|:\s*/)) {
      const words = part.trim().replace(ARTICLE, '').split(/\s+/).filter(Boolean);
      if (!words.length || words.length > 6) continue;
      if (OPENERS.has(words[0].toLowerCase()) || DANGLING.has(words.at(-1).toLowerCase())) continue;
      out.push(words.join(' '));
    }
  }
  return out.map((s) => s.charAt(0).toUpperCase() + s.slice(1));
}

/** The product's own committed art, most distinctive first. */
export function artFor(productId) {
  const ids = productId === 'operations-suite'
    ? ['operations-suite', 'merch/operations-suite-hero', 'merch/checklist-pdf-card', 'merch/budget-spreadsheet-card', 'merch/timeline-template-card', 'merch/seating-chart-maker-card']
    : [`${productId}`, `${productId}-sample-1`, `merch/${productId}-card`, `${productId}-sample-2`, `${productId}-hero`, `${productId}-sample-3`];
  const found = ids.map((id) => `product-images/${id}.png`).filter((rel) => fs.existsSync(path.join(ROOT, 'public', rel)));
  return found.length ? found : artFor('checklist-pdf');
}

// Topic art (data/pinterest/topic_art.json): each pin page maps to one topic, and its pins
// may only use that topic's images (photos that show the topic, or the product's own art).
let topicCache;
export function topicArt() {
  return (topicCache ??= readJson('data/pinterest/topic_art.json'));
}

/** The page's topic tag, or null when no topic art is mapped for it (it then gets no pins). */
export function topicFor(pagePath) {
  return topicArt().pages[pagePath]?.topic ?? null;
}

/** The searches a page answers (its title + its board's Pinterest searches). */
export function searchesFor(pagePath) {
  return topicArt().pages[pagePath]?.search ?? [];
}

/** The image paths of a topic, in their recorded order. */
export function topicImages(topic) {
  return (topicArt().topics[topic]?.images ?? []).map((i) => i.file);
}

/** Crop focus recorded for an image ([x, y] in 0..1), centre by default. */
export function focusFor(art) {
  for (const t of Object.values(topicArt().topics)) for (const i of t.images) if (i.file === art || i.file === `/${art}`) return i.focus ?? [0.5, 0.5];
  return [0.5, 0.5];
}

/** The topic whose words a question names first (longest word wins), else the checklist topic. */
export function topicForText(text) {
  const t = ` ${String(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  let best = null;
  for (const [tag, topic] of Object.entries(topicArt().topics)) for (const w of topic.words ?? []) if (t.includes(` ${w.replace(/[^a-z0-9]+/g, ' ')} `) && (!best || w.length > best.w.length)) best = { tag, w };
  return best?.tag ?? 'checklist';
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

/** Wrap a question into at most four lines, widening the line before ever cutting a word. */
export function wrapQuestion(text) {
  for (const width of [20, 24, 28, 32]) {
    const lines = [];
    for (const word of text.split(/\s+/)) {
      const last = lines[lines.length - 1];
      if (last && `${last} ${word}`.length <= width) lines[lines.length - 1] = `${last} ${word}`;
      else lines.push(word);
    }
    if (lines.length <= 4 && lines.every((l) => l.length <= width)) return lines.join('\n');
  }
  return null;
}

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/**
 * A search-loop question page as a pin: the question itself (a real search, from Search
 * Console) is the headline and title; the page's own meta description is the pin
 * description. Null when the page file is missing or the question cannot be printed whole.
 */
export function questionPin(page, slConfig, id) {
  const file = path.join(ROOT, slConfig.output.dir, `${page.route.slice(slConfig.output.url_prefix.length).replace(/\/$/, '')}.html`);
  if (!fs.existsSync(file)) return null;
  const html = fs.readFileSync(file, 'utf8');
  const meta = decode(html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] ?? '').trim();
  const q = page.query.trim().replace(/\?*$/, '');
  const question = `${q.charAt(0).toUpperCase()}${q.slice(1)}${/^(how|what|when|where|why|who|which|can|do|does|is|are|should|will)\b/i.test(q) ? '?' : ''}`;
  const headline = wrapQuestion(question);
  if (!headline || !meta) return null;
  const n = [...id].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const topic = topicForText(q);
  const art = topicImages(topic);
  return {
    id,
    seq: 0,
    path: page.route,
    eyebrow: 'WEDDING PLANNING Q&A',
    headline,
    subline: 'The short answer + next steps',
    title: clip(question, 100),
    description: clip(meta, 440),
    layout: ['header', 'split', 'tab-panel', 'card', 'binder-page'][n % 5],
    palette: ['ivory', 'blue-soft', 'coral-soft', 'midnight'][n % 4],
    topic,
    search: [q.toLowerCase()],
    art: art[n % art.length]
  };
}

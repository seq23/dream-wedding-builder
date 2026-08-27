#!/usr/bin/env node
// Answers one question: which /guides/<slug> paths serve 200?
//
// It answers it the way the route answers it - registry.pages.filter(isComplete),
// the exact expression in lib/authority-registry.ts - and then dereferences every
// field app/guides/[slug]/page.tsx dereferences, including resolving related_slugs
// back to real entries. A slug printed as 200 here is a slug the router renders.
//
// Usage: node scripts/authority_scale/check_guide_routes.mjs [slug ...]
import fs from 'node:fs';
import path from 'node:path';
import { isComplete } from '../../lib/authority-complete.mjs';

const root = process.cwd();
const registry = JSON.parse(fs.readFileSync(path.join(root, 'data/authority/content_registry.json'), 'utf8'));
const ownership = JSON.parse(fs.readFileSync(path.join(root, 'data/seo/route_ownership.json'), 'utf8'));
const shippingPages = registry.pages.filter(isComplete);
const owned = new Map(ownership.routes.map((r) => [r.path, r.host]));

console.log(`shippingPages: ${shippingPages.length} of ${registry.pages.length} registry entries serve 200`);
const wanted = process.argv.slice(2);
const targets = wanted.length ? wanted : shippingPages.map((p) => p.slug);
let bad = 0;
for (const slug of targets) {
  const page = shippingPages.find((p) => p.slug === slug);
  if (!page) { console.log(`/guides/${slug}: 404 (notFound)`); bad++; continue; }
  const related = page.related_slugs.map((r) => registry.pages.find((i) => i.slug === r)).filter(Boolean);
  const host = owned.get(`/guides/${slug}`);
  const problems = [];
  if (related.length !== page.related_slugs.length) problems.push(`${page.related_slugs.length - related.length} related_slugs do not resolve`);
  if (!host) problems.push('no host owns this route in data/seo/route_ownership.json');
  if (problems.length) bad++;
  if (wanted.length || problems.length) {
    console.log(`/guides/${slug}: ${problems.length ? 'BROKEN' : '200'}  host=${host ?? 'NONE'}  sections=${page.sections.length} faqs=${page.faqs.length} examples=${page.examples.length} steps=${page.steps.length} mistakes=${page.mistakes.length} related=${related.length}/${page.related_slugs.length} hub=${page.hub_route}`);
    for (const p of problems) console.log(`    ${p}`);
  }
}
if (bad) { console.error(`${bad} route(s) would not render correctly.`); process.exit(1); }
console.log(`All ${targets.length} checked route(s) render.`);

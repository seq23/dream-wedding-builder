#!/usr/bin/env node
// Fails when data/authority/content_registry.json contains an entry that cannot
// render.
//
// The gap this closes: between 2026-07-30 and 2026-08-27 the registry grew from 67
// to 112 pages while the number that served 200 stayed at 67. Every validator in
// the gate passed the whole time, because none of them asked the one question the
// router asks - does this entry carry the five fields app/guides/[slug]/page.tsx
// dereferences. The producer wrote records the consumer refused, and the only place
// the disagreement showed up was in a 404.
//
// So this asks exactly that question, using isComplete() from
// lib/authority-complete.mjs - the same function object the route, the sitemap,
// lib/authority-registry.ts and scripts/authority_scale/publish_authority_batch.mjs
// call. It is not a second opinion about what "complete" means; it is the first
// opinion, applied to committed data.
//
// It is registered in _repo_validation_registry.json as HARD_FAIL and runs inside
// validate:structural, which .github/workflows/full-safe-autonomy.yml executes
// before either of its two pushes to main. A validator that is written but never
// wired into the gate has no effect at all.

import fs from 'node:fs';
import path from 'node:path';

import { findPlaceholders, isComplete, missingRequiredFields } from '../lib/authority-complete.mjs';

const root = process.cwd();
const REGISTRY = 'data/authority/content_registry.json';
const FROZEN = 'data/release/frozen_output_registry.json';

const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));

const registry = readJson(REGISTRY);
const pages = registry.pages ?? [];
const failures = [];

// 1. Every entry must satisfy the predicate the router applies.
for (const page of pages) {
  if (isComplete(page)) continue;
  failures.push({
    code: 'UNRENDERABLE_ENTRY',
    slug: page.slug,
    detail: `missing ${missingRequiredFields(page).join(', ')} - /guides/${page.slug} would notFound()`,
  });
}

// 2. No unexpanded template variable may survive into committed content. All 45
// entries retired on 2026-08-27 carried a literal {topic} in semantic_key; none of
// the 67 that ship did. A placeholder here is a generator bug in a data file.
for (const hit of findPlaceholders(pages, 'pages')) {
  failures.push({ code: 'UNEXPANDED_PLACEHOLDER', slug: null, detail: `${hit.path}: ${JSON.stringify(hit.value)}` });
}

// 3. The freeze must not be able to put back what the registry no longer has.
// scripts/authority_scale/restore_authority_content.mjs pushes any frozen record
// whose slug is absent (else doc.pages.push(frozen)), and it runs one step before
// publish in the daily workflow. A frozen record with no live entry is therefore a
// deletion that will undo itself on the next cron run.
if (fs.existsSync(path.join(root, FROZEN))) {
  const slugs = new Set(pages.map((page) => page.slug));
  for (const [route, record] of Object.entries(readJson(FROZEN).records ?? {})) {
    if (slugs.has(record.slug)) continue;
    failures.push({
      code: 'FROZEN_ORPHAN',
      slug: record.slug,
      detail: `${FROZEN} still holds ${route}, which is not in the registry - authority:scale:restore would re-add it on the next run`,
    });
  }
}

// No receipt is written from here. scripts/validate-profile-purity.mjs requires a
// scripts/validate-*.mjs to inspect and not mutate, and scripts/validate/run-registry.mjs
// already records the outcome in reports/validation/registry-run.json.
if (failures.length) {
  console.error(`AUTHORITY REGISTRY INVALID: ${failures.length} failure(s) in ${REGISTRY}`);
  for (const failure of failures) console.error(`  [${failure.code}] ${failure.slug ?? ''} ${failure.detail}`.replace(/\s+/g, ' '));
  process.exit(1);
}

console.log(`AUTHORITY REGISTRY PASS: ${pages.length} pages, ${pages.filter(isComplete).length} renderable, 0 placeholders, 0 frozen orphans`);

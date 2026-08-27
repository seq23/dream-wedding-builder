#!/usr/bin/env node
// Derives data/authority/guide_composition_spec.json from the guides that ship,
// and proves the derivation by recomposing every one of them.
//
// The spec is not hand-written. It is read back out of the 67 renderable guides
// in data/authority/content_registry.json: for each cluster, take the fields that
// are invariant across every guide in it, and treat the rest as authored. Then
// recompose all 67 records from three sentences each and compare to the committed
// bytes. If a single page differs, the derivation is wrong and this exits 1
// rather than writing a spec that does not describe the library.
//
// Run with --check to verify without writing (used by the validator and CI), or
// with no flag to regenerate.

import fs from 'node:fs';
import path from 'node:path';
import { composeGuide, extractSeed } from '../../lib/authority-compose.mjs';

const root = process.cwd();
const CHECK = process.argv.includes('--check');
const REBASELINE = process.argv.includes('--rebaseline');
const SPEC_PATH = 'data/authority/guide_composition_spec.json';
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));

const existingSpec = fs.existsSync(path.join(root, 'data/authority/guide_composition_spec.json'))
  ? JSON.parse(fs.readFileSync(path.join(root, 'data/authority/guide_composition_spec.json'), 'utf8'))
  : null;
const pages = readJson('data/authority/content_registry.json').pages ?? [];
// Only guides that already render define the shape. A skeleton cannot teach it.
const shipping = pages.filter(
  (p) => Array.isArray(p.sections) && Array.isArray(p.faqs) && Array.isArray(p.examples) && Array.isArray(p.related_slugs) && p.hub_route,
);

const byCluster = new Map();
for (const p of shipping) {
  if (!byCluster.has(p.cluster)) byCluster.set(p.cluster, []);
  byCluster.get(p.cluster).push(p);
}

const errors = [];
/** The one value `fn` takes across every guide in the cluster, or an error. */
const invariant = (group, cluster, label, fn) => {
  const values = [...new Set(group.map(fn))];
  if (values.length !== 1) {
    errors.push(`NOT_INVARIANT ${cluster} ${label}: ${values.length} distinct values across ${group.length} guides`);
    return values[0];
  }
  return values[0];
};

const clusters = {};
for (const [cluster, group] of [...byCluster.entries()].sort()) {
  const sample = group[0];
  clusters[cluster] = {
    product_id: invariant(group, cluster, 'product_id', (p) => p.product_id),
    hub_route: invariant(group, cluster, 'hub_route', (p) => p.hub_route),
    // The heading embeds the title verbatim, so the pattern is the heading with
    // the title lifted back out.
    sec0_heading_pattern: invariant(group, cluster, 'sec0_heading_pattern', (p) => p.sections[0].heading.split(p.title).join('{TITLE}')),
    sec0_para1: invariant(group, cluster, 'sec0_para1', (p) => p.sections[0].paragraphs[1]),
    sec1_heading: invariant(group, cluster, 'sec1_heading', (p) => p.sections[1].heading),
    sec2_heading: invariant(group, cluster, 'sec2_heading', (p) => p.sections[2].heading),
    sec2_para0: invariant(group, cluster, 'sec2_para0', (p) => p.sections[2].paragraphs[0]),
    verification_boundary: invariant(group, cluster, 'verification_boundary', (p) => p.verification_boundary),
    faq1_question: invariant(group, cluster, 'faq1_question', (p) => p.faqs[1].question),
    mistakes: JSON.parse(invariant(group, cluster, 'mistakes', (p) => JSON.stringify(p.mistakes))),
    shipping_guides: group.length,
    example_slug: sample.slug,
  };
}

// The proof. Recompose every shipping guide from its three authored sentences and
// compare against the committed record, key order included.
let recomposed = 0;
for (const page of shipping) {
  const seed = extractSeed(page);
  const rebuilt = composeGuide(seed, clusters[page.cluster], page.related_slugs);
  if (JSON.stringify(rebuilt) !== JSON.stringify(page)) {
    errors.push(`ROUND_TRIP_FAILED ${page.slug}: recomposition differs from the committed record`);
    continue;
  }
  recomposed++;
}

// The quality bar, measured rather than chosen.
//
// validate_authority_scale.mjs rejects generated pages above 0.82 pairwise Jaccard
// on answer+steps+mistakes. But the library's own hand-authored guides never come
// close to it: the cluster scaffold alone accounts for about 0.63 of the overlap,
// and the three authored sentences carry every pair to a maximum of ~0.73. So 0.82
// is the point at which the build breaks, and ~0.73 is the point at which this
// library stops looking like itself. A generated page is held to the second.
const norm = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const tokenSet = (p) => new Set(norm([p.answer, ...(p.steps || []), ...(p.mistakes || [])].join(' ')).split(' ').filter((x) => x.length > 3));
const jaccard = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; const u = new Set([...a, ...b]).size; return u ? i / u : 0; };
const sets = shipping.map(tokenSet);
let observedMax = 0;
let observedPair = null;
let comparisons = 0;
for (let i = 0; i < sets.length; i++) {
  for (let j = i + 1; j < sets.length; j++) {
    comparisons++;
    const s = jaccard(sets[i], sets[j]);
    if (s > observedMax) { observedMax = s; observedPair = [shipping[i].slug, shipping[j].slug]; }
  }
}

const spec = {
  schema_version: '1.1',
  derived_at: new Date().toISOString().slice(0, 10),
  derived_from: 'data/authority/content_registry.json',
  derived_by: 'scripts/authority_scale/derive_composition_spec.mjs',
  note:
    'Read back out of the guides that render, never hand-written. Every field here is invariant across every shipping guide in its cluster; everything not here is authored per guide. The derivation is proved by recomposing all shipping guides from three sentences each and comparing to the committed bytes.',
  authored_fields: {
    summary: 'The claim this guide makes about its subject. Becomes the lead sentence, sections[0].paragraphs[0], and faqs[0].answer.',
    recommendation: 'What to do about it. Becomes steps[1], sections[1].paragraphs[0], the bullet list head, and faqs[1].answer.',
    working_example: 'One illustrative worked case, explicitly hedged so no figure reads as a quoted fact. Becomes sections[1].paragraphs[1] and examples[0].body.',
  },
  derived_fields:
    'product_id, hub_route, answer, steps, mistakes, sections, examples, faqs, semantic_key, verification_boundary - all composed by lib/authority-compose.mjs',
  universal: {
    steps_3_to_6: 'lib/authority-compose.mjs UNIVERSAL_STEPS - identical across all shipping guides in every cluster',
    faq2_question: 'What should be verified before the final version?',
  },
  shipping_guides_analysed: shipping.length,
  round_trip_verified: recomposed,
  near_duplicate: existingSpec?.near_duplicate && !REBASELINE ? existingSpec.near_duplicate : {
    metric: 'pairwise Jaccard over answer + steps + mistakes, tokens longer than 3 characters - the exact measure scripts/authority_scale/validate_authority_scale.mjs applies',
    measured_on: new Date().toISOString().slice(0, 10),
    measured_over_guides: shipping.length,
    comparisons,
    observed_max_among_shipping_guides: Number(observedMax.toFixed(3)),
    observed_max_pair: observedPair,
    build_breaking_ceiling: 0.82,
    frozen: true,
    note:
      'A baseline, deliberately not recomputed on every run. It was measured over the hand-authored library, and it is the bar new guides are held to. Recomputing it as generated pages land would let the ceiling ratchet upward on its own output, which is how a quality bar quietly becomes whatever was last produced. Rebaseline explicitly with --rebaseline, and only after a human has read the library again.',
  },
  clusters,
};

if (errors.length) {
  console.error(`COMPOSITION SPEC DERIVATION FAILED: ${errors.length} problem(s)`);
  for (const e of errors.slice(0, 20)) console.error(`  ${e}`);
  process.exit(1);
}

const serialised = JSON.stringify(spec, null, 2) + '\n';
if (CHECK) {
  // What is checked is the SHAPE - the cluster scaffolds and the universal strings.
  // Tallies are not: the guide count rises every time something publishes, and
  // failing the build on that would mean the spec has to be regenerated after every
  // release, which is churn, not a gate. The two things that must hold are that the
  // committed scaffold still describes the library, and that every shipping guide
  // still round-trips through it.
  if (!existingSpec) {
    console.error(`COMPOSITION SPEC MISSING: ${SPEC_PATH} does not exist. Run \`npm run authority:spec:derive\`.`);
    process.exit(1);
  }
  const drift = [];
  if (JSON.stringify(existingSpec.clusters) !== JSON.stringify(clusters)) {
    for (const name of new Set([...Object.keys(existingSpec.clusters || {}), ...Object.keys(clusters)])) {
      const a = (existingSpec.clusters || {})[name];
      const b = clusters[name];
      if (!a) { drift.push(`cluster "${name}" is in the library but not in the committed spec`); continue; }
      if (!b) { drift.push(`cluster "${name}" is in the committed spec but no longer in the library`); continue; }
      for (const field of Object.keys(b)) {
        // shipping_guides / example_slug move as the library grows; they describe, not define.
        if (field === 'shipping_guides' || field === 'example_slug') continue;
        if (JSON.stringify(a[field]) !== JSON.stringify(b[field])) drift.push(`cluster "${name}" field "${field}" differs from the committed spec`);
      }
    }
  }
  if (recomposed !== shipping.length) drift.push(`${shipping.length - recomposed} of ${shipping.length} shipping guides no longer recompose from three sentences`);
  if (drift.length) {
    console.error(`COMPOSITION SPEC DRIFT: ${drift.length} problem(s) between ${SPEC_PATH} and the live registry.`);
    for (const d of drift.slice(0, 20)) console.error(`  ${d}`);
    console.error('Either a guide was edited away from the shape, or the spec needs regenerating with `npm run authority:spec:derive`.');
    process.exit(1);
  }
  console.log(`COMPOSITION SPEC PASS: ${shipping.length} shipping guides, ${recomposed} recomposed byte-identically, ${Object.keys(clusters).length} clusters, 0 scaffold drift`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(path.join(root, SPEC_PATH)), { recursive: true });
fs.writeFileSync(path.join(root, SPEC_PATH), serialised);
console.log(`Wrote ${SPEC_PATH}: ${Object.keys(clusters).length} clusters from ${shipping.length} shipping guides; ${recomposed}/${shipping.length} recomposed byte-identically.`);

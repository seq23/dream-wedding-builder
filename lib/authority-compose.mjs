// How a Dream Wedding Builder guide is actually built.
//
// This is the shape reverse-engineered from the 67 guides that ship. It is not a
// preference: derive_composition_spec.mjs re-derives the scaffold from those 67
// pages and recomposes every one of them from three sentences, and the result is
// byte-identical to the committed record in all 67 cases. So the composition
// below is a measured fact about the library, not a template someone invented.
//
// The finding that matters: a guide is a pure function of seven inputs, and only
// three of them carry judgement.
//
//   derived   slug, title, cluster        -> everything structural
//   derived   related_slugs               -> four siblings in the same cluster
//   AUTHORED  summary                     -> the claim this guide makes
//   AUTHORED  recommendation              -> what to actually do about it
//   AUTHORED  working_example             -> one illustrative, hedged worked case
//
// The cluster supplies the frame (headings, the four standing mistakes, the
// verification boundary, steps 3-6). The three authored sentences supply the
// subject. That split is why the library measures 0.63 mean pairwise similarity
// within a cluster and still tops out at 0.730 - well under the 0.82 ceiling
// scripts/authority_scale/validate_authority_scale.mjs enforces. The scaffold is
// the shared 0.63; the authored sentences are the distance.
//
// A generator can produce the frame perfectly and cannot produce the three
// sentences without inventing facts about capacity, price, timing or local rule.
// So it does not try. It composes from data/authority/editorial_seeds.json and
// emits a draft for anything unseeded.

/** Steps 3-6. Identical across all 67 shipping guides, every cluster. */
export const UNIVERSAL_STEPS = Object.freeze([
  'Record the controlling inputs, constraints, and unresolved items in one source of truth.',
  'Test the plan against the real count, capacity, contract, timing, payment, or handoff dependency that could break it.',
  'Review the working version with the people who must act on it, then document corrections.',
  'Freeze and date the final version; route every later change through one owner.',
]);

export const FAQ0_Q = (titleLc) => `What is the most important part of ${titleLc}?`;
export const FAQ2_Q = 'What should be verified before the final version?';
export const STEP0 = (titleLc) => `Define the exact outcome for ${titleLc} and name the person responsible for the final version.`;
export const CONTROL_CHECK = (titleLc) =>
  `Before finalizing, confirm that the people, totals, dates, capacities, payments, or dependencies affected by ${titleLc} reconcile in one source of truth.`;
export const FAQ1_SUFFIX = ' Replace every illustrative assumption with your verified wedding details.';

/**
 * Compose a complete registry record from a seed and its cluster scaffold.
 *
 * @param seed    { slug, title, cluster, summary, recommendation, working_example, updated_at }
 * @param cluster scaffold entry from data/authority/guide_composition_spec.json
 * @param relatedSlugs four sibling slugs in the same cluster
 * @returns the 16-field record, keys in the order the shipping registry uses
 */
export function composeGuide(seed, cluster, relatedSlugs) {
  const titleLc = String(seed.title).toLowerCase();
  const steps = [STEP0(titleLc), seed.recommendation, ...UNIVERSAL_STEPS];
  return {
    slug: seed.slug,
    title: seed.title,
    cluster: seed.cluster,
    product_id: cluster.product_id,
    summary: seed.summary,
    answer: `${seed.summary} ${seed.recommendation}`,
    steps,
    mistakes: [...cluster.mistakes],
    sections: [
      {
        heading: cluster.sec0_heading_pattern.replace('{TITLE}', seed.title),
        paragraphs: [seed.summary, cluster.sec0_para1],
      },
      {
        heading: cluster.sec1_heading,
        paragraphs: [seed.recommendation, seed.working_example],
        bullets: steps.slice(1, 5),
      },
      {
        heading: cluster.sec2_heading,
        paragraphs: [cluster.sec2_para0, cluster.verification_boundary],
      },
    ],
    examples: [
      { title: 'Working example', body: seed.working_example },
      { title: 'Control check', body: CONTROL_CHECK(titleLc) },
    ],
    faqs: [
      { question: FAQ0_Q(titleLc), answer: seed.summary },
      { question: cluster.faq1_question, answer: seed.recommendation + FAQ1_SUFFIX },
      { question: FAQ2_Q, answer: cluster.verification_boundary },
    ],
    semantic_key: `${cluster.product_id}:${seed.slug}`,
    updated_at: seed.updated_at,
    verification_boundary: cluster.verification_boundary,
    related_slugs: [...relatedSlugs],
    hub_route: cluster.hub_route,
  };
}

/**
 * The words that say what a guide is about, for relatedness scoring.
 *
 * Title alone is too thin: "Wedding Guest List and Headcount Control" shares no
 * content word with any existing seating slug, so a title-only match falls through
 * to alphabetical order and produces four links that are merely in the same cluster.
 * Pulling the summary and recommendation in gives the overlap something to bite on -
 * capacity, household, RSVP, meal - which is what the guides are actually about.
 */
export const STOPWORDS = Object.freeze(new Set([
  'wedding', 'weddings', 'the', 'and', 'for', 'with', 'your', 'you', 'how', 'plan', 'planning',
  'that', 'this', 'from', 'into', 'before', 'after', 'every', 'each', 'their', 'them', 'they',
  'are', 'was', 'were', 'has', 'have', 'had', 'not', 'but', 'because', 'than', 'then', 'when',
  'what', 'which', 'who', 'whose', 'its', 'one', 'two', 'more', 'most', 'only', 'also', 'can',
  'will', 'would', 'should', 'could', 'must', 'may', 'about', 'over', 'under', 'between', 'both',
  'guide', 'guides', 'use', 'using', 'used', 'make', 'makes', 'made', 'keep', 'keeps', 'set',
  'sets', 'get', 'gets', 'still', 'same', 'other', 'others', 'any', 'all', 'out', 'off', 'own',
]));

export function aboutnessTokens(...parts) {
  const words = String(parts.filter(Boolean).join(' '))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/);
  return new Set(words.filter((w) => w.length > 3 && !STOPWORDS.has(w)));
}

/** The three authored sentences, recovered from an already-composed record. */
export function extractSeed(page) {
  return {
    slug: page.slug,
    title: page.title,
    cluster: page.cluster,
    summary: page.summary,
    recommendation: page.steps[1],
    working_example: page.examples[0].body,
    updated_at: page.updated_at,
  };
}

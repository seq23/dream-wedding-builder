import type { Metadata } from 'next';
import hubsJson from '@/data/seo/hub_pages.json';
import registryJson from '@/data/authority/content_registry.json';
import guideMetaJson from '@/data/seo/guide_meta_descriptions.json';
import strengtheningJson from '@/data/seo/guide_strengthening.json';
import { canonicalUrl, hostForGuide, PARENT_HOST } from '@/lib/site-config';
import { ogImages, ogImageUrl, siteHome } from '@/lib/site-home';
import { DESC_MAX, DESC_MIN, TITLE_MAX as TITLE_BAND_MAX } from '@/lib/length-floor.mjs';

export type HubSection = { heading: string; paragraphs: string[]; bullets?: string[] };

// A bundle offer is the one way a hub page may sell something other than the
// product it is about. It exists for the two /amazon/ book pages whose topic has
// no matching SKU: the owner decided on 2026-08-29 to send those readers to the
// bundle rather than build three more products.
//
// `excludes` is required, not optional. A reader arriving from a book with a
// specific expectation is the reader most likely to file a mismatch dispute, and
// the only defence is saying, on the page, what the bundle does not contain
// before they pay. A bundle offer that cannot state its own exclusion is not
// allowed to render, which is why the field is part of the type rather than a
// convention. scripts/validate-amazon-landing-paths.mjs enforces the same rule
// against the data.
export type HubBundleOffer = {
  product_id: string; href: string; eyebrow: string; heading: string;
  paragraphs: string[]; includes: string[]; excludes: string; cta: string;
};
export type HubPage = {
  title: string; description: string; host: string; eyebrow: string; h1: string; intro: string; direct_answer: string;
  sections: HubSection[]; table: { headers: string[]; rows: string[][] }; faqs: { question: string; answer: string }[];
  related: string[]; asset?: { label: string; href: string; secondary_label?: string; secondary_href?: string } | null;
  product_id: string; schema: string; printable?: boolean; bundle_offer?: HubBundleOffer;
};
export type GuidePage = (typeof registryJson.pages)[number];
export const hubs = hubsJson.pages as Record<string, HubPage>;
export const guides = registryJson.pages;

export function hubBySlug(slug: string): HubPage { const page = hubs[slug]; if (!page) throw new Error(`Unknown hub: ${slug}`); return page; }
export function guideBySlug(slug: string): GuidePage | undefined { return guides.find((page) => page.slug === slug); }

// Keep the owning site's name even when the topic needs shortening. Dropping the
// old parent-brand suffix on long titles left those pages with no site identity
// (Search Readiness b10). Absolute metadata also prevents a second layout suffix.
// Over-length is trimmed here, at the generator, never failed by a check.
export const TITLE_MAX = TITLE_BAND_MAX;
export function documentTitle(title: string, host: string = PARENT_HOST): { absolute: string } {
  const name = siteHome(host).name;
  if (title.toLowerCase().includes(name.toLowerCase())) {
    // Already names its site: trim to fit only when the trimmed title still does.
    const trimmed = clip(title, TITLE_MAX);
    return { absolute: trimmed.toLowerCase().includes(name.toLowerCase()) ? trimmed : title };
  }
  const suffix = ` | ${name}`;
  return { absolute: `${fitTopic(title, TITLE_MAX - suffix.length)}${suffix}` };
}

// A long topic is shortened at its own clause break ("Wedding cost per guest: what
// 50, 100 and 150 guests actually cost" -> "Wedding cost per guest") before it is
// ever cut mid-phrase. The clipped form "Wedding cost per guest: what 50…" was the
// title Google showed for the site's one page with search demand (5 Nov 2026).
const TOPIC_MIN = 15;
function fitTopic(title: string, max: number): string {
  if (title.length <= max) return title;
  const head = title.split(/:\s|\s[\u2014\u2013-]\s|\?\s/)[0].trim();
  if (head.length >= TOPIC_MIN && head.length <= max && head.length < title.length) {
    // The numbers in a dropped clause are usually what the page was searched for:
    // every query /wedding-cost-per-guest ranked on named a guest count, and the
    // bare head "Wedding cost per guest" (live from 6 Nov 2026, when the " | Wedding
    // Checklist PDF" suffix left 41 characters) lost all of them. Keep them in
    // brackets when they fit: "Wedding cost per guest (50, 100, 150)".
    const numbers = [...new Set(title.slice(head.length).match(/\b\d[\d,]*\d\b|\b\d\b/g) ?? [])].map((n) => n.replace(/,$/, ''));
    const withNumbers = numbers.length && !/\d/.test(head) ? `${head} (${numbers.join(', ')})` : '';
    if (withNumbers && withNumbers.length <= max) return withNumbers;
    return head;
  }
  return clip(title, max);
}

// Every page shares its host's 1200x630 /og.png (served per host by app/og.png/route.ts)
// with explicit dimensions, so all four sites present the same card shape.
export function seoMetadata(input: { title: string; description: string; host: string; path: string; type?: 'website' | 'article' }): Metadata {
  const url = canonicalUrl(input.host, input.path);
  const description = clip(input.description, META_DESCRIPTION_MAX);
  return {
    title: documentTitle(input.title, input.host),
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: { title: input.title, description, url, siteName: siteHome(input.host).name, type: input.type ?? 'website', images: ogImages(input.host, input.title) },
    twitter: { card: 'summary_large_image', title: input.title, description, images: [ogImageUrl(input.host)] }
  };
}

// Source text for the recommendation_summary block, taken from fields each record
// already carries. Nothing is generated here: a record with no prescriptive text
// returns an empty string and the block is skipped rather than filled.

// Hub records state their recommendation in direct_answer ("Start with...",
// "Run the plan through...", "Use one guest record per person..."). The hub
// template therefore folds that panel into this block instead of printing both.
export function hubRecommendation(page: { direct_answer?: string }): string {
  return (page.direct_answer ?? '').trim();
}

// Guide records store answer as summary + the recommendation that follows it -
// true for all shipping guides. The header renders the summary half and this
// block renders the recommendation half, so the full answer still ships and
// neither half is printed twice.
export function guideLead(page: { summary?: string; answer?: string }): string {
  return (page.summary ?? '').trim() || (page.answer ?? '').trim();
}
export function guideRecommendation(page: { summary?: string; answer?: string }): string {
  const summary = (page.summary ?? '').trim();
  const answer = (page.answer ?? '').trim();
  if (!summary) return '';
  if (!answer.startsWith(summary)) return answer;
  return answer.slice(summary.length).trim();
}

// Product records state what the reader should build with the product in `sub`,
// which the product template does not otherwise render (only the shop cards use
// it), so nothing on the page is duplicated.
export function productRecommendation(product: { sub?: string }): string {
  return (product.sub ?? '').trim();
}

export function hubMetadata(slug: string): Metadata { const hub = hubBySlug(slug); return seoMetadata({ title: hub.title, description: hub.description, host: hub.host, path: `/${slug}` }); }
// Search engines show 110-160 characters; Bing reported guides at 81-98 as rule 118
// on 2026-09-25, and 25 more ran past 160. The guide records are hash-frozen
// (data/release/frozen_output_registry.json), so a hand-written description lives in
// data/seo/guide_meta_descriptions.json. A guide with no entry uses its summary when
// that already fits; otherwise it is extended with its own recommendation or cut at a
// word boundary, so a newly published guide can never render outside the range.
// scripts/validators/validate_rendered_seo_contract.mjs asserts the rendered result.
// 120, not 110: the Search Readiness band (item b2), tightened 2026-10-25. Eleven
// guide descriptions generated from a short summary sat at 110-119; raising the floor
// makes the generator extend them with the guide's own recommendation instead.
export const META_DESCRIPTION_MIN = DESC_MIN;
export const META_DESCRIPTION_MAX = DESC_MAX;
const guideMetaDescriptions = guideMetaJson.descriptions as Record<string, string>;
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 0)).replace(/[\s,;:.\u2014-]+$/, '')}\u2026`;
}
export function guideMetaDescription(guide: { slug: string; summary?: string; answer?: string }): string {
  const written = guideMetaDescriptions[guide.slug];
  if (written) return written;
  const summary = (guide.summary ?? '').trim();
  if (summary.length >= META_DESCRIPTION_MIN) return clip(summary, META_DESCRIPTION_MAX);
  const extended = `${summary} ${guideRecommendation(guide)}`.trim();
  return clip(extended, META_DESCRIPTION_MAX);
}

// Demand-repoint strengthening (data/seo/guide_strengthening.json): title, H1,
// definition and FAQs aligned to the query Search Console shows for the page.
// The guide record stays hash-frozen; this overlay is what changes.
export type GuideStrengthening = { target_query: string; title: string; h1: string; definition: string; faqs: { question: string; answer: string }[] };
export const strengthening = strengtheningJson as unknown as { money_page: { path: string; host: string; target_query: string; link_label: string }; product_path: { pdf: { product_id: string; route: string; price: number }; bundle: { product_id: string; route: string; price: number } }; guides: Record<string, GuideStrengthening> };
export function guideStrengthening(slug: string): GuideStrengthening | null { return strengthening.guides[slug] ?? null; }
export function guideMetadata(slug: string): Metadata { const guide = guideBySlug(slug); if (!guide) return {}; const host = hostForGuide(guide.slug); return seoMetadata({ title: guideStrengthening(slug)?.title ?? guide.title, description: guideMetaDescription(guide), host, path: `/guides/${guide.slug}`, type: 'article' }); }

import type { Metadata } from 'next';
import hubsJson from '@/data/seo/hub_pages.json';
import registryJson from '@/data/authority/content_registry.json';
import { canonicalUrl, hostForProduct } from '@/lib/site-config';

export type HubSection = { heading: string; paragraphs: string[]; bullets?: string[] };
export type HubPage = {
  title: string; description: string; host: string; eyebrow: string; h1: string; intro: string; direct_answer: string;
  sections: HubSection[]; table: { headers: string[]; rows: string[][] }; faqs: { question: string; answer: string }[];
  related: string[]; asset?: { label: string; href: string; secondary_label?: string; secondary_href?: string } | null;
  product_id: string; schema: string; printable?: boolean;
};
export type GuidePage = (typeof registryJson.pages)[number];
export const hubs = hubsJson.pages as Record<string, HubPage>;
export const guides = registryJson.pages;

export function hubBySlug(slug: string): HubPage { const page = hubs[slug]; if (!page) throw new Error(`Unknown hub: ${slug}`); return page; }
export function guideBySlug(slug: string): GuidePage | undefined { return guides.find((page) => page.slug === slug); }

export function seoMetadata(input: { title: string; description: string; host: string; path: string; type?: 'website' | 'article'; image?: string }): Metadata {
  const url = canonicalUrl(input.host, input.path);
  const image = input.image ?? '/product-images/merch/operations-suite-hero.png';
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: { title: input.title, description: input.description, url, siteName: 'Dream Wedding Builder', type: input.type ?? 'website', images: [{ url: canonicalUrl(input.host, image), alt: input.title }] },
    twitter: { card: 'summary_large_image', title: input.title, description: input.description, images: [canonicalUrl(input.host, image)] }
  };
}

// Source text for the recommendation_summary block, taken from fields each record
// already carries. Nothing is generated here: a record with no prescriptive text
// returns an empty string and the block is skipped rather than filled.
// scripts/validators/validate_content_pattern_contract.js mirrors these rules so
// the measured coverage matches what the templates actually render.

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
export function guideMetadata(slug: string): Metadata { const guide = guideBySlug(slug); if (!guide) return {}; const host = hostForProduct(guide.product_id); return seoMetadata({ title: guide.title, description: guide.summary ?? '', host, path: `/guides/${guide.slug}`, type: 'article' }); }

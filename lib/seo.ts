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

export function hubMetadata(slug: string): Metadata { const hub = hubBySlug(slug); return seoMetadata({ title: hub.title, description: hub.description, host: hub.host, path: `/${slug}` }); }
export function guideMetadata(slug: string): Metadata { const guide = guideBySlug(slug); if (!guide) return {}; const host = hostForProduct(guide.product_id); return seoMetadata({ title: guide.title, description: guide.summary ?? '', host, path: `/guides/${guide.slug}`, type: 'article' }); }

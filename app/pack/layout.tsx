import type { Metadata } from 'next';

// /pack is a client component and cannot export metadata, so it resolves from
// here. The route stays noindex/nofollow: it is listed in noindex_prefixes in
// data/seo/route_ownership.json and disallowed in app/robots.txt/route.ts,
// because it renders a plan held in the visitor's own browser. It previously
// carried the robots directive and nothing else, so the printed packet and the
// browser tab were both titled "Dream Wedding Builder". The title and
// description below name the page without changing its indexing posture.
export const metadata: Metadata = {
  title: 'Dream Wedding Starter Pack',
  description:
    'A printable summary of the plan saved in this browser: reality check, budget and tradeoff notes, venue and vendor selections, and the questions still open.',
  robots: { index: false, follow: false, noarchive: true }
};

export default function NoIndexLayout({ children }: { children: React.ReactNode }) { return children; }

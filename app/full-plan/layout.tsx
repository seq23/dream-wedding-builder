import type { Metadata } from 'next';

// A buyer's own plan, built in her browser: never indexed.
export const metadata: Metadata = { title: 'Your full wedding plan', description: 'Your full wedding plan, with every task dated from your wedding date, ready to print.', robots: { index: false, follow: false, noarchive: true } };
export default function FullPlanLayout({ children }: { children: React.ReactNode }) { return children; }

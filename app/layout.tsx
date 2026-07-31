import './globals.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { AppShell } from '@/components/AppShell';
import { apexHost, isCanonicalHost, PARENT_HOST } from '@/lib/site-config';

export const metadata: Metadata = {
  metadataBase: new URL('https://weddingchecklistpdf.com'),
  title: { default: 'Dream Wedding Builder', template: '%s | Dream Wedding Builder' },
  description: 'Free wedding planning guides and paid execution tools for checklists, budgets, timelines, guest lists, and seating charts.',
  robots: { index: true, follow: true }
};
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const rawHost = apexHost(requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host'));
  const siteHost = isCanonicalHost(rawHost) ? rawHost : PARENT_HOST;
  return <html lang="en"><body><AppShell siteHost={siteHost}>{children}</AppShell></body></html>;
}

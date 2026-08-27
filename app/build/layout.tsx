// /build is a client component, and a client component cannot export
// metadata. Next resolves metadata from the nearest server layout, so the
// canonical for this route lives here.
import { seoMetadata } from '@/lib/seo';
import { PARENT_HOST } from '@/lib/site-config';
export const metadata = seoMetadata({
  title: 'Wedding Planning Builder',
  description: 'A browser-based planning workspace. Start with the planning reality check, then work venue, flowers, budget, guest experience, design, vendor, food, and timeline decisions.',
  host: PARENT_HOST,
  path: '/build'
});
export default function Layout({ children }: { children: React.ReactNode }) { return children; }

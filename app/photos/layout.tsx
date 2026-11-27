// /photos is a client component, and a client component cannot export
// metadata. Next resolves metadata from the nearest server layout, so the
// canonical for this route lives here.
import { seoMetadata } from '@/lib/seo';
import { PARENT_HOST } from '@/lib/site-config';
export const metadata = seoMetadata({
  title: 'Inspiration to Planning Scope',
  description: 'Describe a wedding idea in your own words and get a starting scope: the kinds of vendors such an idea usually needs and what to verify before you book.',
  host: PARENT_HOST,
  path: '/photos'
});
export default function Layout({ children }: { children: React.ReactNode }) { return children; }

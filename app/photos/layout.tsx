// /photos is a client component, and a client component cannot export
// metadata. Next resolves metadata from the nearest server layout, so the
// canonical for this route lives here.
import { seoMetadata } from '@/lib/seo';
import { PARENT_HOST } from '@/lib/site-config';
export const metadata = seoMetadata({
  title: 'Inspiration to Planning Scope',
  description: 'Turn a wedding inspiration photo or idea into a scope breakdown: the vendors it needs, what drives its cost, and what to verify before you book anyone.',
  host: PARENT_HOST,
  path: '/photos'
});
export default function Layout({ children }: { children: React.ReactNode }) { return children; }

// /photos is a client component, and a client component cannot export
// metadata. Next resolves metadata from the nearest server layout, so the
// canonical for this route lives here.
import { seoMetadata } from '@/lib/seo';
import { PARENT_HOST } from '@/lib/site-config';
export const metadata = seoMetadata({
  title: 'Inspiration to Planning Scope',
  description: 'Upload an inspiration photo or describe the idea, and turn it into a scope breakdown, the vendors likely needed, cost drivers, and the questions to verify before booking.',
  host: PARENT_HOST,
  path: '/photos'
});
export default function Layout({ children }: { children: React.ReactNode }) { return children; }

// /free-wedding-planner is a client component, and a client component cannot
// export metadata. Next resolves metadata from the nearest server layout, so the
// canonical for this route lives here.
import { seoMetadata } from '@/lib/seo';
import { PARENT_HOST } from '@/lib/site-config';
import { PLANNER_ROUTE } from '@/lib/planner-seed';
export const metadata = seoMetadata({
  title: 'Free Wedding Planner — constraint-first planning in your browser',
  description: 'A free wedding planner in your browser: say what your wedding should feel like, then weigh venue, budget, guest and timeline choices against your limits.',
  host: PARENT_HOST,
  path: PLANNER_ROUTE
});
export default function Layout({ children }: { children: React.ReactNode }) { return children; }

// /free-wedding-planner is a client component, and a client component cannot
// export metadata. Next resolves metadata from the nearest server layout, so the
// canonical for this route lives here.
import { seoMetadata } from '@/lib/seo';
import { PARENT_HOST } from '@/lib/site-config';
import { PLANNER_ROUTE } from '@/lib/planner-seed';
export const metadata = seoMetadata({
  title: 'Free Wedding Planner — constraint-first planning in your browser',
  description: 'A free browser-based wedding planner. Start with the planning reality check, then work venue, flowers, budget, guest experience, design, vendor, food, and timeline decisions against the constraints you have actually committed to. No account, no email, nothing leaves your browser.',
  host: PARENT_HOST,
  path: PLANNER_ROUTE
});
export default function Layout({ children }: { children: React.ReactNode }) { return children; }

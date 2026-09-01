import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { landingBySlug } from '@/data/planner-landings';
import { PlannerLandingPage, landingMetadata } from '@/components/PlannerLandingPage';

const SLUG = 'wedding-budget-tradeoffs';
export const metadata: Metadata = landingMetadata(SLUG);

export default function Page() {
  const landing = landingBySlug(SLUG);
  if (!landing) notFound();
  return <PlannerLandingPage landing={landing} />;
}

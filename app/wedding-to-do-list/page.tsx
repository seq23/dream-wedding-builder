import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { landingBySlug } from '@/data/planner-landings';
import { PlannerLandingPage, landingMetadata } from '@/components/PlannerLandingPage';
import { DatedToDoList } from '@/components/DatedToDoList';
import { PLAN_WINDOWS } from '@/lib/dated-plan';

const SLUG = 'wedding-to-do-list';
export const metadata: Metadata = landingMetadata(SLUG);

export default function Page() {
  const landing = landingBySlug(SLUG);
  if (!landing) notFound();
  // The table is the free plan's own windows and tasks (lib/dated-plan.ts), read here so the
  // page and the planner can never list different tasks.
  const table = {
    caption: 'The wedding to-do list, window by window',
    columns: ['When', 'Tasks'],
    rows: PLAN_WINDOWS.map((window) => [window.label, window.tasks.join(' · ')]),
    note: 'The free plan’s core tasks. The planner dates each one from your wedding date; the full plan adds the rest.'
  };
  return <PlannerLandingPage landing={{ ...landing, table }}><DatedToDoList /></PlannerLandingPage>;
}

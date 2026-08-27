import { seoMetadata } from '@/lib/seo';
import { PARENT_HOST } from '@/lib/site-config';
import { Card, Badge } from '@/components/Card';
import { TrendCatalogue } from '@/components/TrendCatalogue';
import TrendSubmitForm from './trend-submit-form';
export const metadata = seoMetadata({
  title: 'Standout Wedding Ideas Catalogue',
  description: 'A compact index of concrete wedding ideas: arrival moments, seating experiences, ceremony reveals, cocktail surprises, dinner design, sensory stations, and photo moments.',
  host: PARENT_HOST,
  path: '/trends'
});

export default function TrendsPage() {
  return <div className="space-y-8">
    <section>
      <Badge>Standout Ideas Catalogue</Badge>
      <h1 className="mt-4 font-serif text-5xl">Standout wedding ideas that make guests say, “I have never seen that before.”</h1>
      <p className="mt-3 max-w-3xl text-charcoal/70">A compact index of concrete experiences, design motifs, reveals, food moments, sensory stations, photo moments, weekend ideas, and verify-first wildcards. These are user-facing ideas, not vendor-role filler or planning-infrastructure content.</p>
      <div className="mt-6 flex flex-wrap gap-2">{['Arrival wow moments','Seating experiences','Ceremony reveals','Cocktail surprises','Dinner design','Sensory stations','Photo moments','Food spectacle','Weekend ideas','Verify-first wildcards'].map(filter => <span key={filter} className="rounded-full bg-white px-4 py-2 text-sm font-bold">{filter}</span>)}</div>
    </section>
    <TrendCatalogue />
    <Card><h2 className="font-serif text-3xl">Have a standout idea we should add?</h2><p className="mt-2 text-sm text-charcoal/70">Submit concrete wedding ideas only: guest moments, design motifs, food experiences, reveal ideas, sensory stations, or wildcards. Vendor roles and logistics jobs belong in planner metadata, not this catalogue.</p><TrendSubmitForm /></Card>
  </div>;
}

import shapes from '@/data/seo/editorial_page_shape.json';
import { ORGANIZATION_ID } from '@/lib/site-home';
export const editorialShape = (slug: string) => (shapes as Record<string, typeof shapes['wedding-day-timeline']>)[slug];
export function editorialArticleFields(slug: string) {
  const shape = editorialShape(slug);
  return { author: { '@type': 'Organization', '@id': ORGANIZATION_ID, name: 'Dream Wedding Builder' }, ...(shape ? { datePublished: shape.published, dateModified: shape.updated } : {}), speakable: { '@type': 'SpeakableSpecification', cssSelector: ['.definition', '#guide-faq'] } };
}
export function EditorialEvidence({ slug }: { slug: string }) {
  const shape = editorialShape(slug);
  if (!shape) return null;
  return <footer className="rounded-2xl bg-white p-7 text-sm leading-7">
    <h2 className="font-serif text-3xl">Which sources should I check?</h2>
    {/elopement|destination|courthouse/.test(slug) ? <ul className="list-disc pl-6"><li><a href="https://www.courts.state.md.us/clerks/washington/marriage">Maryland Courts marriage licence instructions</a> illustrate jurisdiction-specific paperwork. Confirm your own location’s requirements with its issuing office.</li><li><a href="https://www.nps.gov/blri/planyourvisit/wedding-permits.htm">National Park Service wedding permits on the Blue Ridge Parkway</a> describe that location’s permission process; other sites have their own conditions.</li></ul> : <p><a href="https://support.microsoft.com/en-us/excel/sort-data-in-a-range-or-table-in-excel">Microsoft’s guide to sorting a range or table in Excel</a> explains sorting records and custom order. Keep related fields together when preparing a guest list, task view or schedule. Your venue and supplier confirmations establish event-specific constraints; this guide does not supply universal capacities or durations.</p>}
    <p>Sources reviewed November 3, 2026. Planning guidance; confirm requirements with the responsible office, venue or supplier.</p>
    <p>By <a href="https://weddingchecklistpdf.com/about">Dream Wedding Builder</a> · Publisher: Dream Wedding Builder, a Spry Labs company · Main site: <a href="https://weddingchecklistpdf.com/">Wedding Checklist PDF</a>.</p>
    <p>Published <time dateTime={shape.published}>{shape.published}</time> · Updated <time dateTime={shape.updated}>{shape.updated}</time></p>
  </footer>;
}

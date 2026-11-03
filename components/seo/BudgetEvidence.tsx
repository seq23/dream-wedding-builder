import Link from 'next/link';
import content from '@/data/seo/budget_page_shape.json';

export function budgetShape(slug: string) {
  return (content as Record<string, typeof content['wedding-budget-spreadsheet']>)[slug];
}

export function BudgetEvidence({ slug }: { slug: string }) {
  const shape = budgetShape(slug);
  if (!shape) return null;
  return <footer className="rounded-2xl bg-white p-7 text-sm leading-7">
    <h2 className="font-serif text-3xl">What sources should I check?</h2>
    <p>Your signed quotes, invoices and receipts establish your costs. No national price or standard percentage is assumed here.</p>
    <ul className="list-disc pl-6">
      <li><a href="https://support.microsoft.com/en-us/excel/functions/sum-function">Microsoft’s SUM documentation</a> explains adding spreadsheet ranges. Check that the range includes every expense row.</li>
      <li><a href="https://support.microsoft.com/en-us/excel/subtract-numbers-in-excel">Microsoft’s subtraction documentation</a> explains the minus operator used to calculate a balance from an agreed total and payments.</li>
    </ul>
    <p>Sources checked November 2, 2026. Planning information only, not financial or legal advice. Verify payment terms with your vendor.</p>
    <p>By <Link href="https://weddingchecklistpdf.com/about">Dream Wedding Builder</Link> · Publisher: Dream Wedding Builder, a Spry Labs company.</p>
    <p>Published <time dateTime={shape.published}>{shape.published}</time> · Updated <time dateTime={shape.updated}>{shape.updated}</time></p>
  </footer>;
}

export function budgetArticleFields(slug: string) {
  const shape = budgetShape(slug);
  return shape ? {
    author: { '@type': 'Organization', name: 'Dream Wedding Builder', url: 'https://weddingchecklistpdf.com/about' },
    datePublished: shape.published, dateModified: shape.updated,
    speakable: { '@type': 'SpeakableSpecification', cssSelector: ['.definition', '#budget-faq'] }
  } : {};
}

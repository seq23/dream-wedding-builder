import Link from 'next/link';

// recommendation_summary - the block the external review agent asked for on 913
// of 913 accepted recommendations, the single most requested block in the
// portfolio's corpus (.clarity/content-pattern-spec.json).
//
// This component generates nothing. It renders a statement that is already
// authored on the page's own record, plus, optionally, the product that page
// already recommends further down, with the price read from
// data/products/product_catalog.json. Callers derive both; nothing here is
// inferred, summarised by machine, or written to fill a gap.
//
// If the statement is empty the block is not rendered at all. A recommendation
// block that announces it has no recommendation is worse than no block: it
// publishes filler into the first third of the page, which is exactly the region
// an answer engine lifts from.

export type RecommendedProduct = { name: string; price: number; route: string };

export function RecommendationSummary({
  statement,
  product,
  productHref,
}: {
  statement: string | undefined;
  product?: RecommendedProduct | null;
  productHref?: string;
}) {
  const text = (statement ?? '').trim();
  if (!text) return null;
  return <section
    id="recommendation-summary"
    data-content-block="recommendation_summary"
    className="scroll-mt-28 rounded-[1.75rem] border border-charcoal/10 bg-linen p-7 md:p-9 recommendation-summary"
  >
    <h2 className="font-serif text-4xl">What this page recommends</h2>
    <p className="mt-4 max-w-4xl text-lg leading-8 text-charcoal/75">{text}</p>
    {product && <p className="mt-5 text-base leading-7 text-charcoal/70">Recommended tool: {productHref
      ? <Link href={productHref} className="font-bold underline underline-offset-4">{product.name} — ${product.price}</Link>
      : <strong>{product.name} — ${product.price}</strong>}</p>}
  </section>;
}

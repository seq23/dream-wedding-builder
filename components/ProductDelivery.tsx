import manifest from '@/product-builds/manifests/download_manifest.json';

// The files, delivery and limits block for the pages that had none (the suite page and the
// three kit pages; promise audit, 27 Nov 2026). The file list is read from the same manifest
// the download route serves, so it cannot name a file the buyer does not get.

const KIND: Record<string, string> = { pdf: 'printable PDF', xlsx: 'editable Excel workbook', csv: 'setup CSV', zip: 'ZIP of the four tools’ PDFs and workbooks' };

export function deliveredFiles(productId: string): { name: string; kind: string }[] {
  const item = manifest.products.find((p) => p.product_id === productId);
  if (!item) throw new Error(`No download manifest entry for ${productId}`);
  return item.files.map((f) => ({ name: f.path, kind: KIND[f.path.split('.').pop() ?? ''] ?? 'file' }));
}

export const PLACE_LIMIT = 'Rules, fees and requirements differ by place and change over time: confirm each one with the office, venue or vendor responsible before you rely on it.';

export function ProductDelivery({ productId, limits }: { productId: string; limits?: string }) {
  const files = deliveredFiles(productId);
  return <section data-testid="product-delivery" className="rounded-[12px] bg-white p-7 md:p-9">
    <h2 className="font-serif text-4xl">What you get, how it arrives, and its limits</h2>
    <h3 className="mt-6 font-bold">The files</h3>
    <ul className="mt-2 grid gap-2 text-sm leading-6">{files.map((f) => <li key={f.name} data-testid="delivered-file" className="[overflow-wrap:anywhere]">{f.name}: {f.kind}</li>)}</ul>
    <h3 className="mt-6 font-bold">How it arrives</h3>
    <p className="mt-2 text-sm leading-6 text-charcoal/70">Once Stripe confirms your payment, the download opens on the order page and a download link is emailed to the address you paid with. The emailed link works for 7 days; after that, ask for a fresh one with the email you bought with.</p>
    <h3 className="mt-6 font-bold">Its limits</h3>
    <p className="mt-2 text-sm leading-6 text-charcoal/70">{limits ? `${limits} ` : ''}An organizing aid, not legal, financial or professional planning advice. {PLACE_LIMIT}</p>
  </section>;
}

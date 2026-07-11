import Image from 'next/image';
import Link from 'next/link';
import type { Product } from '@/lib/products';
import { CheckoutButton } from './CheckoutButton';

const cardImages: Record<string,string> = {
  'seating-chart-maker':'/product-images/merch/seating-chart-maker-card.webp',
  'budget-spreadsheet':'/product-images/merch/budget-spreadsheet-card.webp',
  'timeline-template':'/product-images/merch/timeline-template-card.webp',
  'checklist-pdf':'/product-images/merch/checklist-pdf-card.webp'
};

export function ProductCard({ product, compact=false }: { product: Product; compact?: boolean }) {
  const image = cardImages[product.id] || ('image' in product ? product.image : '');
  return <article className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-charcoal/10 bg-white shadow-[0_18px_50px_rgba(66,54,43,.09)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(66,54,43,.15)]">
    {image && <Link href={product.route} className="relative block aspect-[14/9] overflow-hidden bg-linen"><Image src={image} alt={`${product.name} — $${product.price} one-time`} fill sizes="(max-width:768px) 100vw, (max-width:1200px) 50vw, 25vw" className="object-cover transition duration-500 group-hover:scale-[1.025]"/></Link>}
    <div className="flex flex-1 flex-col p-5 md:p-6">
      <div className="flex items-start justify-between gap-3"><p className="text-[11px] font-bold uppercase tracking-[.2em] text-charcoal/45">Editable wedding tool</p><span className="rounded-full bg-linen px-3 py-1 text-xs font-bold">${product.price}</span></div>
      <h3 className="mt-3 font-serif text-3xl leading-tight"><Link href={product.route}>{product.name}</Link></h3>
      {'headline' in product && <p className="mt-2 font-semibold leading-6">{product.headline}</p>}
      {!compact && 'sub' in product && <p className="mt-3 flex-1 text-sm leading-6 text-charcoal/68">{product.sub}</p>}
      <div className="mt-5 grid gap-3">
        <CheckoutButton sku={product.sku} price={product.price} productName={product.name}/>
        <Link className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-charcoal/15 bg-white px-4 py-3 text-sm font-bold transition hover:bg-linen" href={product.route}>See {product.name} details →</Link>
      </div>
      <p className="mt-3 text-center text-xs text-charcoal/50">One-time purchase • No subscription</p>
    </div>
  </article>;
}

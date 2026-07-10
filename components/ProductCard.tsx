import Image from 'next/image';
import Link from 'next/link';
import type { Product } from '@/lib/products';
import { CheckoutButton } from './CheckoutButton';

export function ProductCard({ product, compact=false }: { product: Product; compact?: boolean }) {
  const image = 'image' in product ? product.image : '';
  return <article className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-charcoal/10 bg-white shadow-soft transition hover:-translate-y-1 hover:shadow-xl">
    {image && <div className="relative aspect-[4/3] overflow-hidden bg-linen"><Image src={image} alt={`${product.name} product preview`} fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-[1.02]"/></div>}
    <div className="flex flex-1 flex-col p-5 md:p-6">
      <p className="text-xs font-bold uppercase tracking-[.22em] text-charcoal/45">Paid wedding tool</p>
      <h3 className="mt-3 font-serif text-3xl leading-tight">{product.name}</h3>
      {'headline' in product && <p className="mt-2 font-semibold">{product.headline}</p>}
      {!compact && 'sub' in product && <p className="mt-3 flex-1 text-sm leading-6 text-charcoal/70">{product.sub}</p>}
      <div className="mt-5 flex items-end justify-between gap-4"><div><span className="font-serif text-4xl">${product.price}</span><p className="text-xs text-charcoal/55">one-time</p></div><Link className="font-bold underline decoration-champagne decoration-4 underline-offset-4" href={product.route}>See details</Link></div>
      {!compact && <div className="mt-4"><CheckoutButton sku={product.sku} price={product.price}/></div>}
    </div>
  </article>;
}

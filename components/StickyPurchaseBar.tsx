import { CheckoutButton } from './CheckoutButton';
export function StickyPurchaseBar({name,sku,price}:{name:string;sku:string;price:number}){
 return <div className="no-print fixed inset-x-0 bottom-14 z-30 border-t border-charcoal/10 bg-white/95 p-3 shadow-[0_-10px_30px_rgba(39,35,31,.12)] backdrop-blur lg:bottom-0"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-charcoal/45">One-time purchase</p><p className="font-serif text-lg">{name} — ${price}</p></div><CheckoutButton sku={sku} price={price} label={`Buy — $${price}`}/></div></div>
}

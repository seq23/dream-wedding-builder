'use client';

import { useEffect, useState } from 'react';
import { CheckoutButton } from './CheckoutButton';

// The bar shows only while none of the page's own buy buttons is on screen (hostile
// review, 10 Nov 2026: on a phone it sat on top of the price and the page's own buy
// button on arrival, so she saw two buy buttons at once).
export function StickyPurchaseBar({name,sku,price}:{name:string;sku:string;price:number}){
 const [show, setShow] = useState(false);
 useEffect(() => {
  const buttons = [...document.querySelectorAll<HTMLElement>('main form[action="/api/checkout"]')].filter(form => !form.closest('[data-testid="sticky-buy-bar"]'));
  if (!buttons.length || typeof IntersectionObserver === 'undefined') { setShow(true); return; }
  const onScreen = new Set<Element>();
  const observer = new IntersectionObserver(entries => {
   for (const entry of entries) { if (entry.isIntersecting) onScreen.add(entry.target); else onScreen.delete(entry.target); }
   setShow(onScreen.size === 0);
  });
  buttons.forEach(button => observer.observe(button));
  return () => observer.disconnect();
 }, []);
 if (!show) return null;
 return <div data-testid="sticky-buy-bar" className="no-print fixed inset-x-0 bottom-14 z-30 border-t border-charcoal/10 bg-white/95 p-3 shadow-[0_-10px_30px_rgba(27,31,59,.12)] backdrop-blur lg:bottom-0"><div className="mx-auto max-w-7xl"><CheckoutButton sku={sku} price={price} label={`Get the ${name} — $${price}`} productName={name}/></div></div>;
}

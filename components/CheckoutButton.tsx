import { ConversionAnalytics } from '@/components/ConversionAnalytics';

// tone="secondary" is the outlined button the design system puts after the one blue
// primary button (the free planner) on the homepage.
export function CheckoutButton({ sku, price, label, productName, tone = 'primary' }: { sku: string; price: number; label?: string; productName?: string; tone?: 'primary' | 'secondary' }) {
  const text = label ?? `Buy ${productName || 'this wedding tool'} — $${price}`;
  return <form action="/api/checkout" method="POST" className="w-full" data-session-recording>
    <ConversionAnalytics />
    <input type="hidden" name="sku" value={sku}/>
    <button className={`inline-flex min-h-12 w-full items-center justify-center rounded-2xl px-5 py-3.5 text-center text-sm font-bold transition duration-200 ${tone === 'secondary' ? 'border-[1.5px] border-midnight bg-white text-midnight hover:bg-ivory' : 'bg-charcoal text-linen shadow-sm hover:-translate-y-0.5'} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal sm:text-base`} type="submit">
      {text}<span aria-hidden="true" className="ml-2">→</span>
    </button>
  </form>;
}

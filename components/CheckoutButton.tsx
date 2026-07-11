export function CheckoutButton({ sku, price, label, productName }: { sku: string; price: number; label?: string; productName?: string }) {
  const text = label ?? `Buy ${productName || 'this wedding tool'} — $${price}`;
  return <form action="/api/checkout" method="POST" className="w-full">
    <input type="hidden" name="sku" value={sku}/>
    <button className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-charcoal px-5 py-3.5 text-center text-sm font-bold text-linen shadow-[0_8px_20px_rgba(39,35,31,.16)] transition duration-200 hover:-translate-y-0.5 hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal sm:text-base" type="submit">
      {text}<span aria-hidden="true" className="ml-2">→</span>
    </button>
  </form>;
}

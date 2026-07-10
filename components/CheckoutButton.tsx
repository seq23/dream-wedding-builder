export function CheckoutButton({ sku, price, label }: { sku: string; price: number; label?: string }) {
  return <form action="/api/checkout" method="POST">
    <input type="hidden" name="sku" value={sku}/>
    <button className="inline-flex w-full items-center justify-center rounded-full bg-charcoal px-6 py-4 text-center font-bold text-linen transition hover:-translate-y-0.5 hover:bg-charcoal/90 sm:w-auto" type="submit">
      {label ?? `Buy now — $${price}`}
    </button>
  </form>;
}

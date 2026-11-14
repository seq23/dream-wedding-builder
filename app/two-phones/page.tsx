'use client';
import { useState } from 'react';
/** The iPhone app's store page (App Store Connect app 6834891267). Android: added when the Play listing exists. */
const APP_STORE_URL = 'https://apps.apple.com/app/id6834891267';
/** The fragment is read on this device only, and never fetched or logged. */
export default function PartnerInvite() {
  const [error, setError] = useState('');
  function open() {
    const url = new URL(window.location.href);
    const id = url.searchParams.get('id') ?? '', key = url.hash.slice(1);
    if (!/^[a-f0-9]{64}$/.test(id) || !/^[a-f0-9]{64}$/.test(key)) {
      setError('Shared plan unavailable. Ask your partner for a new link.'); return;
    }
    window.location.href = `dreamwedding://two-phones?id=${id}#${key}`;
  }
  return <article data-testid="two-phones-page" className="mx-auto max-w-md rounded-[12px] bg-linen p-6 text-center md:p-10">
    <h1 className="font-serif text-4xl">Join this plan</h1>
    <p className="mt-4 leading-7">Open the Dream Wedding phone app to see your partner’s plan before you join. No account, and nothing more to pay.</p>
    <button type="button" onClick={open} className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-blue px-6 py-3 font-bold text-white">Open Dream Wedding</button>
    {error ? <p role="alert" className="mt-4 font-bold leading-7">{error}</p> : null}
    <p className="mt-4 text-sm leading-6 text-charcoal/70">No app yet? Get it free, then open this same link again.</p>
    <a href={APP_STORE_URL} data-testid="two-phones-app-store" className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-xl border-[1.5px] border-midnight bg-white px-6 py-3 font-bold">Get it on the App Store</a>
    <a href="/" className="mt-6 inline-flex min-h-12 items-center underline">Back to Dream Wedding</a>
  </article>;
}

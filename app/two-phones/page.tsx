'use client';
import { useState } from 'react';
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
  return <main style={{maxWidth:430, margin:'4rem auto',padding:24}}><h1>Join this plan</h1><p>Open the Dream Wedding phone app to review your partner’s plan before joining. No account and nothing more to pay.</p><button type="button" onClick={open}>Open Dream Wedding</button><p>If the app does not open, install it first and open this same link again.</p>{error ? <p role="alert">{error}</p> : null}<a href="/">Back to Dream Wedding</a></main>;
}

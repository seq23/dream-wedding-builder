'use client';

import { useLayoutEffect } from 'react';

type RecordingWindow = Window & { clarity?: (command: 'start' | 'stop') => void };

function syncRecording() {
  const command = document.querySelector('form[data-session-recording]') ? 'start' : 'stop';
  (window as RecordingWindow).clarity?.(command);
}

// Mount only inside a public signup, submission or checkout form. The form, not
// a second list of routes, determines where session recording is useful.
//
// The loader is a PLAIN <script defer>, rendered into the server HTML, not
// next/script. `strategy="afterInteractive"` injects the tag from the client
// after hydration, so the served HTML carried nothing but a preload link, and a
// preload does not execute: it only warms the cache for a fetch that something
// else has to ask for. Every form and buy page on all four hosts was in that
// state (Search Readiness e6/i8, 31 Oct 2026 - /products/budget-spreadsheet,
// /products/seating-chart-maker, /products/timeline-template and eight
// weddingchecklistpdf.com pages each served <link rel=preload> and no script -
// 11 conversion pages in all, which is what the build-time gate now counts),
// which is also why the first seconds of a session were never recorded even
// when hydration did eventually inject it - and "visitors leave in 14 seconds"
// is the whole reason the item exists. `defer` keeps the loader after parsing,
// so the form it gates on is in the DOM when it runs; `async` could beat the
// form into the document and silently early-return.
//
// Re-entry is safe and deliberate: the loader starts the SDK at most once per
// page and only restarts it, so several conversion forms on one page (a shop
// listing, the homepage) are fine. The useLayoutEffect below stays for
// client-side navigation, where React inserts the tag into a live document.
export function ConversionAnalytics() {
  useLayoutEffect(() => {
    syncRecording();
    return () => {
      // Removing a script cannot unload an SDK. Stop before Next replaces the
      // page, then resume only if another conversion form survives the commit.
      (window as RecordingWindow).clarity?.('stop');
      queueMicrotask(syncRecording);
    };
  }, []);

  return <script defer src="/assets/clarity-loader.js" data-conversion-recording="" />;
}

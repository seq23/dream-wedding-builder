'use client';

import Script from 'next/script';
import { useLayoutEffect } from 'react';

type RecordingWindow = Window & { clarity?: (command: 'start' | 'stop') => void };

function syncRecording() {
  const command = document.querySelector('form[data-session-recording]') ? 'start' : 'stop';
  (window as RecordingWindow).clarity?.(command);
}

// Mount only inside a public signup, submission or checkout form. The form, not
// a second list of routes, determines where session recording is useful.
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

  return <>
    <link rel="preload" as="script" href="/assets/clarity-loader.js" />
    <Script id="conversion-recording" src="/assets/clarity-loader.js" strategy="afterInteractive" onReady={syncRecording} />
  </>;
}

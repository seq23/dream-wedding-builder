#!/usr/bin/env node
// Replays volume, not simultaneous traffic. Remote requests are paced below the
// shared caller's 120/minute limit; no forged forwarding headers or paid API.
import { pathToFileURL } from 'node:url';

export function previewOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.workers.dev') || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw Error('Use an isolated workers.dev preview origin.');
  }
  return url.origin;
}

export async function replayAppDay({ origin, fetcher = fetch, pause = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  origin = previewOrigin(origin);
  let opens = 0; let writes = 0; let id; let revision = 1;
  const ciphertext = Buffer.alloc(24000, 17).toString('base64'); // synthetic opaque fixture, no paid text
  async function call(method, expected, body) {
    // A single CI caller stays below the per-IP ceiling, including cleanup.
    await pause(550);
    const response = await fetcher(`${origin}/api/plan-share${id ? `?id=${id}` : ''}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { 'content-type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status !== expected) throw Error(`Expected ${expected}, received ${response.status}; opens=${opens}, writes=${writes}`);
    const data = await response.json();
    return data;
  }
  try {
    const created = await call('POST', 201, { ciphertext }); writes++;
    if (!/^[a-f0-9]{64}$/.test(created.id) || created.revision !== 1) throw Error('Invalid create response.');
    id = created.id;
    // Includes the initial create: exactly 1,000 ciphertext writes, 3,000 opens.
    for (let i = 0; i < 3000; i++) {
      const plan = await call('GET', 200); opens++;
      if (plan.ciphertext !== ciphertext || plan.revision !== revision) throw Error('Plan read lost content or revision.');
      if (i < 999) {
        const updated = await call('PUT', 200, { ciphertext, revision }); writes++;
        if (updated.revision !== revision + 1) throw Error('Plan write lost its revision.');
        revision++;
      }
    }
    return { opens, writes };
  } finally {
    if (id) {
      await call('DELETE', 200);
      await call('GET', 404);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.env.APP_LOAD_PREVIEW_ORIGIN) throw Error('APP_LOAD_PREVIEW_ORIGIN is missing; nothing was checked.');
    const result = await replayAppDay({ origin: process.env.APP_LOAD_PREVIEW_ORIGIN });
    console.log(`LOAD_APP_DAY PASS opens=${result.opens} writes=${result.writes} cleanup=confirmed`);
  } catch (error) {
    console.error(`NAMED STOP [APP_DAY_LOAD_FAILED] ${error.message}`);
    process.exitCode = 1;
  }
}

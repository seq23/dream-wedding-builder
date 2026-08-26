#!/usr/bin/env node
import fs from 'node:fs';

// An IndexNow key is not a secret. The protocol verifies ownership by requiring
// the same value to be readable at https://<host>/<key>.txt, so the key is
// public by construction. Treating it as a secret is what kept this lane dead:
// INDEXNOW_KEY was never set, so every run recorded
// status DRY_RUN_OR_NOT_CONFIGURED with submitted_url_count 0 while
// prepared_url_count sat at 19-34 per domain. The receipts looked like work.
// The key now lives in public/indexnow-key.txt and is published at
// public/<key>.txt, which Next serves at the root of every host this Worker
// answers for. INDEXNOW_KEY still wins when set, for rotation.
function keyFromFile() {
  try {
    const value = fs.readFileSync('public/indexnow-key.txt', 'utf8').trim();
    return /^[A-Za-z0-9-]{8,128}$/.test(value) ? value : '';
  } catch {
    return '';
  }
}

const key = (process.env.INDEXNOW_KEY || '').trim() || keyFromFile();
const mode = process.env.RUN_MODE || 'dry_run';
const m = JSON.parse(fs.readFileSync('artifacts/distribution/manifest.json', 'utf8'));
const receipts = [];

for (const d of m.domains) {
  const urls = fs.readFileSync(d.url_file, 'utf8').split(/\r?\n/).filter(Boolean);
  let status = key && mode === 'live' ? 'READY' : 'DRY_RUN_OR_NOT_CONFIGURED';
  let http_status = null;
  let error = null;
  if (key && mode === 'live') {
    try {
      const r = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ host: d.host, key, keyLocation: `https://${d.host}/${key}.txt`, urlList: urls.slice(0, 10000) })
      });
      http_status = r.status;
      if (![200, 202].includes(r.status)) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 500)}`);
      status = 'SUBMITTED';
    } catch (e) {
      status = 'SOURCE_ERROR';
      error = e.message;
      process.exitCode = 1;
    }
  }
  receipts.push({
    provider: 'IndexNow',
    host: d.host,
    mode,
    status,
    http_status,
    error,
    key_source: process.env.INDEXNOW_KEY ? 'env' : key ? 'public/indexnow-key.txt' : 'none',
    prepared_url_count: urls.length,
    submitted_url_count: status === 'SUBMITTED' ? urls.length : 0,
    submitted_at: new Date().toISOString(),
    claims_indexed: false,
    citation_proof: false
  });
}

fs.writeFileSync(
  'artifacts/distribution/indexnow-receipts.json',
  JSON.stringify({ receipts, truth_note: 'Receipt proves submission only.' }, null, 2) + '\n'
);
console.log(JSON.stringify(receipts, null, 2));

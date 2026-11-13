#!/usr/bin/env node
/**
 * Upload packaged paid products to the private R2 bucket, behind the file checks.
 *
 *   npm run release:upload -- --check              # run the checks on the exact files, upload nothing
 *   npm run release:upload -- checklist-pdf        # check, then upload that product
 *   npm run release:upload -- checklist-pdf --local  # into wrangler's local R2 (for proof:fulfillment)
 *
 * The files are private (DW_PRODUCTS_DIR, scripts/lib/products-dir.mjs). The gate is
 * `validate-downloads.mjs --require-files`: every file present, checksums equal to
 * the committed manifests, file types, sizes, formula counts. Any failure uploads
 * nothing. A product must be named: this replaces what paying customers receive.
 *
 * Stops: [PRODUCTS_DIR_MISSING] no private folder; [PRODUCT_FILES_UNSAFE] a check
 * failed; [NO_PRODUCT_NAMED] nothing to upload; [UPLOAD_FAILED] wrangler refused.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { requireProductsDir } from '../lib/products-dir.mjs';

const PRODUCTS_DIR = requireProductsDir('release:upload');
const args = process.argv.slice(2);
const ids = args.filter((a) => !a.startsWith('--'));
const target = args.includes('--local') ? '--local' : '--remote';

const gate = spawnSync(process.execPath, ['scripts/validate-downloads.mjs', '--require-files'], { stdio: 'inherit' });
if (gate.status !== 0) {
  console.error('[PRODUCT_FILES_UNSAFE] release:upload: the file checks failed (above). Nothing was uploaded.');
  process.exit(1);
}
if (args.includes('--check')) {
  console.log('release:upload --check: the exact files passed. Nothing was uploaded.');
  process.exit(0);
}

const manifest = JSON.parse(fs.readFileSync('product-builds/r2/release_manifest.json', 'utf8'));
const known = new Map(manifest.releases.map((r) => [r.product_id, r]));
const unknown = ids.filter((id) => !known.has(id));
if (!ids.length || unknown.length) {
  console.error(`[NO_PRODUCT_NAMED] release:upload: ${unknown.length ? `unknown product ${unknown.join(', ')}` : 'name the product to upload'}. One of: ${[...known.keys()].join(', ')}. Nothing was uploaded.`);
  process.exit(1);
}

for (const id of ids) {
  const release = known.get(id);
  const file = path.join(PRODUCTS_DIR, release.local_path);
  const put = spawnSync('npx', ['wrangler', 'r2', 'object', 'put', `${release.bucket}/${release.r2_key}`, `--file=${file}`, target], { stdio: 'inherit' });
  if (put.status !== 0) {
    console.error(`[UPLOAD_FAILED] release:upload: wrangler did not upload ${release.r2_key}. Products after it were not attempted.`);
    process.exit(1);
  }
  console.log(`OUTPUT uploaded ${release.r2_key} (${release.bytes} bytes, sha256 ${release.sha256}) ${target}`);
}

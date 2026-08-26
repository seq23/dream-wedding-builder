#!/usr/bin/env node
/**
 * Package the committed canonical product files into the exact R2 objects that the
 * paid download route reads.
 *
 * The gap this closes: `lib/fulfillment.js releaseKeyForSku()` points every
 * entitlement at `products/<product-id>/current.zip` in the private
 * PRODUCT_RELEASES bucket, and `app/api/download/[token]/route.ts` serves that key
 * verbatim. Nothing in the repo produced that object. `product-builds/releases`
 * holds loose per-SKU PDF/XLSX/CSV files under versioned names, so a paid customer
 * with a valid entitlement and a valid signed token still received
 * HTTP 404 "Product release is not available yet".
 *
 * Output: product-builds/r2/products/<product-id>/current.zip, plus a
 * release_manifest.json recording the bytes and digests actually shipped.
 *
 * Writes ZIP archives with no third-party dependency, using a fixed timestamp so
 * repeated runs over unchanged inputs produce byte-identical archives.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { deflateRawSync } from 'node:zlib';

const ROOT = process.cwd();
const MANIFEST = path.join(ROOT, 'product-builds/manifests/download_manifest.json');
const RELEASE_DIR = path.join(ROOT, 'product-builds/releases');
const OUT_ROOT = path.join(ROOT, 'product-builds/r2');
const BUCKET = 'dream-wedding-builder-products';

// Fixed DOS timestamp (1980-01-01 00:00:00) keeps archives reproducible.
const DOS_TIME = 0;
const DOS_DATE = 33;

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function buildZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const raw = entry.data;
    const deflated = deflateRawSync(raw, { level: 9 });
    // Only use deflate when it actually wins; otherwise store.
    const useDeflate = deflated.length < raw.length;
    const body = useDeflate ? deflated : raw;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + body.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, centralBuf, eocd]);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const packaged = [];

for (const product of manifest.products) {
  if (!product.files?.length) throw new Error(`No files declared for ${product.sku}`);

  const entries = [];
  for (const file of product.files) {
    const source = path.join(RELEASE_DIR, file.path);
    if (!fs.existsSync(source)) throw new Error(`Missing canonical download ${source}`);
    const data = fs.readFileSync(source);
    const digest = crypto.createHash('sha256').update(data).digest('hex');
    if (digest !== file.sha256) {
      throw new Error(`Checksum mismatch for ${file.path}: manifest ${file.sha256}, actual ${digest}`);
    }
    entries.push({ name: file.path, data });
  }

  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const zip = buildZip(entries);

  const key = `products/${product.product_id}/current.zip`;
  const target = path.join(OUT_ROOT, key);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, zip);

  packaged.push({
    product_id: product.product_id,
    sku: product.sku,
    version: product.version,
    r2_key: key,
    bucket: BUCKET,
    local_path: path.relative(ROOT, target),
    bytes: zip.length,
    sha256: crypto.createHash('sha256').update(zip).digest('hex'),
    file_count: entries.length,
    files: entries.map((e) => e.name)
  });

  console.log(`packaged ${key}  (${entries.length} files, ${zip.length} bytes)`);
}

const outManifest = {
  generated_from: 'product-builds/manifests/download_manifest.json',
  manifest_version: manifest.version,
  bucket: BUCKET,
  note: 'These objects are what app/api/download/[token]/route.ts serves. Upload them before selling.',
  releases: packaged
};
fs.writeFileSync(path.join(OUT_ROOT, 'release_manifest.json'), `${JSON.stringify(outManifest, null, 2)}\n`);

console.log(`\n${packaged.length} release objects written to product-builds/r2/`);
console.log('\nUpload with:');
for (const release of packaged) {
  console.log(`  npx wrangler r2 object put ${BUCKET}/${release.r2_key} --file=${release.local_path} --remote`);
}

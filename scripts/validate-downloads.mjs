// Paid customers must receive the file they bought.
//
// The product files are private (scripts/lib/products-dir.mjs). Two layers:
//  1. Always (CI included): the public contract in the two committed manifests -
//     every catalog product has files and a packaged R2 release under the key
//     lib/fulfillment.ts serves.
//  2. Where the private folder exists, and always with --require-files (the upload
//     gate): the exact files - present, checksums, file type, size, packaged zips
//     match the release manifest, advertised formula counts are real.
// Without the folder, layer 2 is reported as NOT READ, never as passed.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { countFormulas } from './lib/xlsx-formula-count.mjs';
import { PRODUCTS_DIR, RELEASE_DIR, productsDirPresent, requireProductsDir } from './lib/products-dir.mjs';

const requireFiles=process.argv.includes('--require-files');
if(requireFiles) requireProductsDir('validate:downloads --require-files');
const readFiles=productsDirPresent();
const HEX64=/^[a-f0-9]{64}$/;

const m=JSON.parse(fs.readFileSync('product-builds/manifests/download_manifest.json','utf8'));
if(!m.products?.length) throw new Error('download_manifest.json lists no products - refusing to pass having examined nothing');
for(const item of m.products){
  if(!item.files?.length) throw new Error(`No files for ${item.sku}`);
  for(const f of item.files){
    if(!HEX64.test(f.sha256||'')) throw new Error(`No SHA-256 recorded for ${f.path}`);
    if(!f.content_type) throw new Error(`No content type recorded for ${f.path}`);
    if(!readFiles) continue;
    const p=path.join(RELEASE_DIR,f.path);
    if(!fs.existsSync(p)) throw new Error(`Missing canonical download ${p}`);
    const bytes=fs.readFileSync(p);
    const digest=crypto.createHash('sha256').update(bytes).digest('hex');
    if(digest!==f.sha256) throw new Error(`Checksum mismatch: ${p}`);
    if(f.content_type==='application/pdf' && !bytes.subarray(0,5).toString().startsWith('%PDF')) throw new Error(`Invalid PDF: ${p}`);
    if(f.content_type==='application/zip' && bytes.subarray(0,2).toString()!=='PK') throw new Error(`Invalid ZIP: ${p}`);
    if(f.content_type.includes('spreadsheet') && bytes.subarray(0,2).toString()!=='PK') throw new Error(`Invalid XLSX: ${p}`);
    if(bytes.length<40) throw new Error(`Suspiciously small product file: ${p}`);
  }
}
// Every sellable product must have a downloadable file. A product added to the
// catalog without a manifest entry sells a file that does not exist.
const catalog=JSON.parse(fs.readFileSync('data/products/product_catalog.json','utf8'));
const manifestIds=new Set(m.products.map(p=>p.product_id));
for(const product of catalog.products){
  if(!manifestIds.has(product.id)) throw new Error(`Catalog product "${product.id}" (${product.sku}) has no entry in download_manifest.json, so a paid customer would have nothing to receive`);
}

// The download route serves products/<product-id>/current.zip from R2 and nothing
// else. Verifying the loose source files alone left that key unchecked, which is
// how a valid entitlement could still resolve to a 404. Require the packaged
// objects to be recorded, and where the files are present, to match the record.
const releaseManifestPath='product-builds/r2/release_manifest.json';
if(!fs.existsSync(releaseManifestPath)) throw new Error('Missing product-builds/r2/release_manifest.json. Run: npm run release:package');
const rm=JSON.parse(fs.readFileSync(releaseManifestPath,'utf8'));
const packagedIds=new Set(rm.releases.map(r=>r.product_id));
for(const product of catalog.products){
  if(!packagedIds.has(product.id)) throw new Error(`No packaged R2 release for "${product.id}". Run: npm run release:package`);
}
for(const release of rm.releases){
  if(release.r2_key!==`products/${release.product_id}/current.zip`) throw new Error(`Release key drift for ${release.product_id}: ${release.r2_key} does not match the key lib/fulfillment.ts derives`);
  if(release.local_path!==`product-builds/r2/${release.r2_key}`) throw new Error(`Release path drift for ${release.product_id}: ${release.local_path}`);
  if(!HEX64.test(release.sha256||'')) throw new Error(`No SHA-256 recorded for the packaged release of ${release.product_id}`);
  if(!readFiles) continue;
  const local=path.join(PRODUCTS_DIR,release.local_path);
  if(!fs.existsSync(local)) throw new Error(`Packaged release missing on disk: ${local}. Run: npm run release:package`);
  const bytes=fs.readFileSync(local);
  const digest=crypto.createHash('sha256').update(bytes).digest('hex');
  if(digest!==release.sha256) throw new Error(`Packaged release ${local} is stale or modified. Run: npm run release:package`);
  if(bytes.subarray(0,2).toString()!=='PK') throw new Error(`Packaged release is not a ZIP archive: ${local}`);
}

// The product page renders "<n> built-in formulas" only when formula_count > 0 and
// states the number comes from the canonical release. Hold the catalog to that.
const byId=new Map(catalog.products.map(p=>[p.id,p]));
let formulaChecks=0;
if(readFiles) for(const item of m.products){
  const workbook=item.files.find(f=>f.path.endsWith('.xlsx'));
  const product=byId.get(item.product_id);
  if(!workbook||!product?.inventory) continue;
  const actual=countFormulas(path.join(RELEASE_DIR,workbook.path));
  const claimed=product.inventory.formula_count;
  if(actual!==claimed) throw new Error(`${item.product_id} advertises ${claimed} built-in formulas but the shipped workbook ${workbook.path} contains ${actual}`);
  formulaChecks++;
}

const fileCount=m.products.reduce((n,p)=>n+p.files.length,0);
if(readFiles) console.log(`canonical downloads: PASS (${fileCount} files, ${rm.releases.length} packaged R2 releases, ${formulaChecks} formula counts matched; files read from ${PRODUCTS_DIR})`);
else console.log(`canonical downloads: manifests PASS (${fileCount} files and ${rm.releases.length} R2 releases recorded for ${catalog.products.length} catalog products). PRODUCT FILES NOT READ: the private folder ${PRODUCTS_DIR} is not here, so checksums, file types and formula counts were not checked. They are checked on the exact files by npm run release:upload.`);

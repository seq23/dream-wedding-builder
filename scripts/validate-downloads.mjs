import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const m=JSON.parse(fs.readFileSync('product-builds/manifests/download_manifest.json','utf8'));
for(const item of m.products){
  if(!item.files?.length) throw new Error(`No files for ${item.sku}`);
  for(const f of item.files){
    const p=path.join('product-builds/releases',f.path);
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
// objects to exist and to match what the packager recorded.
const releaseManifestPath='product-builds/r2/release_manifest.json';
if(!fs.existsSync(releaseManifestPath)) throw new Error('Missing product-builds/r2/release_manifest.json. Run: npm run release:package');
const rm=JSON.parse(fs.readFileSync(releaseManifestPath,'utf8'));
const packagedIds=new Set(rm.releases.map(r=>r.product_id));
for(const product of catalog.products){
  if(!packagedIds.has(product.id)) throw new Error(`No packaged R2 release for "${product.id}". Run: npm run release:package`);
}
for(const release of rm.releases){
  if(release.r2_key!==`products/${release.product_id}/current.zip`) throw new Error(`Release key drift for ${release.product_id}: ${release.r2_key} does not match the key lib/fulfillment.ts derives`);
  if(!fs.existsSync(release.local_path)) throw new Error(`Packaged release missing on disk: ${release.local_path}. Run: npm run release:package`);
  const bytes=fs.readFileSync(release.local_path);
  const digest=crypto.createHash('sha256').update(bytes).digest('hex');
  if(digest!==release.sha256) throw new Error(`Packaged release ${release.local_path} is stale or modified. Run: npm run release:package`);
  if(bytes.subarray(0,2).toString()!=='PK') throw new Error(`Packaged release is not a ZIP archive: ${release.local_path}`);
}

console.log(`canonical downloads: PASS (${m.products.reduce((n,p)=>n+p.files.length,0)} files, ${rm.releases.length} packaged R2 releases)`);

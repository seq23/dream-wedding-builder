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
console.log(`canonical downloads: PASS (${m.products.reduce((n,p)=>n+p.files.length,0)} files)`);

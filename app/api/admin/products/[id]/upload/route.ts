import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { readCatalog, saveCatalog, writeReceipt, saveBinaryToPrivateGitHub } from '@/lib/admin-store';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { checkUpload, safePathPart, UPLOAD_MAX_BYTES } from '@/lib/upload-check';

function safeName(name:string){ return path.basename(name).replace(/[^a-zA-Z0-9._-]/g,'-'); }
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 if(!await requireAdmin()) return NextResponse.json({error:'Unauthorized'},{status:401});
 // A declared body past the cap is refused before it is read; the real size is checked again from the bytes.
 if(Number(req.headers.get('content-length')||0)>UPLOAD_MAX_BYTES+1024*1024)return NextResponse.json({error:'File exceeds 50 MB limit'},{status:413});
 const {id}=await params; const catalog=await readCatalog(); const index=catalog.products.findIndex((p:any)=>p.id===id); if(index<0)return NextResponse.json({error:'Product not found'},{status:404});
 const product:any=catalog.products[index]; const form=await req.formData(); const file=form.get('file'); const kind=String(form.get('kind')||'release'); const version=String(form.get('version')||new Date().toISOString().slice(0,10));
 if(!(file instanceof File))return NextResponse.json({error:'File is required'},{status:400}); const ext=path.extname(file.name).toLowerCase();
 if(!safePathPart(kind)||!safePathPart(version))return NextResponse.json({error:'Version and kind may use only letters, digits, dot, dash and underscore'},{status:400});
 const bytes=Buffer.from(await file.arrayBuffer()); const verdict=await checkUpload(ext,bytes); if(!verdict.ok)return NextResponse.json({error:verdict.error},{status:verdict.status});
 const sha256=crypto.createHash('sha256').update(bytes).digest('hex'); const filename=safeName(file.name); const rel=`product-source/uploads/${id}/${version}/${kind}/${filename}`;
 let storage='local';
 if(process.env.NODE_ENV==='production'){
   if(process.env.ADMIN_BINARY_STORAGE_MODE!=='github-private') return NextResponse.json({error:'Set ADMIN_BINARY_STORAGE_MODE=github-private with a confirmed private repository, or connect the R2 binding.'},{status:501});
   await saveBinaryToPrivateGitHub(rel,bytes,`admin(product): upload ${product.sku} ${version} ${filename}`); storage='github-private';
 } else { const target=path.join(process.cwd(),rel); await fs.mkdir(path.dirname(target),{recursive:true}); await fs.writeFile(target,bytes); }
 const release={version,kind,filename,path:rel,size:bytes.byteLength,sha256,storage,uploaded_at:new Date().toISOString(),status:'STAGED'};
 product.releases=[...(product.releases||[]),release]; product.current_release=version; catalog.products[index]=product; await saveCatalog(catalog,`stage release ${product.sku} ${version}`);
 const receipt=await writeReceipt({action:'UPLOAD_PRODUCT_FILE',product_id:id,file:rel,size:bytes.byteLength,sha256,kind,version,storage,prior_state:product.status||'DRAFT',new_state:product.status||'DRAFT'});
 return NextResponse.json({ok:true,release,receipt});
}

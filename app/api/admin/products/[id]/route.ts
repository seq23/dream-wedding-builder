import { NextResponse } from 'next/server'; import { requireAdmin } from '@/lib/admin-auth'; import { readCatalog, saveCatalog, validateProduct, writeReceipt } from '@/lib/admin-store';
const allowedStates=['DRAFT','ACTIVE','PAUSED','REVOKED','ARCHIVED'];
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 if(!await requireAdmin())return NextResponse.json({error:'Unauthorized'},{status:401}); const {id}=await params; const patch=await req.json(); const catalog=await readCatalog(); const index=catalog.products.findIndex((p:any)=>p.id===id); if(index<0)return NextResponse.json({error:'Not found'},{status:404});
 const before=catalog.products[index]; const next={...before,...patch,id:before.id,sku:patch.sku||before.sku}; if(next.status&&!allowedStates.includes(next.status))return NextResponse.json({error:'Invalid state'},{status:400}); const errors=validateProduct(next,catalog.products.filter((_:any,i:number)=>i!==index)); if(errors.length)return NextResponse.json({errors},{status:400});
 catalog.products[index]=next; await saveCatalog(catalog,`edit ${before.sku}`); const receipt=await writeReceipt({action:'EDIT_PRODUCT',product_id:id,prior_state:before.status||'ACTIVE',new_state:next.status||'ACTIVE',changed_fields:Object.keys(patch)}); return NextResponse.json({product:next,receipt});
}
export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){
 if(!await requireAdmin())return NextResponse.json({error:'Unauthorized'},{status:401}); const {id}=await params; const catalog=await readCatalog(); const p=catalog.products.find((x:any)=>x.id===id); if(!p)return NextResponse.json({error:'Not found'},{status:404}); if((p.status||'ACTIVE')!=='DRAFT')return NextResponse.json({error:'Only unused draft products may be permanently deleted'},{status:409});
 catalog.products=catalog.products.filter((x:any)=>x.id!==id); await saveCatalog(catalog,`delete draft ${p.sku}`); const receipt=await writeReceipt({action:'DELETE_DRAFT',product_id:id,prior_state:'DRAFT',new_state:'DELETED'}); return NextResponse.json({ok:true,receipt});
}

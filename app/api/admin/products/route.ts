import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { readCatalog, saveCatalog, validateProduct, writeReceipt } from '@/lib/admin-store';
export async function GET(){ if(!await requireAdmin()) return NextResponse.json({error:'Unauthorized'},{status:401}); return NextResponse.json(await readCatalog()); }
export async function POST(req:Request){
 if(!await requireAdmin()) return NextResponse.json({error:'Unauthorized'},{status:401});
 const body=await req.json(); const catalog=await readCatalog(); const product={status:'DRAFT',features:[],keywords:[],...body}; const errors=validateProduct(product,catalog.products); if(errors.length)return NextResponse.json({errors},{status:400});
 catalog.products.push(product); catalog.version=String(Number(catalog.version.split('.')[0]||0)+1)+'.0.0'; await saveCatalog(catalog,`add ${product.sku}`); const receipt=await writeReceipt({action:'ADD_PRODUCT',product_id:product.id,new_state:'DRAFT'}); return NextResponse.json({product,receipt},{status:201});
}

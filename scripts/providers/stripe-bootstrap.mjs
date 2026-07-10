import fs from 'node:fs';
const key=process.env.STRIPE_SECRET_KEY||''; const mode=process.env.STRIPE_MODE||'';
if(!['test','live'].includes(mode)) throw new Error('STRIPE_MODE must be test or live');
if(mode==='test'&&!key.startsWith('sk_test_')) throw new Error('Stripe test mode/key mismatch');
if(mode==='live'&&!key.startsWith('sk_live_')) throw new Error('Stripe live mode/key mismatch');
const catalog=JSON.parse(fs.readFileSync('data/products/product_catalog.json','utf8'));
const api=async(path,body)=>{const r=await fetch(`https://api.stripe.com/v1/${path}`,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body)});const j=await r.json();if(!r.ok)throw new Error(j?.error?.message||`Stripe ${path} failed`);return j};
const get=async(path)=>{const r=await fetch(`https://api.stripe.com/v1/${path}`,{headers:{Authorization:`Bearer ${key}`}});const j=await r.json();if(!r.ok)throw new Error(j?.error?.message||`Stripe ${path} failed`);return j};
const registry={mode,generated_at:new Date().toISOString(),products:{}};
for(const p of catalog.products){
 const q=encodeURIComponent(`metadata['dwb_product_id']:'${p.id}'`); const search=await get(`products/search?query=${q}`); let product=search.data?.[0]; const reusedProduct=Boolean(product);
 if(!product) product=await api('products',{name:p.name,description:p.sub||p.headline||p.name,'metadata[dwb_product_id]':p.id,'metadata[sku]':p.sku});
 const prices=await get(`prices?product=${encodeURIComponent(product.id)}&active=true&limit=100`); const cents=Math.round(Number(p.price)*100); let price=prices.data?.find(x=>x.unit_amount===cents&&x.currency==='usd'&&x.type==='one_time'); const reusedPrice=Boolean(price);
 if(!price) price=await api('prices',{product:product.id,unit_amount:String(cents),currency:'usd',lookup_key:`dwb_${p.id}_${mode}`,'metadata[dwb_product_id]':p.id});
 registry.products[p.id]={sku:p.sku,product_id:product.id,price_id:price.id,amount_cents:cents,reused_product:reusedProduct,reused_price:reusedPrice};
}
fs.mkdirSync('artifacts/providers',{recursive:true});fs.writeFileSync(`artifacts/providers/stripe-${mode}-registry.json`,JSON.stringify(registry,null,2));console.log(JSON.stringify(registry,null,2));

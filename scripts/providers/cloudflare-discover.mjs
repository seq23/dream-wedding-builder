const token=process.env.CLOUDFLARE_API_TOKEN; const account=process.env.CF_ACCOUNT_ID||process.env.CLOUDFLARE_ACCOUNT_ID;
if(!token||!account) throw new Error('Set CLOUDFLARE_API_TOKEN and CF_ACCOUNT_ID in the current shell');
const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
async function cf(path){const r=await fetch(`https://api.cloudflare.com/client/v4${path}`,{headers});const j=await r.json();if(!r.ok||j.success===false)throw new Error(`${path}: ${JSON.stringify(j.errors||j)}`);return j.result}
const pages=await cf(`/accounts/${account}/pages/projects`); const d1=await cf(`/accounts/${account}/d1/database`); const r2=await cf(`/accounts/${account}/r2/buckets`);
const receipt={at:new Date().toISOString(),account_id:account,pages:pages.map(x=>({name:x.name,subdomain:x.subdomain,production_branch:x.production_branch})),d1:d1.map(x=>({name:x.name,uuid:x.uuid})),r2:(r2.buckets||r2).map(x=>({name:x.name,creation_date:x.creation_date}))};
console.log(JSON.stringify(receipt,null,2));

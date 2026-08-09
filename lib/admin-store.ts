import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

type Catalog = { version:string; currency:string; support_email:string; products:any[] };
const catalogPath = path.join(process.cwd(),'data/products/product_catalog.json');
const receiptPath = path.join(process.cwd(),'data/admin/product_action_receipts.json');

async function readJson<T>(file:string, fallback:T):Promise<T>{ try{return JSON.parse(await fs.readFile(file,'utf8'))}catch{return fallback} }
async function writeJson(file:string,value:any){ await fs.mkdir(path.dirname(file),{recursive:true}); await fs.writeFile(file,JSON.stringify(value,null,2)+'\n','utf8'); }

async function githubWrite(pathInRepo:string, value:any, message:string){
 const token=process.env.GITHUB_ADMIN_TOKEN, repo=process.env.GITHUB_REPOSITORY, branch=process.env.GITHUB_DEFAULT_BRANCH||'main';
 if(!token||!repo) throw new Error('GitHub-backed admin storage is not configured');
 const url=`https://api.github.com/repos/${repo}/contents/${pathInRepo}`;
 const headers={Authorization:`Bearer ${token}`,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'};
 const current=await fetch(`${url}?ref=${encodeURIComponent(branch)}`,{headers,cache:'no-store'});
 const currentJson=current.ok?await current.json():null;
 const body={message,content:Buffer.from(JSON.stringify(value,null,2)+'\n').toString('base64'),branch,...(currentJson?.sha?{sha:currentJson.sha}:{})};
 const result=await fetch(url,{method:'PUT',headers,body:JSON.stringify(body)});
 if(!result.ok) throw new Error(`GitHub write failed: ${result.status} ${await result.text()}`);
 return result.json();
}

export async function readCatalog():Promise<Catalog>{ return readJson(catalogPath,{version:'0',currency:'USD',support_email:'info@weddingchecklistpdf.com',products:[]}); }
export async function saveCatalog(catalog:Catalog, action:string){
 if(process.env.ADMIN_STORAGE_MODE==='github') return githubWrite('data/products/product_catalog.json',catalog,`admin(products): ${action}`);
 if(process.env.NODE_ENV==='production') throw new Error('Set ADMIN_STORAGE_MODE=github for deployed product mutations');
 return writeJson(catalogPath,catalog);
}
export async function writeReceipt(input:any){
 const ledger=await readJson<any[]>(receiptPath,[]); const receipt={id:`PROD-${new Date().toISOString().replace(/\D/g,'').slice(0,14)}-${crypto.randomBytes(3).toString('hex')}`,at:new Date().toISOString(),...input};
 ledger.unshift(receipt);
 if(process.env.ADMIN_STORAGE_MODE==='github') await githubWrite('data/admin/product_action_receipts.json',ledger,'admin(receipts): record product action'); else if(process.env.NODE_ENV!=='production') await writeJson(receiptPath,ledger);
 return receipt;
}
export function validateProduct(p:any, existing:any[]){
 const errors:string[]=[];
 for(const k of ['id','sku','name','price','route']) if(!p[k] && p[k]!==0) errors.push(`Missing ${k}`);
 if(typeof p.price!=='number'||p.price<0) errors.push('Price must be a non-negative number');
 if(existing.some(x=>x.id===p.id&&x.sku!==p.sku)) errors.push('Product id already exists with another SKU');
 if(existing.some(x=>x.sku===p.sku&&x.id!==p.id)) errors.push('SKU already exists');
 if(!Array.isArray(p.features)||p.features.length<3) errors.push('At least three deliverables/features are required');
 if(!p.image||!p.hero_image) errors.push('Card and hero imagery are required');
 return errors;
}

export async function assertGitHubRepositoryPrivate(token:string, repo:string){
 const headers={Authorization:`Bearer ${token}`,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
 const result=await fetch(`https://api.github.com/repos/${repo}`,{headers,cache:'no-store'});
 if(!result.ok) throw new Error(`Cannot verify GitHub repository visibility: ${result.status} ${await result.text()}`);
 const metadata=await result.json() as {private?:boolean};
 if(metadata?.private!==true) throw new Error('Refusing paid-product upload because GitHub reports the target repository is not private');
 return true;
}

export async function saveBinaryToPrivateGitHub(pathInRepo:string, bytes:Buffer, message:string){
 const token=process.env.GITHUB_ADMIN_TOKEN, repo=process.env.GITHUB_REPOSITORY, branch=process.env.GITHUB_DEFAULT_BRANCH||'main';
 if(!token||!repo) throw new Error('GitHub-backed binary storage is not configured');
 await assertGitHubRepositoryPrivate(token,repo);
 const url=`https://api.github.com/repos/${repo}/contents/${pathInRepo}`;
 const headers={Authorization:`Bearer ${token}`,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'};
 const current=await fetch(`${url}?ref=${encodeURIComponent(branch)}`,{headers,cache:'no-store'}); const currentJson=current.ok?await current.json():null;
 const body={message,content:bytes.toString('base64'),branch,...(currentJson?.sha?{sha:currentJson.sha}:{})};
 const result=await fetch(url,{method:'PUT',headers,body:JSON.stringify(body)});
 if(!result.ok) throw new Error(`GitHub binary write failed: ${result.status} ${await result.text()}`);
 return result.json();
}

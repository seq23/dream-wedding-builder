#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
const root=process.cwd();
const contentPath=path.join(root,'data/authority/content_registry.json');
const regPath=path.join(root,'data/release/frozen_output_registry.json');
const scopePath=path.join(root,'data/release/active_mutation_scope.json');
const dir=path.join(root,'data/release/frozen_accepted_outputs');
const sortObj=o=>Array.isArray(o)?o.map(sortObj):(o&&typeof o==='object'?Object.fromEntries(Object.keys(o).sort().map(k=>[k,sortObj(o[k])])):o);
const stable=p=>Buffer.from(JSON.stringify(sortObj(p))+'\n');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const norm=r=>{let x=String(r||'').trim();if(!x)return'';if(!x.startsWith('/'))x='/'+x;return x==='/'?'/':x.replace(/\/$/,'');};
const scope=new Set(fs.existsSync(scopePath)?(JSON.parse(fs.readFileSync(scopePath,'utf8')).routes||[]).map(norm):[]);
const pages=JSON.parse(fs.readFileSync(contentPath,'utf8')).pages||[];
const byRoute=new Map(pages.map(p=>['/guides/'+p.slug,p]));
const old=fs.existsSync(regPath)?JSON.parse(fs.readFileSync(regPath,'utf8')):{records:{}};
const unscoped=[];
for(const [route,r] of Object.entries(old.records||{})){
  const p=byRoute.get(route);
  if(!p){if(!scope.has(norm(route)))unscoped.push({route,reason:'accepted_page_removed'});continue;}
  const h=sha(stable(p));
  if(h!==r.sha256&&!scope.has(norm(route)))unscoped.push({route,reason:'accepted_page_changed',before:r.sha256,after:h});
}
if(unscoped.length){console.error(JSON.stringify({error:'UNSCOPED_FROZEN_OUTPUT_DRIFT',count:unscoped.length,sample:unscoped.slice(0,20)},null,2));process.exit(1);}
fs.mkdirSync(dir,{recursive:true});const records={};
for(const p of pages){const raw=stable(p),h=sha(raw),blob=path.join(dir,h+'.json.gz');if(!fs.existsSync(blob))fs.writeFileSync(blob,zlib.gzipSync(raw,{level:9,mtime:0}));records['/guides/'+p.slug]={slug:p.slug,sha256:h,blob:path.relative(root,blob)};}
const keep=new Set(Object.values(records).map(r=>path.basename(r.blob)));for(const n of fs.readdirSync(dir))if(n.endsWith('.json.gz')&&!keep.has(n))fs.rmSync(path.join(dir,n),{force:true});
fs.writeFileSync(regPath,JSON.stringify({schema_version:'1.1',policy:'canonical_authority_content_freeze',source_file:'data/authority/content_registry.json',mutation_scope:'data/release/active_mutation_scope.json',runtime_boundary:'guide content only; application/runtime/user/commerce state excluded',records},null,2)+'\n');
console.log(JSON.stringify({frozen:Object.keys(records).length,authorized_mutation_routes:scope.size,unscoped_drift:0},null,2));

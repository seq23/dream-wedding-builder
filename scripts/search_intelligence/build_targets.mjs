#!/usr/bin/env node
import {read,write,now,norm,idFor} from './lib.mjs';
const seeded=read('data/atlas/query_universe.json',{queries:[]}).queries||[];
const atlas=read('data/authority/atlas.json',{records:[]}).records||[];
const ownership=read('data/seo/route_ownership.json');
const byKey=new Map();
for(const q of seeded){
  const key=norm(q.query); if(!key) continue;
  byKey.set(key,{target_id:idFor(q.query,q.domain_owner,q.route),query:q.query,host:q.domain_owner,route:q.route,product_id:q.product_owner,intent:q.intent||'unknown',priority:q.commercial_value==='high'?'HIGH':'MEDIUM',source:'query_universe'});
}
for(const r of atlas){
  const key=norm(r.query); if(!key||byKey.has(key)) continue;
  byKey.set(key,{target_id:idFor(r.query,r.domain,r.route),query:r.query,host:r.domain,route:r.route,product_id:r.product_id,intent:'authority',priority:'MEDIUM',source:'authority_atlas'});
}
const validHosts=new Set(Object.keys(ownership.hosts||{}));
const targets=[...byKey.values()].filter(t=>validHosts.has(t.host)).sort((a,b)=>a.priority===b.priority?a.query.localeCompare(b.query):a.priority==='HIGH'?-1:1);
write('data/search_intelligence/targets.json',{schema_version:'1.0.0',generated_at:now(),count:targets.length,targets});
console.log(`search targets: ${targets.length}`);

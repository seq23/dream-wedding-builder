#!/usr/bin/env node
// Target query set per host, from measured sources only.
//
// Why (2026-10-11): targets.json carried 119 queries from query_universe.json,
// none with a number - seeded by intent, not by demand - while Search Console
// showed weddingchecklistpdf.com's real demand was nine "wedding checklist
// pdf/printable" queries. A target with no number cannot be prioritised and
// cannot tell whether work moved it. This file keeps only targets with a
// measured number (GSC impressions in the rolling window, or a keyword-volume
// figure the repo holds) and lists every other candidate as dropped, with why.
import {read,write,now,norm,GSC_HOST_ENV} from './lib.mjs';
import {gscWindows,volumeRows,measurementsFor} from './measured_demand.mjs';

const ctx={gsc:gscWindows(),volumes:volumeRows()};
const candidates=read('data/search_intelligence/targets.json',{targets:[]}).targets||[];
const doc={schema_version:'1.0.0',generated_at:now(),
  rule:'A target is kept only with a measured number: Search Console impressions in the rolling 28-day window (gsc_truth.json) or a keyword-volume figure held in data/authority_scale/query_atlas.json / data/queries/evidence/evidence_queries.json. Everything else is dropped with its reason. Numbers are never estimated.',
  hosts:{}};
for(const host of Object.keys(GSC_HOST_ENV)){
  const queries=new Map();
  const add=(query,origin)=>{const k=norm(query);if(!k)return;const e=queries.get(k)||{query,origins:new Set()};e.origins.add(origin);queries.set(k,e)};
  for(const r of ctx.gsc[host]?.queries||[]) add(r.query,'gsc');
  for(const v of ctx.volumes.filter(v=>v.host===host)) add(v.query,'keyword_volume');
  for(const t of candidates.filter(t=>t.host===host)) add(t.query,`targets.json:${t.source||'unknown'}`);
  const targets=[],dropped=[];
  for(const {query,origins} of queries.values()){
    const m=measurementsFor(host,query,ctx);
    const candidate=candidates.find(t=>t.host===host&&norm(t.query)===norm(query));
    if(!m.length){dropped.push({query,reason:'UNMEASURED: no Search Console impressions in the window and no keyword-volume figure in the repo',origins:[...origins].sort()});continue}
    const best=m.find(x=>x.source==='google_search_console')||m[0];
    targets.push({query,source:best.source,metric:best.metric,number:best.number,...(best.position!=null?{position:best.position}:{}),...(best.pages?{pages:best.pages}:{}),route:candidate?.route||null,measurements:m});
  }
  targets.sort((a,b)=>(b.source==='google_search_console')-(a.source==='google_search_console')||b.number-a.number||a.query.localeCompare(b.query));
  dropped.sort((a,b)=>a.query.localeCompare(b.query));
  const w=ctx.gsc[host];
  doc.hosts[host]={gsc_window:w?{source:w.source,period:w.period,totals:w.totals}:null,target_count:targets.length,dropped_count:dropped.length,
    by_source:targets.reduce((a,t)=>(a[t.source]=(a[t.source]||0)+1,a),{}),targets,dropped};
}
write('data/search_intelligence/target_query_set.json',doc);
for(const [h,v] of Object.entries(doc.hosts))console.log(`target-set ${h}: ${v.target_count} measured (${Object.entries(v.by_source).map(([k,n])=>`${k} ${n}`).join(', ')||'none'}), ${v.dropped_count} dropped as unmeasured`);

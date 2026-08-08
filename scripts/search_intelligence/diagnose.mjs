#!/usr/bin/env node
import {read,write,now,norm,hostOf,idFor} from './lib.mjs';
const targets=read('data/search_intelligence/targets.json',{targets:[]}).targets||[]; const obs=read('data/search_intelligence/observations.json',{observations:[]}).observations||[]; const hubs=read('data/seo/hub_pages.json').pages; const ownership=read('data/seo/route_ownership.json');
const out=[];
for(const [slug,page] of Object.entries(hubs)){
  if(!page.description||page.description.trim().length<80||page.description.trim().length>180)out.push({diagnostic_id:idFor('hub-meta',slug),kind:!page.description?'hub_missing_meta_description':'hub_meta_description_length',severity:'AUTO',host:page.host,route:`/${slug}`,reason:!page.description?'description missing':`description length ${page.description.length}`,evidence:'repo_static'});
}
const gsc=obs.filter(o=>o.evidence_class==='OWN_SITE_PERFORMANCE');
for(const t of targets){
  const rows=gsc.filter(o=>o.host===t.host&&norm(o.query)===norm(t.query)); if(!rows.length)continue; const latest=rows[rows.length-1];
  if(latest.impressions>=50&&latest.ctr<0.02){const hub=Object.entries(hubs).find(([slug,p])=>p.host===t.host&&(`/${slug}`===t.route||p.product_id===t.product_id)); if(hub)out.push({diagnostic_id:idFor('ctr',t.target_id,latest.period?.end||latest.observed_at),kind:'high_impression_low_ctr_hub_meta_description',severity:'AUTO_WATCH',host:t.host,route:`/${hub[0]}`,query:t.query,reason:`${latest.impressions} impressions with ${(latest.ctr*100).toFixed(2)}% CTR`,evidence:'google_search_console',observation_id:latest.observation_id});}
}
for(const o of obs.filter(o=>o.evidence_class==='SAMPLED_QUERY_SURFACE')){
  const target=targets.find(t=>norm(t.query)===norm(o.query)); if(!target)continue; const own=(o.results||[]).find(r=>r.host===target.host); const competitors=(o.results||[]).filter(r=>r.host!==target.host).slice(0,5); out.push({diagnostic_id:idFor('surface',o.observation_id,target.target_id),kind:own?'sampled_surface_present':'sampled_surface_absent',severity:'OBSERVE',host:target.host,route:target.route,query:target.query,own_sample_position:own?.position||null,competitor_sample:competitors.map(r=>({position:r.position,host:r.host,url:r.url,title:r.title})),evidence:o.provider,observation_id:o.observation_id,note:'Sample only; not universal rank.'});
}
const counts={}; for(const d of out)counts[d.kind]=(counts[d.kind]||0)+1; write('data/search_intelligence/diagnostics.json',{schema_version:'1.0.0',generated_at:now(),diagnostics:out,summary:{total:out.length,by_kind:counts,gsc_observations:gsc.length,sampled_surface_observations:obs.filter(o=>o.evidence_class==='SAMPLED_QUERY_SURFACE').length,truth_note:'No evidence is promoted beyond its provider class.'}}); console.log(JSON.stringify({diagnostics:out.length,by_kind:counts},null,2));

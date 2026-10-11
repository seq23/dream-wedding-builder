// Measured demand: the one place that answers "does this query, on this host,
// have a measured number?" Read by build_target_query_set.mjs (to build the
// target set), by publish_authority_batch.mjs (the publishing freeze), and by
// validate_demand_repoint.mjs. A number is measured only when a source the repo
// holds carries it: Search Console impressions in the rolling window
// (gsc_truth.json, falling back to the latest window in observations.json), or a
// keyword-volume figure from the owner's Semrush export (query_atlas.json /
// evidence_queries.json). Nothing is estimated; no number means unmeasured.
import {read,norm} from './lib.mjs';

export function gscWindows(){
  const truth=read('data/search_intelligence/gsc_truth.json',{hosts:{}});
  const out={};
  for(const [host,h] of Object.entries(truth.hosts||{})) out[host]={source:'gsc_truth',period:h.period,queries:h.queries||[],pages:h.pages||[],totals:h.totals||null};
  // Fallback for any host the truth file does not hold yet: the newest 28-day
  // window collect_gsc.mjs appended to observations.json.
  const obs=read('data/search_intelligence/observations.json',{observations:[]}).observations.filter(o=>o.provider==='google_search_console');
  const byHost={};
  for(const o of obs){(byHost[o.host]||=[]).push(o)}
  for(const [host,rows] of Object.entries(byHost)){
    if(out[host])continue;
    const end=rows.reduce((m,o)=>o.period?.end>m?o.period.end:m,'');
    const latest=rows.filter(o=>o.period?.end===end);
    out[host]={source:'observations_latest_window',period:latest[0]?.period,queries:latest.map(o=>({query:o.query,page:o.page,clicks:o.clicks,impressions:o.impressions,position:o.average_position})),pages:null,totals:null};
  }
  return out;
}

export function volumeRows(){
  const rows=[];
  for(const [file,list] of [['data/authority_scale/query_atlas.json',read('data/authority_scale/query_atlas.json',{queries:[]}).queries],['data/queries/evidence/evidence_queries.json',read('data/queries/evidence/evidence_queries.json',{queries:[]}).queries]]){
    for(const q of list||[]) if(q?.query&&Number(q.volume)>0&&q.target_domain) rows.push({query:q.query,host:q.target_domain,volume:Number(q.volume),source_type:q.source_type||'keyword_volume',file});
  }
  return rows;
}

// Every measured number for (host, query): GSC impressions summed across pages
// in the window, and any keyword volume. Empty array = unmeasured.
export function measurementsFor(host,query,ctx={gsc:gscWindows(),volumes:volumeRows()}){
  const q=norm(query); const out=[];
  const w=ctx.gsc[host];
  if(w){const rows=w.queries.filter(r=>norm(r.query)===q);const imp=rows.reduce((s,r)=>s+Number(r.impressions||0),0);
    if(imp>0)out.push({source:'google_search_console',metric:'impressions_28d',number:imp,period:w.period,position:Math.round(rows.reduce((s,r)=>s+Number(r.position||0)*Number(r.impressions||0),0)/imp*10)/10,pages:[...new Set(rows.map(r=>r.page))]})}
  const seen=new Set();
  for(const v of ctx.volumes) if(v.host===host&&norm(v.query)===q&&!seen.has(v.volume)){seen.add(v.volume);out.push({source:v.source_type,metric:'monthly_search_volume',number:v.volume,file:v.file})}
  return out;
}

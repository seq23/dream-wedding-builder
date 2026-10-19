// Measured demand: the one place that answers "does this query, on this host,
// have a measured number?" Read by build_target_query_set.mjs (to build the
// target set), by publish_authority_batch.mjs (the publishing freeze), and by
// validate_demand_repoint.mjs. A number is measured only when a source the repo
// holds carries it: Search Console impressions in the rolling window
// (gsc_truth.json, falling back to the latest window in observations.json), or a
// keyword-volume figure from the owner's Semrush export (query_atlas.json /
// evidence_queries.json). Nothing is estimated; no number means unmeasured.
import {read,norm,idFor,pageKey} from './lib.mjs';

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

// Page-level Search Console history. gsc_truth.json holds only the current
// rolling window, and observations.json holds only query+page rows (GSC drops
// anonymised queries, so a page can carry impressions no query row shows). A
// measurement that justified a decision must stay checkable after the window
// rolls past it, so every answered window's page rows are appended here by
// collect_gsc.mjs. Rows are immutable evidence: id = hash(host,page,end,imp).
export const PAGE_HISTORY='data/search_intelligence/gsc_page_history.json';
export const PAGE_HISTORY_CAP=10000;
export function appendPageHistory(hist,truth,at){
  const rows=new Map((hist?.rows||[]).map(r=>[r.observation_id,r]));
  for(const [host,h] of Object.entries(truth?.hosts||{})){
    if(!h?.period?.end)continue;
    for(const p of h.pages||[]){if(!(Number(p.impressions)>0))continue;
      const id=idFor('gsc_page',host,p.page,h.period.end,String(p.impressions));
      if(!rows.has(id))rows.set(id,{observation_id:id,observed_at:at,provider:'google_search_console',dimension:'page',host,page:p.page,period:h.period,clicks:Number(p.clicks||0),impressions:Number(p.impressions)});}
  }
  return {schema_version:'1.0.0',boundary:'Append-only page-dimension Search Console rows, one per (host, page, window end); the evidence a past decision was measured, kept after the rolling window moves on.',rows:[...rows.values()].sort((a,b)=>String(a.observed_at).localeCompare(String(b.observed_at))).slice(-PAGE_HISTORY_CAP)};
}

// Resolve a recorded selection_evidence id to a retained Search Console row
// that actually measures this guide: a query row for its target query on its
// host, or a page row for the guide URL itself, with impressions > 0. Returns
// the row, or null when the id is absent, fabricated or measures something else.
export function resolveSelectionEvidence({host,slug,query,id},src={observations:read('data/search_intelligence/observations.json',{observations:[]}).observations,pageHistory:read(PAGE_HISTORY,{rows:[]}).rows}){
  if(!id)return null;
  const guide=`${host}/guides/${slug}`;
  const q=(src.observations||[]).find(o=>o.observation_id===id&&o.provider==='google_search_console');
  if(q&&q.host===host&&Number(q.impressions)>0&&(norm(q.query)===norm(query)||pageKey(q.page)===guide))return q;
  const p=(src.pageHistory||[]).find(o=>o.observation_id===id);
  if(p&&p.host===host&&Number(p.impressions)>0&&pageKey(p.page)===guide)return p;
  return null;
}

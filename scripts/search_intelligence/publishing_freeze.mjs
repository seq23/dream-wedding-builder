// The publishing freeze decision, shared by the publisher and its validator so
// the rule lives once. Config: data/search_intelligence/config.json
// publishing_freeze. Measurement: ./measured_demand.mjs.
import {read} from './lib.mjs';
import {measurementsFor,gscWindows,volumeRows} from './measured_demand.mjs';

export function freezeConfig(){return read('data/search_intelligence/config.json').publishing_freeze||null}
export const targetQueryOf=seed=>String(seed.target_query||seed.source_topic||seed.title||'').trim();

export function freezeDecision(seed,host,ctx){
  const cfg=freezeConfig();
  if(!cfg||cfg.enabled!==true)return {frozen:false,measurement:null,detail:'publishing freeze disabled'};
  const query=targetQueryOf(seed);
  if(!host)return {frozen:true,measurement:null,detail:`no host owns this seed's product, so "${query}" cannot be measured`};
  const m=measurementsFor(host,query,ctx||{gsc:gscWindows(),volumes:volumeRows()});
  if(!m.length)return {frozen:true,measurement:null,detail:`target "${query}" on ${host} has no measured number (no Search Console impressions in the window, no keyword volume in the repo)`};
  const best=m.find(x=>x.source==='google_search_console')||m[0];
  return {frozen:false,measurement:{query,host,source:best.source,metric:best.metric,number:best.number},detail:`target "${query}" measured: ${best.number} ${best.metric} (${best.source})`};
}

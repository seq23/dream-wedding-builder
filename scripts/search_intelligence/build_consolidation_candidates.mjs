#!/usr/bin/env node
// Consolidation candidates per host: sitemap pages with zero Search Console
// impressions in the rolling window AND thin content. Listed only - this file
// never redirects, removes or merges anything; that decision reads a week of it.
//
// Thin is measured, not asserted: a page's rendered word count from its source
// record (guide: content_registry.json; hub: hub_pages.json) below the library's
// own lower quartile for that page type. Utility pages (legal, product, shop,
// planner tools) are out of scope and listed as excluded, not silently skipped.
// Zero impressions needs page-level truth (gsc_truth.json pages); a host without
// it is AWAITING_PAGE_TRUTH, never "no candidates".
import {read,write,now,pageKey,sitemapUrlsFor,GSC_HOST_ENV} from './lib.mjs';

const registry=read('data/authority/content_registry.json');
const hubs=read('data/seo/hub_pages.json');
const truth=read('data/search_intelligence/gsc_truth.json',{hosts:{}});
const wc=o=>JSON.stringify(o??'').replace(/"[a-z_]+":/g,' ').split(/[^A-Za-z0-9']+/).filter(Boolean).length;
const guideWords=p=>wc({a:p.summary,b:p.answer,c:p.steps,d:p.mistakes,e:p.sections,f:p.examples,g:p.faqs});
const hubWords=p=>wc({a:p.intro,b:p.direct_answer,c:p.sections,d:p.faqs,e:p.table});
const q1=xs=>{const s=[...xs].sort((a,b)=>a-b);return s[Math.floor(s.length/4)]};
const THRESH={guide:q1(registry.pages.map(guideWords)),hub:q1(Object.values(hubs.pages).map(hubWords))};
const guideBySlug=Object.fromEntries(registry.pages.map(p=>[p.slug,p]));

const doc={schema_version:'1.0.0',generated_at:now(),
  rule:'candidate = sitemap page with 0 Search Console impressions in the rolling window (gsc_truth.json pages) AND rendered word count below the library lower quartile for its page type. No redirects are made from this file.',
  thin_thresholds_words:THRESH,hosts:{}};
for(const host of Object.keys(GSC_HOST_ENV)){
  const t=truth.hosts?.[host];
  if(!t?.pages){doc.hosts[host]={state:'AWAITING_PAGE_TRUTH',reason:'gsc_truth.json holds no page-level rows for this host yet; the next search-intelligence run writes them',candidate_count:0,candidates:[]};continue}
  const imp=Object.fromEntries(t.pages.map(p=>[pageKey(p.page),p.impressions]));
  const candidates=[],excluded=[];let examined=0;
  for(const url of sitemapUrlsFor(host)){
    const path=new URL(url).pathname.replace(/\/$/,'')||'/';
    let type=null,words=null;
    const g=path.match(/^\/guides\/([^/]+)$/);
    if(g&&guideBySlug[g[1]]){type='guide';words=guideWords(guideBySlug[g[1]])}
    else if(hubs.pages[path.slice(1)]&&hubs.pages[path.slice(1)].host===host){type='hub';words=hubWords(hubs.pages[path.slice(1)])}
    if(!type){excluded.push(path);continue}
    examined++;
    const impressions=imp[pageKey(url)]||0;
    if(impressions===0&&words<THRESH[type])candidates.push({url,type,impressions_28d:0,words,thin_threshold:THRESH[type],action:'REVIEW_FOR_CONSOLIDATION'});
  }
  candidates.sort((a,b)=>a.words-b.words);
  doc.hosts[host]={state:'MEASURED',gsc_period:t.period,content_pages_examined:examined,candidate_count:candidates.length,candidates,excluded_utility_paths:excluded};
}
write('data/search_intelligence/consolidation_candidates.json',doc);
for(const [h,v] of Object.entries(doc.hosts))console.log(`consolidation ${h}: ${v.state} ${v.candidate_count} candidate(s)${v.content_pages_examined!=null?` of ${v.content_pages_examined} content pages`:''}`);

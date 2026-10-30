'use strict';
/**
 * Refresh debt: how much of the published library is older than the refresh
 * window, read from the sitemaps the site actually serves.
 *
 * One implementation, two readers. cadence_gate.js judges a run after the fact;
 * publish_authority_batch.mjs reads the same numbers BEFORE it releases anything.
 * Before this module the gate and the publisher kept their own idea of capacity:
 * the publisher released new pages on a weekly budget that ignored refresh debt,
 * and the gate exited 1 on refresh debt that no lane in this repository can pay
 * down (there is no automated refresh - a refresh is the same human-authored unit
 * of work as a new guide). On 2026-10-30 the 69 guides first published on
 * 2026-07-30 crossed the 91-day window together, the gate went red on both
 * "Full Safe Autonomy" and "CI - Build and Validate", and stayed red with nothing
 * able to clear it. The debt is real and is reported; what it governs is
 * publishing, so that is where it is enforced.
 */
const fs = require('fs');
const path = require('path');

const DAY = 86400000;

// Match on content, not filename. This repo generates one sitemap per host as
// artifacts/sitemaps/<domain>.xml, which never matched a sitemap*.xml filename
// pattern, so the gate once scanned zero URLs and reported CLEAR no matter how
// much was published. Any XML carrying a <urlset> is a sitemap.
function sitemapUrls(root) {
  const found = new Map();
  const walk = (dir, depth = 0) => {
    if (depth > 4) return;
    let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (/^(node_modules|\.git|\.pages-output|coverage|\.next|\.open-next)$/.test(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, depth + 1);
      else if (/\.xml$/i.test(e.name)) {
        let xml;
        try { xml = fs.readFileSync(full, 'utf8'); } catch { continue; }
        if (!xml.includes('<urlset')) continue;
        for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
          const loc = (m[1].match(/<loc>(.*?)<\/loc>/) || [])[1];
          if (!loc) continue;
          const lm = (m[1].match(/<lastmod>(\d{4}-\d{2}-\d{2})/) || [])[1] || null;
          const prev = found.get(loc);
          if (prev === undefined || (lm && (!prev || lm > prev))) found.set(loc, lm);
        }
      }
    }
  };
  walk(root);
  return found;
}

/** The clock every cadence reader uses, so a test can pin it. */
function cadenceToday() {
  return new Date(process.env.CADENCE_TODAY || new Date().toISOString().slice(0, 10));
}

/**
 * @param {Map<string,string|null>} urls loc -> lastmod (YYYY-MM-DD) or null
 * @param {{refresh_window_days:number, stale_tolerance_pct:number}} policy
 * @param {Date} today
 * @param {number} lookaheadDays how far ahead to project the stale share
 */
function refreshDebt(urls, policy, today, lookaheadDays = 14) {
  const ageDays = (d) => Math.floor((today - new Date(d)) / DAY);
  const dated = [...urls.entries()].filter(([, d]) => d);
  const staleEntries = dated
    .map(([loc, d]) => ({ loc, lastmod: d, age_days: ageDays(d) }))
    .filter((e) => e.age_days > policy.refresh_window_days)
    .sort((a, b) => a.lastmod.localeCompare(b.lastmod) || a.loc.localeCompare(b.loc));
  const staleSoon = dated.filter(([, d]) => ageDays(d) + lookaheadDays > policy.refresh_window_days).length;
  const pct = (n) => (dated.length ? (100 * n) / dated.length : 0);
  const stalePct = pct(staleEntries.length);
  const projectedPct = pct(staleSoon);
  // Pages that must be substantively refreshed to bring the share back inside
  // tolerance, oldest first.
  const allowed = Math.floor((policy.stale_tolerance_pct / 100) * dated.length);
  return {
    dated: dated.length,
    stale: staleEntries.length,
    stale_pct: stalePct,
    over_tolerance: stalePct > policy.stale_tolerance_pct,
    refreshes_needed: Math.max(0, staleEntries.length - allowed),
    lookahead_days: lookaheadDays,
    projected_stale: staleSoon,
    projected_stale_pct: projectedPct,
    approaching: stalePct <= policy.stale_tolerance_pct && projectedPct > policy.stale_tolerance_pct,
    stale_urls: staleEntries,
  };
}

module.exports = { sitemapUrls, refreshDebt, cadenceToday };

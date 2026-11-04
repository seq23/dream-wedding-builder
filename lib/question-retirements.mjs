import fs from 'node:fs';
import path from 'node:path';

// With no static questions left, validate their nonempty retirement inventory
// instead. An empty directory alone never proves a successful consolidation.
export function questionRetirementInventory({ config, ledger, rescue, ownership, entity }) {
  // Retiring the old inventory does not forbid future distinct questions.
  // An active publisher must retain explicit volume and existing-intent guards.
  if (!['off', 'slow', 'normal'].includes(config.mode)) throw new Error('Unknown question publishing mode');
  if (config.mode !== 'off' && (
    !Number.isInteger(config.cap?.max_per_day) || config.cap.max_per_day < 1 || config.cap.max_per_day > 3 ||
    !Array.isArray(config.distinct?.sitemap_files) || !config.distinct.sitemap_files.length
  )) throw new Error('Active question publishing needs a bounded daily cap and existing sitemap intents');
  const pages = ledger.pages ?? [];
  if (!pages.length) throw new Error('Zero question ledger entries; nothing was checked');
  const redirects = rescue.redirects ?? {};
  const questions = Object.keys(redirects).filter(p => p.startsWith('/questions/'));
  if (questions.length !== pages.length || new Set(pages.map(p => p.route)).size !== pages.length) throw new Error('Question ledger and retirement inventory differ');
  for (const row of pages) {
    const target = redirects[row.route];
    const owner = ownership.routes.find(p => p.path === target && p.indexable);
    if (row.status !== 'merged' || !target || redirects[target] || !owner || owner.host !== rescue.main_host || row.merged_into !== `https://${owner.host}${target}`) {
      throw new Error(`Question retirement has no direct kept main-site destination: ${row.route}`);
    }
  }
  for (const field of ['name', 'url', 'logo', 'sameAs']) {
    if (!entity.brand?.[field] || (Array.isArray(entity.brand[field]) && !entity.brand[field].length)) throw new Error(`Destination publisher lacks ${field}`);
  }
  return { count: pages.length, targets: [...new Set(pages.map(p => redirects[p.route]))] };
}

export function readQuestionRetirements(root) {
  const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
  return questionRetirementInventory({ config: read('search-loop.config.json'), ledger: read('data/search-loop/pages.json'), rescue: read('data/seo/page_rescue.json'), ownership: read('data/seo/route_ownership.json'), entity: read('data/seo/entity.json') });
}

import fs from 'node:fs';
import path from 'node:path';

// With no static questions left, validate their nonempty retirement inventory
// instead. An empty directory alone never proves a successful consolidation.
export function questionRetirementInventory({ config, ledger, rescue, ownership, entity }) {
  if (config.mode !== 'off') throw new Error('Question publishing must be off for a fully retired inventory');
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

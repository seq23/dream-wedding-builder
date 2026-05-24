import fs from 'node:fs';

const homepage = fs.readFileSync('app/page.tsx','utf8');
for (const term of ['Start with Planning Reality Check','Ask Recommendation Studio','constraint-aware wedding planner brain']) {
  if (!homepage.includes(term)) { console.error('Missing homepage term:', term); process.exit(1); }
}

const trends = fs.readFileSync('data/trends.ts','utf8');
if ((trends.match(/id:/g) || []).length < 175) { console.error('Trend catalogue must include at least 175 standout ideas'); process.exit(1); }
for (const banned of ['Lake Como Color Smoke Kiss Moment','Wedding Day Content Creator','Late-night pizza truck','Late-night burger window','Transport coordinator','Lighting designer earlier in planning']) { if (trends.includes(banned)) { console.error('Banned catalogue filler/default found:', banned); process.exit(1); } }
for (const term of ['Color Smoke Kiss Moment','Late-Night Comfort Food Window','Hidden Champagne Wall Bartender','Custom Scent / Perfume Bar']) {
  if (!trends.includes(term)) { console.error('Missing locked standout idea:', term); process.exit(1); }
}

const build = fs.readFileSync('app/build/page.tsx','utf8');
for (const term of [
  'Planning Reality Check',
  'Constraint Profile',
  'Recommendation Studio',
  'Venue + Lodging Matchmaker',
  'Budget + Tradeoff Reality',
  'Protect what matters',
  'Design + scope',
  'Photo/Description-to-Scope Intelligence',
  'Vendor Team + Inquiry Builder',
  'Risk / Reality Check',
  'Standout ideas',
  'planner-ready working brief',
  'Nothing is selected until the bride chooses it',
  'No fake live vendor/product search is claimed'
]) {
  if (!build.toLowerCase().includes(term.toLowerCase())) { console.error('Missing rebuild product term:', term); process.exit(1); }
}

const planning = fs.readFileSync('data/planning.ts','utf8') + fs.readFileSync('data/inspiration.ts','utf8');
for (const term of [
  'Full concept',
  'Venue + Lodging',
  'Budget + Tradeoffs',
  'Design Direction',
  'Florals / Decor / Rentals',
  'Fashion / Beauty',
  'Food / Beverage',
  'Photo / Video / Moments',
  'Guest Experience / Hospitality',
  'Timeline / Weekend Flow',
  'Vendor Team / Inquiry Builder',
  'Risk / Reality Checks',
  'Bouquet + Floral Scope',
  'Flower Girl Dress / Attire Finder',
  'Tablescape Decoder',
  'typed description'
]) {
  if (!planning.toLowerCase().includes(term.toLowerCase())) { console.error('Missing planning intelligence term:', term); process.exit(1); }
}

const dash = fs.readFileSync('app/dashboard/page.tsx','utf8');
for (const term of ['Constraint Profile','Recommendation Studio','Venue + Lodging Strategy','Budget + Protected Priorities','Photo / Description Scope','Vendor Team + Inquiry Focus','Risk / Reality Checks']) {
  if (!dash.includes(term)) { console.error('Missing dashboard term:', term); process.exit(1); }
}

const pack = fs.readFileSync('app/pack/page.tsx','utf8');
for (const term of ['Planning Reality Check / Constraint Profile','Recommendation Studio','Protected Priorities + Budget Reality','Venue + Lodging Shortlist Strategy','Full Planner Bucket Map','Required Disclaimers']) {
  if (!pack.includes(term)) { console.error('Missing packet term:', term); process.exit(1); }
}

console.log('content validation passed');

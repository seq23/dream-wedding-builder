import fs from 'node:fs';
const homepage = fs.readFileSync('app/page.tsx','utf8');
for (const term of ['Start the guided builder','Not estimated yet','Starts blank']) {
  if (!homepage.includes(term)) { console.error('Missing homepage term:', term); process.exit(1); }
}
const trends = fs.readFileSync('data/trends.ts','utf8');
for (const term of ['Lake Como Color Smoke Kiss Moment','Gelato Cart','Polaroid / Instax Guest Book Station']) {
  if (!trends.includes(term)) { console.error('Missing locked trend:', term); process.exit(1); }
}
const build = fs.readFileSync('app/build/page.tsx','utf8');
for (const term of [
  'Venue Finder / Matchmaker',
  'User input + seeded planning benchmarks + inspiration scope',
  'Hidden Fee Checklist',
  'planner-ready working brief',
  'Nothing is selected until the bride chooses it',
  'Vibe + Theme Translator',
  'Photo/Description-to-Scope Intelligence',
  'Tablescape Decoder',
  'bouquets',
  'flower girl dresses',
  'No fake live vendor/product search is claimed'
]) {
  if (!build.toLowerCase().includes(term.toLowerCase())) { console.error('Missing rebuild product term:', term); process.exit(1); }
}
const planning = fs.readFileSync('data/planning.ts','utf8') + fs.readFileSync('data/inspiration.ts','utf8');
for (const term of ['Bouquet + Floral Scope','Flower Girl Dress / Attire Finder','Tablescape Decoder','Vibe + Theme Translator','chandeliers require venue approval','typed description']) {
  if (!planning.toLowerCase().includes(term.toLowerCase())) { console.error('Missing planning intelligence term:', term); process.exit(1); }
}
const dash = fs.readFileSync('app/dashboard/page.tsx','utf8');
for (const term of ['Strict Budget Mode','Increase my budget','Turn off strict budget','Budget Reality','Photo / Description Scope']) {
  if (!dash.includes(term)) { console.error('Missing strict budget/dashboard term:', term); process.exit(1); }
}
console.log('content validation passed');

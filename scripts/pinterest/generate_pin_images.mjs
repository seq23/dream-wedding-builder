// Generates the 1000x1500 (2:3) Pinterest pin images for weddingchecklistpdf.com's
// /pinfeed.xml from the site's own product art. No preview in the repo was 2:3
// (the merch cards are 1122x1402, the previews 1600x1080, the suite hero 1672x941),
// so each pin is composed from those real assets plus a plain text overlay of the
// product or checklist name. No people, no stock photos, no AI generation.
//
// Output is committed (public/pinterest/*.jpg) and served as static files; the
// byte sizes the feed's <enclosure length=...> needs are written to
// data/pinterest/pin_images.json because the route runs in a Worker with no fs.
// Re-run after changing a source asset:  node scripts/pinterest/generate_pin_images.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const W = 1000;
const H = 1500;
const OUT_DIR = path.join(ROOT, 'public/pinterest');
const MANIFEST = path.join(ROOT, 'data/pinterest/pin_images.json');
const src = (p) => path.join(ROOT, 'public', p);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function textPanel({ height, bg, ink, accent, title, subtitle, eyebrow }) {
  const lines = title.split('\n');
  const titleSize = lines.length > 1 ? 74 : 80;
  const startY = (eyebrow ? 120 : 90) + titleSize * 0.2;
  const titleSvg = lines.map((line, i) => `<text x="500" y="${startY + titleSize + i * (titleSize * 1.12)}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${titleSize}" font-weight="700" fill="${ink}">${esc(line)}</text>`).join('');
  const subY = startY + titleSize + (lines.length - 1) * titleSize * 1.12 + 70;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}">
<rect width="100%" height="100%" fill="${bg}"/>
${eyebrow ? `<text x="500" y="80" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="30" letter-spacing="6" font-weight="700" fill="${accent}">${esc(eyebrow)}</text>` : ''}
${titleSvg}
${subtitle ? `<text x="500" y="${subY}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="38" fill="${ink}" opacity="0.85">${esc(subtitle)}</text>` : ''}
</svg>`);
}

async function fit(file, width, height, position = 'centre') {
  return sharp(src(file)).resize(width, height, { fit: 'cover', position }).png().toBuffer();
}

// Card-based pin: text panel on top, the product card (real product art) below.
async function cardPin({ slug, card, panelHeight, bg, ink, accent, title, subtitle, eyebrow }) {
  const imgH = H - panelHeight;
  const image = await fit(card, W, imgH, 'south');
  return { slug, buffer: await sharp({ create: { width: W, height: H, channels: 3, background: bg } })
    .composite([
      { input: textPanel({ height: panelHeight, bg, ink, accent, title, subtitle, eyebrow }), top: 0, left: 0 },
      { input: image, top: panelHeight, left: 0 }
    ]).jpeg({ quality: 86, mozjpeg: true }).toBuffer() };
}

// Bundle pin: text panel, the suite hero, then the three sibling product cards.
async function bundlePin() {
  const bg = '#f6efe7';
  const panelHeight = 470;
  const heroH = Math.round(W * 941 / 1672);
  const rowTop = panelHeight + heroH + 20;
  const cardW = 320;
  const cardH = H - rowTop - 20;
  const cards = ['budget-spreadsheet', 'timeline-template', 'seating-chart-maker'];
  const tiles = await Promise.all(cards.map((id) => fit(`product-images/merch/${id}-card.png`, cardW, cardH, 'north')));
  return { slug: 'wedding-planning-bundle', buffer: await sharp({ create: { width: W, height: H, channels: 3, background: bg } })
    .composite([
      { input: textPanel({ height: panelHeight, bg, ink: '#2b2622', accent: '#b8862f', eyebrow: '4 WEDDING PLANNERS · $39', title: 'Wedding Planning\nBundle', subtitle: 'Checklist · Budget · Timeline · Seating chart' }), top: 0, left: 0 },
      { input: await fit('product-images/merch/operations-suite-hero.png', W, heroH), top: panelHeight, left: 0 },
      ...tiles.map((input, i) => ({ input, top: rowTop, left: 10 + i * (cardW + 15) }))
    ]).jpeg({ quality: 86, mozjpeg: true }).toBuffer() };
}

const ink = '#2b2622';
const accent = '#b8862f';
const pins = [
  await cardPin({ slug: 'wedding-checklist-pdf', card: 'product-images/merch/checklist-pdf-card.png', panelHeight: 330, bg: '#f6efe7', ink, accent, eyebrow: 'PRINTABLE + EDITABLE · $9', title: 'Wedding Checklist PDF', subtitle: '104 tasks · 13 printable pages' }),
  await cardPin({ slug: 'printable-wedding-checklist', card: 'product-images/checklist-pdf-hero.png', panelHeight: 330, bg: '#efe3d6', ink, accent, eyebrow: 'MONTH-BY-MONTH PLANNER', title: 'Printable Wedding Checklist', subtitle: 'From 12+ months out to wedding week' }),
  await cardPin({ slug: 'elopement-planning-checklist', card: 'product-images/merch/checklist-pdf-card.png', panelHeight: 400, bg: '#e9ece4', ink, accent: '#6d7f5e', eyebrow: 'FREE CHECKLIST', title: 'Elopement\nPlanning Checklist', subtitle: 'License, witnesses, permits, travel' }),
  await cardPin({ slug: 'courthouse-wedding-checklist', card: 'product-images/checklist-pdf-hero.png', panelHeight: 400, bg: '#e6e8ee', ink, accent: '#5b6b8c', eyebrow: 'FREE CHECKLIST', title: 'Courthouse\nWedding Checklist', subtitle: 'Appointment, license, ID, witnesses' }),
  await cardPin({ slug: 'destination-wedding-checklist', card: 'product-images/merch/checklist-pdf-card.png', panelHeight: 400, bg: '#f3e6e1', ink, accent: '#b0705f', eyebrow: 'FREE CHECKLIST', title: 'Destination\nWedding Checklist', subtitle: 'Travel, lodging, documents, vendors' }),
  await bundlePin()
];

fs.mkdirSync(OUT_DIR, { recursive: true });
const manifest = {};
for (const { slug, buffer } of pins) {
  const meta = await sharp(buffer).metadata();
  if (meta.width !== W || meta.height !== H) throw new Error(`${slug}: ${meta.width}x${meta.height}, expected ${W}x${H}`);
  const rel = `/pinterest/${slug}.jpg`;
  fs.writeFileSync(path.join(ROOT, 'public', rel), buffer);
  manifest[slug] = { path: rel, type: 'image/jpeg', width: W, height: H, length: buffer.length };
}
fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`pinterest: wrote ${pins.length} pins (${W}x${H}) to public/pinterest/`);

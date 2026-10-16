// Renders one 1000x1500 pin for the Pinterest daily drip from the product's own
// committed art plus a plain text overlay. No people, no stock photos, no AI
// generation. Five layouts x six palettes; the variant record names both.
import path from 'node:path';
import sharp from 'sharp';

export const W = 1000;
export const H = 1500;
export const LAYOUTS = ['panel-top', 'panel-bottom', 'framed', 'band', 'stripe'];
export const PALETTES = {
  cream: { bg: '#f6efe7', ink: '#2b2622', accent: '#9a6f22' },
  blush: { bg: '#f4e3e1', ink: '#3a2a2a', accent: '#9c4a4e' },
  sage: { bg: '#e6ebe1', ink: '#26302a', accent: '#4f6a46' },
  slate: { bg: '#e4e8ef', ink: '#232a36', accent: '#44587a' },
  terracotta: { bg: '#f2e2d6', ink: '#3b2418', accent: '#9c5232' },
  ink: { bg: '#2b2622', ink: '#f6efe7', accent: '#d8b46a' }
};

const ROOT = process.cwd();
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const SERIF = "Georgia, 'DejaVu Serif', 'Times New Roman', serif";
const SANS = "Helvetica, Arial, 'DejaVu Sans', sans-serif";

// Text block: eyebrow, headline lines, subline; centred in a box of the given height.
function textSvg({ width = W, height, palette, eyebrow, headline, subline, background = true, radius = 0 }) {
  const { bg, ink, accent } = palette;
  const lines = headline.split('\n');
  const longest = Math.max(...lines.map((l) => l.length));
  const size = Math.min(92, Math.floor((width - 120) / (longest * 0.56)));
  const lineGap = size * 1.12;
  const subSize = Math.min(38, Math.floor((width - 100) / (subline.length * 0.52)));
  const blockH = 34 + lines.length * lineGap + size * 0.06 + 30 + subSize;
  let y = Math.max(40, (height - blockH) / 2) + 30;
  const parts = [];
  if (background) parts.push(`<rect width="${width}" height="${height}" rx="${radius}" fill="${bg}"/>`);
  parts.push(`<text x="${width / 2}" y="${y}" text-anchor="middle" font-family="${SANS}" font-size="28" letter-spacing="5" font-weight="700" fill="${accent}">${esc(eyebrow)}</text>`);
  y += 34;
  for (const line of lines) {
    y += lineGap;
    parts.push(`<text x="${width / 2}" y="${y - lineGap * 0.18}" text-anchor="middle" font-family="${SERIF}" font-size="${size}" font-weight="700" fill="${ink}">${esc(line)}</text>`);
  }
  const ruleY = y - lineGap * 0.18 + size * 0.24 + 8;
  parts.push(`<rect x="${width / 2 - 40}" y="${ruleY}" width="80" height="3" fill="${accent}"/>`);
  parts.push(`<text x="${width / 2}" y="${ruleY + 22 + subSize}" text-anchor="middle" font-family="${SANS}" font-size="${subSize}" fill="${ink}">${esc(subline)}</text>`);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${parts.join('')}</svg>`);
}

const art = (rel) => sharp(path.join(ROOT, 'public', rel));
// Portrait art fills its area; landscape art (the 1600x1080 sheet previews) is shown
// whole on the palette background, because cropping it cuts the product name off.
const cover = async (rel, width, height, position = 'north', background = '#ffffff') => {
  const { width: w = 1, height: h = 1 } = await art(rel).metadata();
  if (w > h) return art(rel).resize(width - 60, height - 60, { fit: 'contain', background }).extend({ top: 30, bottom: 30, left: 30, right: 30, background }).png().toBuffer();
  return art(rel).resize(width, height, { fit: 'cover', position }).png().toBuffer();
};
const contain = async (rel, width, height, background) => art(rel).resize(width, height, { fit: 'contain', background }).png().toBuffer();

export async function renderPin(variant) {
  const palette = PALETTES[variant.palette];
  if (!palette) throw new Error(`${variant.id}: unknown palette ${variant.palette}`);
  const text = { palette, eyebrow: variant.eyebrow, headline: variant.headline, subline: variant.subline };
  const base = () => sharp({ create: { width: W, height: H, channels: 3, background: palette.bg } });
  let layers;
  switch (variant.layout) {
    case 'panel-top':
      layers = [{ input: textSvg({ ...text, height: 540 }), top: 0, left: 0 }, { input: await cover(variant.art, W, H - 540, 'north', palette.bg), top: 540, left: 0 }];
      break;
    case 'panel-bottom':
      layers = [{ input: await cover(variant.art, W, H - 520, 'north', palette.bg), top: 0, left: 0 }, { input: textSvg({ ...text, height: 520 }), top: H - 520, left: 0 }];
      break;
    case 'framed': {
      const frame = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="62" y="582" width="876" height="836" rx="18" fill="#000" opacity="0.12"/><rect x="50" y="570" width="900" height="840" rx="18" fill="#ffffff"/></svg>`);
      layers = [{ input: textSvg({ ...text, height: 560 }), top: 0, left: 0 }, { input: frame, top: 0, left: 0 }, { input: await contain(variant.art, 860, 800, '#ffffff'), top: 590, left: 70 }];
      break;
    }
    case 'band': {
      // Portrait art runs full-bleed behind a centred card; landscape art sits whole
      // above the card so the card never covers the product.
      const { width: w = 1, height: h = 1 } = await art(variant.art).metadata();
      layers = w > h
        ? [{ input: await cover(variant.art, W, 900, 'north', palette.bg), top: 0, left: 0 }, { input: textSvg({ ...text, width: 880, height: 520, radius: 28, palette: { ...palette, bg: '#ffffff' } }), top: 930, left: 60 }]
        : [{ input: await cover(variant.art, W, H, 'centre', palette.bg), top: 0, left: 0 }, { input: textSvg({ ...text, width: 880, height: 560, radius: 28 }), top: 470, left: 60 }];
      break;
    }
    case 'stripe': {
      const dark = palette === PALETTES.ink ? PALETTES.cream : PALETTES.ink;
      layers = [{ input: textSvg({ ...text, palette: { ...dark, accent: dark.accent }, height: 560 }), top: 0, left: 0 }, { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="12"><rect width="${W}" height="12" fill="${palette.accent}"/></svg>`), top: 560, left: 0 }, { input: await cover(variant.art, W, H - 572, 'north', palette.bg), top: 572, left: 0 }];
      break;
    }
    default:
      throw new Error(`${variant.id}: unknown layout ${variant.layout}`);
  }
  const buffer = await base().composite(layers).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  const meta = await sharp(buffer).metadata();
  if (meta.width !== W || meta.height !== H) throw new Error(`${variant.id}: rendered ${meta.width}x${meta.height}, expected ${W}x${H}`);
  return buffer;
}

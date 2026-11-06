// Draws the app icon, Android adaptive icon and splash mark from the approved Dream
// Wedding tab mark (design system https://claude.ai/artifact/6ncBMWsGoHNHP16FzbmM9o,
// assets/Logos/dream-wedding-tab.svg): two stepped binder tabs, coral behind, blue in
// front, on ivory. Pure Node (zlib), no image library. Output is committed.
//   node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const IVORY = [0xfa, 0xf7, 0xf2], BLUE = [0x27, 0x47, 0xd9], CORAL = [0xf2, 0x8c, 0x6b];
// The mark in the SVG's 64-unit tile: x0..x1, y0..y1, top-right corner radius 8.
const TABS = [{ x0: 24, x1: 52, y0: 8, y1: 56, c: CORAL }, { x0: 12, x1: 40, y0: 18, y1: 64, c: BLUE }];
const inside = (t, x, y) => {
  if (x < t.x0 || x > t.x1 || y < t.y0 || y > t.y1) return false;
  const cx = t.x1 - 8, cy = t.y0 + 8;
  return !(x > cx && y < cy) || (x - cx) ** 2 + (y - cy) ** 2 <= 64;
};
// scale: how much of the canvas the 64-unit tile fills; bg null = transparent.
function draw(size, { scale = 1, bg = IVORY } = {}) {
  const px = Buffer.alloc(size * size * 4), off = (size - size * scale) / 2, S = 4;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const x = ((i + (sx + 0.5) / S - off) / (size * scale)) * 64, y = ((j + (sy + 0.5) / S - off) / (size * scale)) * 64;
      let c = null;
      for (const t of TABS) if (inside(t, x, y)) c = t.c;
      if (!c && bg && x >= 0 && x <= 64 && y >= 0 && y <= 64) c = bg;
      if (!c && bg && scale < 1) c = bg;
      if (c) { r += c[0]; g += c[1]; b += c[2]; a += 255; }
    }
    const n = S * S, k = (j * size + i) * 4, cov = a / 255;
    px[k] = cov ? r / cov : 0; px[k + 1] = cov ? g / cov : 0; px[k + 2] = cov ? b / cov : 0; px[k + 3] = a / n;
  }
  return png(size, px);
}
function png(size, px) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = buf => { let c = 0xffffffff; for (const v of buf) c = crcTable[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const out = name => fileURLToPath(new URL(`../assets/${name}`, import.meta.url));
// App icon: full-bleed ivory (iOS rounds the corners itself), mark at 70% so the tabs sit inside the mask.
writeFileSync(out('icon.png'), draw(1024, { scale: 0.7 }));
// Android adaptive foreground: transparent, mark inside the 66% safe zone.
writeFileSync(out('adaptive-icon.png'), draw(1024, { scale: 0.5, bg: null }));
// Splash: the mark alone on transparent (the splash background is ivory in app.config.ts).
writeFileSync(out('splash.png'), draw(512, { scale: 1, bg: null }));
console.log('OUTPUT icons: icon.png 1024, adaptive-icon.png 1024, splash.png 512');

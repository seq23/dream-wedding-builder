// Renders the 1000x1500 Pinterest daily-drip pins in the Dream Wedding brand through
// scripts/pinterest/render_pin.py (Pillow + the committed brand fonts: sharp's SVG text
// only reaches installed system fonts, the reason #95 moved the feed pins to Pillow).
// One Python process serves every render of a run; each reply carries the text metrics
// the quality gate reads (scripts/pinterest/quality.mjs).
//
// Art is the page's topic art (data/pinterest/topic_art.json): free Unsplash, Pexels or
// Pixabay photos, >= 1000px wide, no watermark, never a product screenshot. Three band
// layouts x four soft palettes; the brand line on every pin is "Wedding Checklist PDF".
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { focusFor } from './pin_sources.mjs';

export const W = 1000;
export const H = 1500;
export const LAYOUTS = ['band-top', 'band-low', 'band-frame'];
export const BRAND = 'Wedding Checklist PDF';
// Band colour + text inks (render_pin.py PALETTES is the drawing copy of the same values).
export const PALETTES = {
  ivory: { bg: '#FBF8F3', ink: '#2B2622', sub: '#564C43' },
  blush: { bg: '#F8ECE7', ink: '#3A2828', sub: '#5E4844' },
  sage: { bg: '#EEF1EA', ink: '#24302A', sub: '#46524A' },
  champagne: { bg: '#F6EFE2', ink: '#2E2A22', sub: '#564C3C' }
};
// Names kept by pins drawn before 7 Nov 2026 (the sharp renderer before 6 Nov, then the
// retired binder-page / tab-panel / header / card / split frames). Their published images
// and the approved dw-v2 pins are never redrawn.
export const LEGACY_LAYOUTS = ['panel-top', 'panel-bottom', 'framed', 'band', 'stripe', 'tab-panel', 'header', 'card', 'binder-page', 'split'];
export const LEGACY_PALETTES = ['cream', 'blush', 'sage', 'slate', 'terracotta', 'ink', 'ivory', 'blue-soft', 'coral-soft', 'midnight'];

const ROOT = process.cwd();
let server = null;

function start() {
  const child = spawn('python3', [path.join(ROOT, 'scripts/pinterest/render_pin.py'), '--serve'], { stdio: ['pipe', 'pipe', 'inherit'] });
  const lines = readline.createInterface({ input: child.stdout });
  const waiting = [];
  lines.on('line', (line) => waiting.shift()?.resolve(JSON.parse(line)));
  child.on('exit', (code) => { for (const w of waiting.splice(0)) w.reject(new Error(`render_pin.py exited ${code}`)); server = null; });
  return {
    child,
    request: (msg) => new Promise((resolve, reject) => { waiting.push({ resolve, reject }); child.stdin.write(`${JSON.stringify(msg)}\n`); })
  };
}

/** Close the Python renderer (scripts call this before exiting). */
export function closeRenderer() {
  if (server) { server.child.stdin.end(); server = null; }
}

/**
 * Render `variant` to public/<outRel> (default its drip image path). Returns
 * { image: {path,type,width,height,length}, text: [{role,size,lines,fit,ink,ground}],
 *   shape: {layout, photo_fraction, bands, brand} }.
 */
export async function renderToFile(variant, outRel = `/pinterest/drip/${variant.id}.jpg`) {
  if (!LAYOUTS.includes(variant.layout)) throw new Error(`${variant.id}: unknown layout ${variant.layout}`);
  if (!PALETTES[variant.palette]) throw new Error(`${variant.id}: unknown palette ${variant.palette}`);
  server ??= start();
  const out = path.join(ROOT, 'public', outRel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const reply = await server.request({ variant: { ...variant, focus: focusFor(variant.art) }, out });
  if (!reply.ok) throw new Error(`${variant.id}: ${reply.error}`);
  if (reply.width !== W || reply.height !== H) throw new Error(`${variant.id}: rendered ${reply.width}x${reply.height}, expected ${W}x${H}`);
  return { image: { path: outRel, type: 'image/jpeg', width: W, height: H, length: reply.length }, text: reply.text, shape: reply.shape };
}

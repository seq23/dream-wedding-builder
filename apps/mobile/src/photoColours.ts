// The pure half of src/photos.ts: decoding and colour reading, with no native module, so the
// unit tests run it as is.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** Base64 to bytes without atob or Buffer, so it runs the same on every phone and on the web. */
export function base64Bytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor(clean.length * 3 / 4));
  let n = 0, bits = 0, acc = 0;
  for (const ch of clean) {
    acc = (acc << 6) | B64.indexOf(ch); bits += 6;
    if (bits >= 8) { bits -= 8; out[n++] = (acc >> bits) & 0xff; }
  }
  return out.subarray(0, n);
}

/** The five strongest colours in RGBA pixels (the website's photoColours, same bins). */
export function strongestColours(px: ArrayLike<number>): string[] {
  const bins: Record<string, { n: number; r: number; g: number; b: number }> = {};
  for (let i = 0; i + 3 < px.length; i += 4) {
    const k = `${px[i] >> 5},${px[i + 1] >> 5},${px[i + 2] >> 5}`;
    const o = (bins[k] ??= { n: 0, r: 0, g: 0, b: 0 });
    o.n++; o.r += px[i]; o.g += px[i + 1]; o.b += px[i + 2];
  }
  return Object.values(bins).sort((a, b) => b.n - a.n).slice(0, 5)
    .map(o => '#' + [o.r, o.g, o.b].map(v => Math.round(v / o.n).toString(16).padStart(2, '0')).join(''));
}


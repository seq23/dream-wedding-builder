// Security audit 27 Nov 2026, check 17 (B.md row 31): the admin product upload trusted the file
// extension alone. These drive the real route: the type comes from the bytes, the size from the
// bytes received, and version/kind can never climb out of the upload folder.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { crc32 } from 'node:zlib';
import { readFileSync } from 'node:fs';

const state = vi.hoisted(() => ({ admin: true, writes: [] as string[], saved: 0 }));
vi.mock('@/lib/admin-auth', () => ({ requireAdmin: async () => state.admin }));
vi.mock('@/lib/admin-store', () => ({
  readCatalog: async () => ({ version: '1', currency: 'USD', products: [{ id: 'p1', sku: 'SKU1', name: 'Kit', status: 'ACTIVE' }] }),
  saveCatalog: async () => { state.saved++; },
  writeReceipt: async (r: unknown) => r,
  saveBinaryToPrivateGitHub: async () => { throw new Error('not in tests'); },
}));
vi.mock('node:fs/promises', () => ({ default: { mkdir: async () => undefined, writeFile: async (p: string) => { state.writes.push(p); } } }));

import { POST } from '@/app/api/admin/products/[id]/upload/route';
import { checkUpload, UPLOAD_MAX_BYTES } from '@/lib/upload-check';

/** A store-only zip (enough for file-type to read its entry names). */
function zip(entries: Record<string, string>): Uint8Array {
  const parts: Buffer[] = []; const central: Buffer[] = []; let offset = 0;
  for (const [name, text] of Object.entries(entries)) {
    const data = Buffer.from(text); const n = Buffer.from(name); const crc = crc32(data);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(n.length, 26);
    const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(data.length, 24); cen.writeUInt16LE(n.length, 28); cen.writeUInt32LE(offset, 42);
    parts.push(local, n, data); central.push(cen, n); offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(central); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...parts, cd, end]));
}
const png = new Uint8Array(readFileSync('apps/mobile/assets/icon.png'));
const pdf = new Uint8Array(Buffer.from('%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n'));
const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9]);
const webp = new Uint8Array(Buffer.concat([Buffer.from('RIFF'), Buffer.from([26, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(18)]));
// The [Content_Types].xml every Excel or Google Sheets export carries.
const xlsx = zip({ '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>', 'xl/workbook.xml': '<workbook/>' });
const plainZip = zip({ 'readme.txt': 'hello' });
const csv = new Uint8Array(Buffer.from('task,due\nBook venue,2027-01-10\nCafé deposit,2027-02-01\n'));
const html = new Uint8Array(Buffer.from('<!doctype html><script>alert(1)</script>'));

function upload(bytes: Uint8Array, name: string, fields: Record<string, string> = {}, headers: Record<string, string> = {}) {
  const fd = new FormData(); fd.set('file', new File([bytes], name)); fd.set('kind', fields.kind ?? 'release'); fd.set('version', fields.version ?? '2.1.0');
  return POST(new Request('https://x.test/api/admin/products/p1/upload', { method: 'POST', body: fd, headers }), { params: Promise.resolve({ id: 'p1' }) });
}

beforeEach(() => { state.admin = true; state.writes = []; state.saved = 0; });

describe('admin upload: the bytes decide the type', () => {
  it.each([['kit.png', png], ['kit.pdf', pdf], ['kit.jpg', jpg], ['kit.jpeg', jpg], ['kit.webp', webp], ['kit.xlsx', xlsx], ['kit.zip', plainZip], ['kit.csv', csv]])('stores a real %s', async (name, bytes) => {
    const res = await upload(bytes, name);
    expect(res.status, JSON.stringify(await res.clone().json())).toBe(200);
    const body = await res.json() as { release: { size: number } };
    expect(body.release.size).toBe(bytes.byteLength);
    expect(state.writes).toHaveLength(1);
  });
  it.each([['a PNG named .pdf', png, 'kit.pdf'], ['an HTML page named .pdf', html, 'kit.pdf'], ['a plain zip named .xlsx', plainZip, 'kit.xlsx'], ['a PDF named .png', pdf, 'kit.png'], ['a PNG named .csv', png, 'kit.csv'], ['an HTML page named .jpg', html, 'kit.jpg'], ['an empty .pdf', new Uint8Array(), 'kit.pdf']])('refuses %s with 415 and stores nothing', async (_label, bytes, name) => {
    const res = await upload(bytes, name);
    expect(res.status).toBe(415);
    expect(state.writes).toHaveLength(0); expect(state.saved).toBe(0);
  });
  it('refuses a .csv holding a NUL byte or non-UTF-8 bytes', async () => {
    expect((await upload(new Uint8Array([0x61, 0x2c, 0x00, 0x0a]), 'kit.csv')).status).toBe(415);
    expect((await upload(new Uint8Array([0x61, 0x2c, 0xff, 0xfe, 0x0a]), 'kit.csv')).status).toBe(415);
    expect(state.writes).toHaveLength(0);
  });
  it('keeps the same accepted list (an .svg or .exe is still refused)', async () => {
    expect((await upload(html, 'kit.svg')).status).toBe(415);
    expect((await upload(png, 'kit.exe')).status).toBe(415);
  });
});

describe('admin upload: size, path and who may call', () => {
  it('measures the size from the bytes, one byte past 50 MB is 413', async () => {
    const big = new Uint8Array(UPLOAD_MAX_BYTES + 1); big.set(pdf);
    expect(await checkUpload('.pdf', big)).toMatchObject({ ok: false, status: 413 });
    const exact = new Uint8Array(UPLOAD_MAX_BYTES); exact.set(pdf);
    expect(await checkUpload('.pdf', exact)).toEqual({ ok: true });
  });
  it('refuses a declared body far past the cap before reading it', async () => {
    const res = await upload(pdf, 'kit.pdf', {}, { 'content-length': String(UPLOAD_MAX_BYTES * 2) });
    expect(res.status).toBe(413); expect(state.writes).toHaveLength(0);
  });
  it.each([['version', '../../../etc'], ['version', 'a/b'], ['kind', '..'], ['kind', 'rel ease']])('refuses a %s of %j and writes nothing', async (field, value) => {
    const res = await upload(pdf, 'kit.pdf', { [field]: value });
    expect(res.status).toBe(400);
    expect(state.writes).toHaveLength(0); expect(state.saved).toBe(0);
  });
  it('a caller who is not the admin gets 401 and nothing is stored', async () => {
    state.admin = false;
    expect((await upload(png, 'kit.png')).status).toBe(401);
    expect(state.writes).toHaveLength(0);
  });
});

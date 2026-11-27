/**
 * Count formula cells in an .xlsx by reading the archive directly.
 *
 * The product page advertises "<n> built-in formulas" from the catalog's
 * inventory.formula_count and says that number "is taken from the canonical paid
 * workbook release". Nothing checked that claim against the release, and it had
 * drifted: two workbooks ship with working formulas while the catalog recorded 0
 * for all of them, so the block never rendered and the products understated the
 * one thing that separates them from a static free template.
 *
 * Implemented without a dependency: parse the ZIP central directory, inflate the
 * worksheet parts, and count formula elements.
 */
import fs from 'node:fs';
import { inflateRawSync } from 'node:zlib';

function readEntries(buf) {
  // End of central directory: scan back for the signature, allowing for a comment.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 0xffff; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a ZIP archive: no end-of-central-directory record');

  const count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  const entries = [];

  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(offset) !== 0x02014b50) throw new Error('Corrupt ZIP central directory');
    const method = buf.readUInt16LE(offset + 10);
    const compSize = buf.readUInt32LE(offset + 20);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localOffset = buf.readUInt32LE(offset + 42);
    const name = buf.subarray(offset + 46, offset + 46 + nameLen).toString('utf8');
    entries.push({ name, method, compSize, localOffset });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readEntry(buf, entry) {
  const base = entry.localOffset;
  if (buf.readUInt32LE(base) !== 0x04034b50) throw new Error(`Corrupt local header for ${entry.name}`);
  const nameLen = buf.readUInt16LE(base + 26);
  const extraLen = buf.readUInt16LE(base + 28);
  const start = base + 30 + nameLen + extraLen;
  const raw = buf.subarray(start, start + entry.compSize);
  if (entry.method === 0) return raw;
  if (entry.method === 8) return inflateRawSync(raw);
  throw new Error(`Unsupported ZIP compression method ${entry.method} for ${entry.name}`);
}

/** Total formula cells across every worksheet in the workbook. */
export function countFormulas(xlsxPath) {
  const buf = fs.readFileSync(xlsxPath);
  let total = 0;
  for (const entry of readEntries(buf)) {
    if (!/^xl\/worksheets\/.+\.xml$/.test(entry.name)) continue;
    const xml = readEntry(buf, entry).toString('utf8');
    // Worksheets may or may not use a namespace prefix on the formula element.
    total += (xml.match(/<(?:[A-Za-z0-9]+:)?f[ >\/]/g) || []).length;
  }
  return total;
}

/** Names of the entries in a ZIP archive (used to check what a packaged zip really holds). */
export function zipEntryNames(zipPath) {
  return readEntries(fs.readFileSync(zipPath)).map((entry) => entry.name);
}

/**
 * Rows in each worksheet, by sheet name: the count of row elements, which is what the
 * product page states as "<Sheet> — <n> rows". Read from the workbook's own sheet list and
 * relationships, so a renamed or reordered sheet cannot be matched to the wrong file.
 */
export function sheetRowCounts(xlsxPath) {
  const buf = fs.readFileSync(xlsxPath);
  const entries = new Map(readEntries(buf).map((entry) => [entry.name, entry]));
  const text = (name) => {
    const entry = entries.get(name);
    if (!entry) throw new Error(`${xlsxPath} has no ${name}`);
    return readEntry(buf, entry).toString('utf8');
  };
  const rels = new Map([...text('xl/_rels/workbook.xml.rels').matchAll(/<(?:[A-Za-z0-9]+:)?Relationship\b[^>]*>/g)]
    .map((m) => [m[0].match(/\bId="([^"]+)"/)?.[1], m[0].match(/\bTarget="([^"]+)"/)?.[1]]));
  const counts = {};
  for (const m of text('xl/workbook.xml').matchAll(/<(?:[A-Za-z0-9]+:)?sheet\b[^>]*>/g)) {
    const name = m[0].match(/\bname="([^"]+)"/)?.[1];
    const id = m[0].match(/\br:id="([^"]+)"/)?.[1];
    const target = rels.get(id);
    if (!name || !target) throw new Error(`${xlsxPath}: sheet ${name ?? '?'} has no worksheet part`);
    const part = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
    counts[name.replace(/&amp;/g, '&')] = (text(part).match(/<(?:[A-Za-z0-9]+:)?row[ >]/g) || []).length;
  }
  return counts;
}

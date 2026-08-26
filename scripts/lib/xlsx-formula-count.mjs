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

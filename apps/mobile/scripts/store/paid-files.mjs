// Writes the "archives" part of store/paid-files.json from the real private zips (names, sizes,
// sha256; never their contents), or checks a zip against it. The promises part is edited by hand.
//   node scripts/store/paid-files.mjs write <private dir>       (printables-v1.zip, day-of-kit-v1.zip)
//   node scripts/store/paid-files.mjs verify <archive id> <zip>  (exit 1 when it differs: a readback of R2)
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
const FILE = new URL('../../store/paid-files.json', import.meta.url);
const ZIPS = { printables: 'printables-v1.zip', day_of_kit: 'day-of-kit-v1.zip' };
const sha = b => createHash('sha256').update(b).digest('hex');

/** The files inside a zip (central directory), with their uncompressed bytes. */
export function zipEntries(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw Error('NOT_A_ZIP');
  const count = buf.readUInt16LE(eocd + 10); let at = buf.readUInt32LE(eocd + 16); const out = [];
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(at + 10), csize = buf.readUInt32LE(at + 20), nlen = buf.readUInt16LE(at + 28);
    const elen = buf.readUInt16LE(at + 30), clen = buf.readUInt16LE(at + 32), local = buf.readUInt32LE(at + 42);
    const name = buf.toString('utf8', at + 46, at + 46 + nlen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + csize);
    const data = method === 8 ? inflateRawSync(raw) : raw;
    out.push({ name, bytes: data.length, sha256: sha(data) });
    at += 46 + nlen + elen + clen;
  }
  return out;
}
export const archiveRecord = (key, buf) => ({ key, bytes: buf.length, sha256: sha(buf), files: zipEntries(buf) });

const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'write') {
  const doc = JSON.parse(readFileSync(FILE, 'utf8'));
  for (const [id, name] of Object.entries(ZIPS)) doc.archives[id] = archiveRecord(`app/${name}`, readFileSync(`${a}/${name}`));
  writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n');
  console.log('OUTPUT', Object.keys(ZIPS).length, 'archives written');
} else if (cmd === 'verify') {
  const want = JSON.parse(readFileSync(FILE, 'utf8')).archives[a];
  const got = readFileSync(b);
  if (!want || sha(got) !== want.sha256) { console.error(`NAMED STOP [PAID_ARCHIVE_DIFFERS] ${a}: ${b} is ${sha(got)}, paid-files.json says ${want?.sha256}`); process.exit(1); }
  console.log('OUTPUT', a, 'matches paid-files.json', want.files.length, 'files');
} else if (cmd) { console.error('usage: write <dir> | verify <archive id> <zip>'); process.exit(2); }

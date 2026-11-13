import { bytesToHex } from '@noble/ciphers/utils.js';
import type { ArchiveId } from './downloadStore';
export interface ArchiveRecord { id: ArchiveId; byteLength: number; sha256: string }
export interface ArchiveFiles {
  write(id: ArchiveId, bytes: Uint8Array): Promise<ArchiveRecord>;
  has(record: ArchiveRecord): Promise<boolean>;
  /** Where the saved file is, for the phone's share sheet; null when it is not on this phone. */
  uri(record: ArchiveRecord): Promise<string | null>;
  clear(): Promise<void>;
}
async function native() {
  const [{ File, Directory, Paths }, crypto] = await Promise.all([import('expo-file-system'), import('expo-crypto')]);
  const directory = new Directory(Paths.document, 'dw-purchased-archives');
  const digest = async (bytes: Uint8Array) => bytesToHex(new Uint8Array(await crypto.digest(crypto.CryptoDigestAlgorithm.SHA256, bytes as Uint8Array<ArrayBuffer>)));
  const file = (r: Pick<ArchiveRecord, 'id' | 'sha256'>) => new File(directory, `${r.id}-${r.sha256}.zip`);
  return { directory, digest, file };
}
/** Content-addressed files preserve the previous committed cache if a write fails. */
export function archiveFiles(load: typeof native = native): ArchiveFiles { return {
  async write(id, bytes) {
    const { directory, digest, file } = await load();
    const record = { id, byteLength: bytes.length, sha256: await digest(bytes) };
    directory.create({ intermediates: true, idempotent: true });
    file(record).write(bytes);
    const saved = file(record);
    if (!saved.exists || saved.size !== record.byteLength || await digest(await saved.bytes()) !== record.sha256) throw Error('Could not save purchased files.');
    return record;
  },
  async has(record) {
    const { file } = await load();
    const saved = file(record);
    return saved.exists && saved.size === record.byteLength;
  },
  async uri(record) {
    const { file } = await load();
    const saved = file(record);
    return saved.exists && saved.size === record.byteLength ? saved.uri : null;
  },
  async clear() {
    const { directory } = await load();
    if (directory.exists) directory.delete();
  },
}; }
export const phoneArchives = archiveFiles();

// An admin product upload is stored only when its bytes are the kind of file its name says
// (security audit 27 Nov 2026, check 17: the route trusted the extension alone, so a mislabelled
// file could become a product release). The type is read from the bytes by file-type; a .csv has no
// signature, so it must be UTF-8 text with no NUL byte. The accepted list itself is unchanged.
import { fileTypeFromBuffer } from 'file-type';

export const UPLOAD_MAX_BYTES = 50 * 1024 * 1024;
/** File extension → the type file-type must read from the bytes ('text' for CSV). */
const EXPECTED: Record<string, string> = {
  '.pdf': 'pdf', '.xlsx': 'xlsx', '.zip': 'zip', '.webp': 'webp', '.png': 'png', '.jpg': 'jpg', '.jpeg': 'jpg', '.csv': 'text',
};
export const UPLOAD_EXTENSIONS = Object.keys(EXPECTED);

export type UploadVerdict = { ok: true } | { ok: false; status: 413 | 415; error: string };

/** Size from the bytes actually received, never the size the client declared. */
export async function checkUpload(ext: string, bytes: Uint8Array): Promise<UploadVerdict> {
  const want = EXPECTED[ext];
  if (!want) return { ok: false, status: 415, error: 'Unsupported file type' };
  if (bytes.byteLength > UPLOAD_MAX_BYTES) return { ok: false, status: 413, error: 'File exceeds 50 MB limit' };
  if (bytes.byteLength === 0) return { ok: false, status: 415, error: 'The file is empty' };
  const found = (await fileTypeFromBuffer(bytes))?.ext;
  if (want === 'text') {
    if (found || bytes.includes(0)) return { ok: false, status: 415, error: `This file is not a CSV${found ? ` (it is a ${found} file)` : ''}` };
    try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return { ok: false, status: 415, error: 'This CSV is not UTF-8 text' }; }
    return { ok: true };
  }
  if (found !== want) return { ok: false, status: 415, error: `The file is named ${ext} but its contents are ${found ? `a ${found} file` : 'not a recognised file'}` };
  return { ok: true };
}

/** Version and kind become folders in the stored path: letters, digits, dot, dash and underscore only, never "..". */
export function safePathPart(v: string, max = 40): boolean {
  return v.length > 0 && v.length <= max && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(v) && !v.includes('..');
}

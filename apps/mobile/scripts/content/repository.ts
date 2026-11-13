import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { leaks, type Fingerprint } from './leaks';

export function repositoryLeaks(root: string, entries: Fingerprint[]) {
  if (!entries.length) throw Error('No private content fingerprints supplied');
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
  if (!files.length) throw Error('No repository files checked');
  const found = files.filter(file => {
    const bytes = readFileSync(resolve(root, file));
    return !bytes.includes(0) && leaks(bytes.toString('utf8'), entries);
  });
  return { files, found };
}

// Paid product FILES (the site's PDFs, workbooks and zips, $9 to $49) are private
// and live outside the repo (DW_PRODUCTS_DIR). The fingerprint scan above skips
// binaries, so this is the check that keeps them out: nothing tracked under the two
// old folders, and no document or archive named after a catalog product id or SKU.
export const PAID_FOLDERS = ['product-builds/releases/', 'product-builds/r2/products/'];
const PAID_FILE_TYPES = /\.(zip|pdf|xlsx|xls|csv|docx)$/i;
export function paidFilesTracked(root: string) {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
  if (!files.length) throw Error('No repository files checked');
  const catalog = JSON.parse(readFileSync(resolve(root, 'data/products/product_catalog.json'), 'utf8'));
  const names: string[] = (catalog.products ?? []).flatMap((p: { id: string; sku: string }) => [p.id, p.sku]).filter(Boolean).map((n: string) => n.toLowerCase());
  if (!names.length) throw Error('No paid product ids to check');
  const found = files.filter(file => {
    const lower = file.toLowerCase();
    return PAID_FOLDERS.some(folder => lower.startsWith(folder)) || (PAID_FILE_TYPES.test(lower) && names.some(name => lower.includes(name)));
  });
  return { files, names, found };
}

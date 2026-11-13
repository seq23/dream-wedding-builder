// The paid product files are private (owner ruling 10 Nov 2026: paid content never
// sits in a public repo). They live outside the repo, in DW_PRODUCTS_DIR, laid out
// exactly as they were here: product-builds/releases/* and
// product-builds/r2/products/<id>/current.zip. The repo keeps only the two
// manifests (names, sizes, SHA-256), which CI checks without the files.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const PRODUCTS_DIR = process.env.DW_PRODUCTS_DIR || path.join(os.homedir(), '.boss-os/dream-wedding/products');
export const RELEASE_DIR = path.join(PRODUCTS_DIR, 'product-builds/releases');
export const productsDirPresent = () => fs.existsSync(RELEASE_DIR);

// Named stop for anything that cannot do its job without the real files.
export function requireProductsDir(who) {
  if (productsDirPresent()) return PRODUCTS_DIR;
  console.error(`[PRODUCTS_DIR_MISSING] ${who}: the paid product files are not at ${RELEASE_DIR}. They are private and never in this repo. Set DW_PRODUCTS_DIR to the folder that holds product-builds/releases (default ~/.boss-os/dream-wedding/products), then run this again. Nothing was read, built or uploaded.`);
  process.exit(1);
}

import { defineConfig } from 'vitest/config';
import path from 'node:path';
// tsconfig sets jsx: 'preserve' because Next does the JSX transform. Vitest has no
// Next in front of it, so it needs its own transform to import a page module and
// read the metadata that page really exports.
// `node_modules/**` only excludes the top-level one. `next build` and
// `opennextjs-cloudflare build` copy dependency trees into `.next/standalone` and
// `.open-next/server-functions/*`, each with its own nested `node_modules` full of
// its packages' own *.test.js files - blake3-wasm, fraction.js, next's internals -
// which vitest then collects and fails on. CI builds after it tests, so it never
// saw this; anyone who builds first gets 24 red test FILES next to 963 green
// tests and has to work out that none of them is this repo's. Excluding generated
// output is the same rule the rest of the repo follows: it is never read and never
// edited (31 Oct 2026).
export default defineConfig({ oxc: { jsx: { runtime: 'automatic', importSource: 'react' } }, test: { environment: 'node', exclude: ['**/node_modules/**', 'tests/e2e/**', '.next/**', '.open-next/**'] }, resolve: { alias: { '@': path.resolve(__dirname, '.') } } });

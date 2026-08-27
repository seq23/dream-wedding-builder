import { defineConfig } from 'vitest/config';
import path from 'node:path';
// tsconfig sets jsx: 'preserve' because Next does the JSX transform. Vitest has no
// Next in front of it, so it needs its own transform to import a page module and
// read the metadata that page really exports.
export default defineConfig({ oxc: { jsx: { runtime: 'automatic', importSource: 'react' } }, test: { environment: 'node', exclude: ['node_modules/**', 'tests/e2e/**'] }, resolve: { alias: { '@': path.resolve(__dirname, '.') } } });

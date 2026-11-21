import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REPORT_ADDRESS, reportAnswerLink } from '../src/reportAnswer';

const root = join(import.meta.dirname, '..');
const files = (dir: string): string[] => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : [p]; });

// Apple Guideline 1.2 (app-review row 10): every AI answer can be reported on iOS, not only Android.
test('report control: every screen that shows an AI answer offers Report, with no platform or build switch', () => {
  const aiScreens = files(join(root, 'app')).filter(f => /\b(aiDraftClient|weddingReadClient)\b/.test(readFileSync(f, 'utf8')));
  assert.ok(aiScreens.length >= 2, 'found the AI description and AI draft screens');
  for (const f of aiScreens) assert.match(readFileSync(f, 'utf8'), /<ReportAnswer\b/, `${f} shows AI text with no Report action`);
  const control = readFileSync(join(root, 'src/ReportAnswerLink.tsx'), 'utf8');
  assert.doesNotMatch(control, /Platform|process\.env|return null/, 'the Report action must render on every platform');
});
test('report link: mails the existing address with the answer quoted and capped', () => {
  const link = reportAnswerLink('A garden wedding in June.', 'Your wedding, described');
  const url = new URL(link);
  assert.equal(url.protocol, 'mailto:');
  assert.equal(url.pathname, REPORT_ADDRESS);
  const body = decodeURIComponent(link.split('&body=')[1]);
  assert.match(body, /A garden wedding in June\./);
  assert.match(body, /Your wedding, described/);
  const long = decodeURIComponent(reportAnswerLink('x'.repeat(5000), 'Draft').split('&body=')[1]);
  assert.ok(long.length < 1500);
});

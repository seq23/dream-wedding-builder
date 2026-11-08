import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

// authority:scale:restore (the daily full-safe-autonomy run) rebuilds frozen
// pages from these blobs and fails when one is missing. #70 re-froze three
// pages and committed the registry without their blobs, so every daily run from
// 3 Nov 2026 stopped there. This holds the committed registry to its blobs.
const root = process.cwd();
const reg = JSON.parse(
  fs.readFileSync(path.join(root, 'data/release/frozen_output_registry.json'), 'utf8'),
) as { records: Record<string, { slug: string; sha256: string; blob: string }> };

describe('frozen output registry', () => {
  const records = Object.entries(reg.records || {});

  it('has records to check', () => {
    expect(records.length).toBeGreaterThan(0);
  });

  it('every record has a committed blob whose content hashes to its sha256', () => {
    const bad: string[] = [];
    for (const [route, r] of records) {
      const blob = path.join(root, r.blob || '');
      if (!r.blob || !fs.existsSync(blob)) { bad.push(`${route}: blob missing (${r.blob})`); continue; }
      const raw = zlib.gunzipSync(fs.readFileSync(blob));
      const h = crypto.createHash('sha256').update(raw).digest('hex');
      if (h !== r.sha256) bad.push(`${route}: blob hash ${h} != ${r.sha256}`);
      else if (JSON.parse(raw.toString('utf8')).slug !== r.slug) bad.push(`${route}: blob slug mismatch`);
    }
    expect(bad).toEqual([]);
  });
  // #108 recomposed six guides in content_registry.json without re-freezing
  // them, so the daily restore put the old compositions back and
  // validate:composition-spec failed on main (8 Nov 2026). The committed guide
  // content must be exactly what is frozen, so restore changes nothing.
  it('every committed guide hashes to its frozen record, so restore is a no-op', () => {
    const sortObj = (o: unknown): unknown => Array.isArray(o) ? o.map(sortObj)
      : (o && typeof o === 'object' ? Object.fromEntries(Object.keys(o as object).sort().map((k) => [k, sortObj((o as Record<string, unknown>)[k])])) : o);
    const pages = (JSON.parse(fs.readFileSync(path.join(root, 'data/authority/content_registry.json'), 'utf8')).pages || []) as { slug: string }[];
    const bySlug = new Map(pages.map((p) => [p.slug, p]));
    const drift: string[] = [];
    for (const [route, r] of records) {
      const p = bySlug.get(r.slug);
      if (!p) { drift.push(`${route}: frozen but not in content_registry`); continue; }
      const h = crypto.createHash('sha256').update(Buffer.from(JSON.stringify(sortObj(p)) + '\n')).digest('hex');
      if (h !== r.sha256) drift.push(`${route}: content ${h} != frozen ${r.sha256} (run authority:scale:freeze with the route in data/release/active_mutation_scope.json)`);
    }
    expect(drift).toEqual([]);
  });
});

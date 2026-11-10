import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

// The newest migration records itself in schema_version, and re-applying every
// migration in order is a no-op (additive, idempotent shapes only).
const files = readdirSync('migrations').filter(f => f.endsWith('.sql')).sort();

describe('migrations', () => {
  it('the newest migration ends by recording itself in schema_version', () => {
    const newest = files[files.length - 1];
    const stem = newest.replace(/\.sql$/, '');
    expect(readFileSync(`migrations/${newest}`, 'utf8')).toMatch(new RegExp(`INSERT OR IGNORE INTO schema_version \\(migration\\) VALUES \\('${stem}'\\);\\s*$`));
  });

  it('applying every migration twice is a no-op and the newest is recorded once', () => {
    const db = new DatabaseSync(':memory:');
    for (const pass of [1, 2]) for (const f of files) db.exec(readFileSync(`migrations/${f}`, 'utf8').replace('PRAGMA foreign_keys = ON;', ''));
    const rows = db.prepare('SELECT migration FROM schema_version').all() as { migration: string }[];
    expect(rows.map(r => r.migration)).toEqual([files[files.length - 1].replace(/\.sql$/, '')]);
    for (const f of files) expect(readFileSync(`migrations/${f}`, 'utf8'), f).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b/i);
  });
});

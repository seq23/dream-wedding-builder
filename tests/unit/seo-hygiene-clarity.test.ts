// Guard: the Clarity map holds every canonical host with its owner-supplied project id,
// the generated same-origin loader carries the same map, and the layout loads it.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import clarity from '@/data/clarity_projects.json';
import { HOSTS } from './helpers/site-homes';

const EXPECTED: Record<string, string> = {
  'weddingchecklistpdf.com': 'y7kxxtr48q',
  'weddingbudgetspreadsheet.com': 'y7kzpu45jb',
  'weddingseatingchartmaker.com': 'y7kyy3fwc0',
  'weddingtimelinetemplate.com': 'y7l01t5b04'
};

describe('Clarity project map', () => {
  it('covers all four hosts', () => { expect(HOSTS.length).toBe(4); });
  it('maps exactly the canonical hosts to the expected ids', () => {
    expect(Object.keys(clarity.projects).sort()).toEqual([...HOSTS].sort());
    expect(clarity.projects).toEqual(EXPECTED);
  });
  it('the committed loader resolves every host to its id', () => {
    const loader = readFileSync('public/assets/clarity-loader.js', 'utf8');
    for (const [host, id] of Object.entries(EXPECTED)) expect(loader).toContain(`"${host}":"${id}"`);
    expect(loader).toContain('location.hostname');
  });
  it('the root layout loads it and the build regenerates it', () => {
    expect(readFileSync('app/layout.tsx', 'utf8')).toContain('src="/assets/clarity-loader.js"');
    expect(JSON.parse(readFileSync('package.json', 'utf8')).scripts.build).toContain('scripts/install_clarity.mjs');
  });
});

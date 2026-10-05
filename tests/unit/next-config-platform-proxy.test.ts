import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_EXPORT,
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER
} from 'next/constants';

// next.config.ts must start the Miniflare bindings proxy only for `next dev`.
// A module-level call ran in every build process (main + each jest-worker child) on
// one shared .wrangler/state and crashed the 2026-10-05 Full Safe Autonomy build with
// SQLITE_BUSY. These tests load the real config with the proxy mocked.
const init = vi.fn(async () => {});
vi.mock('@opennextjs/cloudflare', () => ({ initOpenNextCloudflareForDev: init }));

async function loadConfig(phase: string) {
  vi.resetModules();
  const mod = await import('../../next.config');
  expect(typeof mod.default).toBe('function');
  return (mod.default as (p: string) => Promise<Record<string, unknown>>)(phase);
}

describe('next.config platform proxy', () => {
  beforeEach(() => init.mockClear());

  it('loading the config module starts no proxy by itself', async () => {
    vi.resetModules();
    await import('../../next.config');
    await new Promise((r) => setTimeout(r, 0));
    expect(init).toHaveBeenCalledTimes(0);
  });

  const nonDevPhases = [PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER, PHASE_EXPORT];
  it.each(nonDevPhases)('phase %s starts no proxy and still returns the config', async (phase) => {
    const cfg = await loadConfig(phase);
    expect(init).toHaveBeenCalledTimes(0);
    expect(typeof cfg.redirects).toBe('function');
  });

  it('phase-development-server starts the proxy exactly once', async () => {
    const cfg = await loadConfig(PHASE_DEVELOPMENT_SERVER);
    expect(init).toHaveBeenCalledTimes(1);
    expect(typeof cfg.redirects).toBe('function');
  });

  it('covers at least one non-dev phase', () => {
    expect(nonDevPhases.length).toBeGreaterThan(0);
  });
});

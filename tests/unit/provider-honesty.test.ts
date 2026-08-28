import { describe, expect, it } from 'vitest';
// @ts-expect-error - plain ESM helper, no types
import { assertHonestProviderState, PROVIDER_STATES } from '../../scripts/search_intelligence/lib.mjs';

// The regression these lock: on 2026-08-28T15:40 the scheduled search lane
// printed "GSC: AVAILABLE requests=0 rows_added=0" and committed that state,
// having made no Search Console request because four site-URL secrets were
// unset. AVAILABLE now carries requests>0 in its definition.
describe('provider status honesty', () => {
  it('refuses AVAILABLE when nothing was requested', () => {
    expect(() => assertHonestProviderState('gsc', { state: 'AVAILABLE', requests: 0, rows_added: 0 }))
      .toThrow(/AVAILABLE with requests=0/);
  });

  it('refuses AVAILABLE when the request count is absent', () => {
    expect(() => assertHonestProviderState('gsc', { state: 'AVAILABLE', rows_added: 0 })).toThrow(/requests=absent/);
  });

  it('accepts AVAILABLE only when the provider was actually asked', () => {
    expect(() => assertHonestProviderState('gsc', { state: 'AVAILABLE', requests: 4, rows_added: 2 })).not.toThrow();
  });

  it('accepts a zero-request run only under a named state carrying a reason', () => {
    expect(() => assertHonestProviderState('gsc', { state: 'MISCONFIGURED', requests: 0, reason: 'no site URL configured' })).not.toThrow();
    expect(() => assertHonestProviderState('gsc', { state: 'MISCONFIGURED', requests: 0 })).toThrow(/must carry a reason/);
  });

  it('rejects any state that is not one of the named outcomes', () => {
    expect(() => assertHonestProviderState('gsc', { state: 'OK', requests: 1 })).toThrow(/unnamed state/);
    expect(Object.keys(PROVIDER_STATES)).toContain('MISCONFIGURED');
  });
});

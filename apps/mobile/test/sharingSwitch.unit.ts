// Partner sharing is unfinished (docs/app-sharing-protocol.md: the server route is off in
// production). With the switch off, which is the default, the app must not sell a second
// phone and must not show the share controls; turning the switch on brings both back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SHARING, fullPlanLines, fullPlanSummary, sharingControlsShown, twoPhonesLink } from '../src/sharingSwitch';
import { OFFER_DETAIL } from '../src/billing/offers';

const partner = /partner|second phone|two phones/i;

test('sharing switch off: the paywall list sells no partner phone and no share control renders', () => {
  assert.equal(SHARING, false, 'a build without EXPO_PUBLIC_DW_SHARING=1 has sharing off');
  const lines = fullPlanLines();
  assert.ok(lines.length >= 5, 'the paywall still lists what the full plan adds');
  for (const line of lines) assert.doesNotMatch(line, partner);
  assert.doesNotMatch(fullPlanSummary().short, partner);
  assert.doesNotMatch(fullPlanSummary().offer, partner);
  assert.doesNotMatch(OFFER_DETAIL.dw_full_plan, partner, 'the full plan offer card');
  assert.equal(twoPhonesLink(true), null, 'no Two phones link on More once paid');
  assert.equal(twoPhonesLink(false), null, 'no Two phones link on More before paying');
  assert.equal(sharingControlsShown(), false, 'the sharing screen shows no Send the link control');
  // Turning the switch on is the only change needed to sell and show sharing again.
  assert.ok(fullPlanLines(true).some(l => partner.test(l)));
  assert.deepEqual(twoPhonesLink(true, true), { href: '/more/sharing', label: 'Two phones: share with my partner ›' });
  assert.equal(sharingControlsShown(true), true);
});

test('sharing switch off: no store listing draft promises a partner phone', () => {
  assert.equal(SHARING, false);
  const section = (file: string, start: string, end: string) => {
    const text = readFileSync(new URL(`../store/${file}`, import.meta.url), 'utf8');
    const from = text.indexOf(start), to = text.indexOf(end, from + 1);
    assert.ok(from >= 0 && to > from, `${file} has its ${start} section`);
    return text.slice(from, to);
  };
  const listings = [
    section('google-play.md', '## Title', '## Other listing fields'),
    section('app-store-next-version.md', '## Description: full plan list', '## End of description list'),
  ];
  for (const copy of listings) {
    assert.ok(copy.includes('• '), 'the full-plan list is present');
    assert.doesNotMatch(copy, partner);
  }
});

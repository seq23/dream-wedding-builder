// Partner sharing is unfinished (docs/app-sharing-protocol.md: the server route is off in
// production). With the switch off, which is the default, the app must not sell a second
// phone and must not show the share controls; turning the switch on brings both back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
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

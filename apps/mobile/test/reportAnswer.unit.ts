import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REPORT_ADDRESS, reportAnswerLink, reportAnswerShown } from '../src/reportAnswer';
test('report control: on for Android, off for iOS and web unless the flag is set', () => {
  assert.equal(reportAnswerShown('android', undefined), true);
  assert.equal(reportAnswerShown('ios', undefined), false);
  assert.equal(reportAnswerShown('web', undefined), false);
  assert.equal(reportAnswerShown('ios', '0'), false);
  assert.equal(reportAnswerShown('ios', '1'), true);
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

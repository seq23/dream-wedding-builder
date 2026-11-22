import { describe, expect, it } from 'vitest';
import { domainAcceptsMail } from '@/lib/email-domain';

// A fake DNS-over-HTTPS resolver: name|type -> reply.
function doh(table: Record<string, { Status: number; Answer?: Array<{ type: number; data: string }> }>) {
  return (async (url: string) => {
    const u = new URL(url);
    const reply = table[`${u.searchParams.get('name')}|${u.searchParams.get('type')}`] ?? { Status: 0 };
    return new Response(JSON.stringify(reply), { status: 200 });
  }) as unknown as typeof fetch;
}

describe('real-email check before the sample is sent', () => {
  it('accepts a domain with mail servers', async () => {
    expect(await domainAcceptsMail('a@gmail.com', doh({ 'gmail.com|MX': { Status: 0, Answer: [{ type: 15, data: '5 gmail-smtp-in.l.google.com.' }] } }))).toBe('OK');
  });
  it('refuses a domain that does not exist (typo) and one that says it takes no mail', async () => {
    expect(await domainAcceptsMail('a@gmial.con', doh({ 'gmial.con|MX': { Status: 3 } }))).toBe('NO_MAIL');
    expect(await domainAcceptsMail('a@nomail.example', doh({ 'nomail.example|MX': { Status: 0, Answer: [{ type: 15, data: '0 .' }] } }))).toBe('NO_MAIL');
    expect(await domainAcceptsMail('a@parked.example', doh({ 'parked.example|MX': { Status: 0 } }))).toBe('NO_MAIL');
  });
  it('accepts a domain with no MX but an address record (implicit MX)', async () => {
    expect(await domainAcceptsMail('a@small.example', doh({ 'small.example|MX': { Status: 0 }, 'small.example|A': { Status: 0, Answer: [{ type: 1, data: '192.0.2.1' }] } }))).toBe('OK');
  });
  it('outage: a resolver that is down never loses the sign-up', async () => {
    const down = (async () => { throw new Error('network'); }) as unknown as typeof fetch;
    expect(await domainAcceptsMail('a@gmail.com', down)).toBe('UNCHECKED');
    const fivehundred = (async () => new Response('x', { status: 502 })) as unknown as typeof fetch;
    expect(await domainAcceptsMail('a@gmail.com', fivehundred)).toBe('UNCHECKED');
  });
});

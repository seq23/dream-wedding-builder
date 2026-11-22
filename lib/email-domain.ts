// The real-email check before the sample is sent (launch kit, 21 Nov 2026): the address's domain
// must be able to receive mail. One DNS-over-HTTPS lookup to Cloudflare's public resolver ($0):
// an MX record (not the "no mail" null MX), or failing that an A/AAAA record (RFC 5321 implicit
// MX). A domain that does not exist, or has neither, is refused before anything is stored or sent.
// If the resolver itself is down or slow, the sign-up goes ahead: our outage never loses a
// visitor's request (Turnstile, the rate limit and the daily ceiling still apply).
const DOH = 'https://cloudflare-dns.com/dns-query';
type Answer = { type: number; data: string };
type DohReply = { Status: number; Answer?: Answer[] };

async function lookup(name: string, type: 'MX' | 'A' | 'AAAA', fetchImpl: typeof fetch): Promise<DohReply> {
  const res = await fetchImpl(`${DOH}?name=${encodeURIComponent(name)}&type=${type}`, { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(2500) });
  if (!res.ok) throw new Error(`DoH HTTP ${res.status}`);
  return (await res.json()) as DohReply;
}

export type DomainVerdict = 'OK' | 'NO_MAIL' | 'UNCHECKED';

export async function domainAcceptsMail(email: string, fetchImpl: typeof fetch = fetch): Promise<DomainVerdict> {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  if (!domain) return 'NO_MAIL';
  try {
    const mx = await lookup(domain, 'MX', fetchImpl);
    if (mx.Status === 3) return 'NO_MAIL'; // NXDOMAIN: the domain does not exist
    const records = (mx.Answer ?? []).filter((a) => a.type === 15);
    if (records.length) return records.every((a) => /^0\s+\.?$/.test(a.data.trim())) ? 'NO_MAIL' : 'OK';
    for (const t of ['A', 'AAAA'] as const) {
      const r = await lookup(domain, t, fetchImpl);
      if ((r.Answer ?? []).some((a) => a.type === (t === 'A' ? 1 : 28))) return 'OK';
    }
    return mx.Status === 0 ? 'NO_MAIL' : 'UNCHECKED';
  } catch {
    return 'UNCHECKED';
  }
}

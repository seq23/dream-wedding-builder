import { GET as feed } from '../pinfeed.xml/route';

// /pinfeed (and /pinfeed/, which Next redirects here) serves the same feed as the
// canonical /pinfeed.xml.
export const dynamic = 'force-dynamic';
export function GET(request: Request): Response { return feed(request); }

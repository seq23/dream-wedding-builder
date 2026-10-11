import { siteIconResponse } from '@/lib/site-home';

// Per-host bytes: one Worker serves four sites, so a file in public/ would be the
// same icon on every host. See scripts/seo/generate_site_icons.py.
export const dynamic = 'force-dynamic';
export function GET(request: Request) {
  return siteIconResponse(request.headers.get('x-forwarded-host') ?? request.headers.get('host'), 'og.png');
}

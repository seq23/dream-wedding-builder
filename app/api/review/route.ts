import { runtimeEnv } from '@/lib/cloudflare-runtime';
import { reviewStatus } from '@/lib/review-unlock';

// GET /api/review: 200 while a Play review window is open, else 404 (the app then shows no code link).
export async function GET() {
  try { return reviewStatus(await runtimeEnv()); }
  catch { return reviewStatus({}); }
}

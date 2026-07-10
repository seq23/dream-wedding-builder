import crypto from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE = 'dwb_admin_session';
const MAX_AGE = 60 * 60 * 8;

function b64url(value: Buffer | string) {
  return Buffer.from(value).toString('base64url');
}
function sign(payload: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}
export function verifyPassword(password: string, encoded = process.env.ADMIN_PASSWORD_HASH || '') {
  const [kind, saltB64, hashB64] = encoded.split('$');
  if (kind !== 'scrypt' || !saltB64 || !hashB64) return false;
  const salt = Buffer.from(saltB64, 'base64url');
  const expected = Buffer.from(hashB64, 'base64url');
  const actual = crypto.scryptSync(password, salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
export function createPasswordHash(password: string) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 32);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}
export async function createAdminSession() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('ADMIN_SESSION_SECRET is not configured');
  const payload = b64url(JSON.stringify({ role: 'owner', exp: Math.floor(Date.now()/1000)+MAX_AGE }));
  const token = `${payload}.${sign(payload,secret)}`;
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly:true, secure:process.env.NODE_ENV==='production', sameSite:'lax', path:'/', maxAge:MAX_AGE });
}
export async function clearAdminSession(){ const jar=await cookies(); jar.set(COOKIE,'',{httpOnly:true,path:'/',maxAge:0}); }
export async function requireAdmin(){
  const secret=process.env.ADMIN_SESSION_SECRET; if(!secret) return false;
  const jar=await cookies(); const token=jar.get(COOKIE)?.value; if(!token) return false;
  const [payload,sig]=token.split('.'); if(!payload||!sig) return false;
  const expected=sign(payload,secret); if(sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))) return false;
  try { const decoded=JSON.parse(Buffer.from(payload,'base64url').toString('utf8')); return decoded.role==='owner'&&decoded.exp>Math.floor(Date.now()/1000); } catch { return false; }
}

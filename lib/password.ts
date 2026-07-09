import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';

/** Hash a password with scrypt (built-in, no dependency). Format: salt:hash (hex). */
export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pw, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/** Constant-time verify against a stored salt:hash string. */
export function verifyPassword(pw: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  try {
    const h = scryptSync(pw, salt, 64);
    const hb = Buffer.from(hash, 'hex');
    return h.length === hb.length && timingSafeEqual(h, hb);
  } catch { return false; }
}

/** Generate a readable temporary password (no ambiguous chars like O/0, l/1). */
export function genPassword(len = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const b = randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += chars[b[i] % chars.length];
  return s;
}

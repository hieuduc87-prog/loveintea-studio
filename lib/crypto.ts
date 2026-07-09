/**
 * AES-256-GCM encryption for storing sensitive tokens in the DB.
 * TOKEN_ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars).
 * Generate: openssl rand -hex 32
 */
import crypto from 'crypto';

const ALGO = 'aes-256-gcm';

/**
 * Constant-time string comparison for secrets/signatures (webhook tokens, HMAC
 * digests). Plain `===`/`!==` on secrets leaks length + per-byte match timing,
 * which is enough to forge a valid signature. Always use this for L1-supplied
 * values compared against a server secret.
 */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false; // length is not secret here
  return crypto.timingSafeEqual(ba, bb);
}

function getKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). Run: openssl rand -hex 32');
  }
  return Buffer.from(key, 'hex');
}

export function encrypt(plain: string): { enc: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    enc: enc.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

export function decrypt(enc: string, iv: string, tag: string): string {
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(enc, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

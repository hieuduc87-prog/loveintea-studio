export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const ALLOWED_KEYS = [
  'schedule_slots',      // JSON array of hours e.g. [8,12,15,19]
  'schedule_platform',   // "facebook" | "instagram" | "both"
  'schedule_posts_day',  // number as string
];

export async function GET(req: NextRequest) {
  const db = getDb();
  const keys = req.nextUrl.searchParams.get('keys')?.split(',') ?? ALLOWED_KEYS;
  const get = (k: string) => (db.prepare('SELECT value FROM settings WHERE key=?').get(k) as { value: string } | undefined)?.value ?? null;

  const result: Record<string, string | null> = {};
  for (const k of keys) {
    if (ALLOWED_KEYS.includes(k)) result[k] = get(k);
  }
  return NextResponse.json(result);
}

export async function PATCH(req: NextRequest) {
  const db = getDb();
  const body = await req.json() as Record<string, string>;
  const upsert = db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
  `);
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_KEYS.includes(k)) upsert.run(k, v);
  }
  return NextResponse.json({ ok: true });
}

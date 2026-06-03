export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const get = (key: string) => (db.prepare('SELECT value FROM settings WHERE key=?').get(key) as { value: string } | undefined)?.value ?? '';

  const pageId    = process.env.FB_PAGE_ID     || get('FB_PAGE_ID');
  const pageToken = process.env.FB_PAGE_ACCESS_TOKEN || get('FB_PAGE_ACCESS_TOKEN');
  const igId      = process.env.IG_BUSINESS_ACCOUNT_ID || get('IG_BUSINESS_ACCOUNT_ID');
  const pageName  = get('FB_PAGE_NAME');

  const connected = Boolean(pageId && pageToken);
  let pageInfo: Record<string, unknown> = {};

  if (connected) {
    try {
      const r = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}?fields=id,name,fan_count,picture&access_token=${pageToken}`
      );
      pageInfo = await r.json() as Record<string, unknown>;
    } catch { /* ignore */ }
  }

  return NextResponse.json({ connected, pageId, pageName, igId, pageInfo });
}

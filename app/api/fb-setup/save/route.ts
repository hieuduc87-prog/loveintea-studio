export const dynamic = 'force-dynamic';
/**
 * Save selected page credentials to settings DB.
 * Optionally get IG Business Account linked to this page.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { pageId, pageAccessToken, pageName } = await req.json();
    if (!pageId || !pageAccessToken) {
      return NextResponse.json({ error: 'pageId and pageAccessToken required' }, { status: 400 });
    }

    const db = getDb();

    // Save page credentials
    const upsert = (key: string, value: string) =>
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);

    upsert('FB_PAGE_ID', pageId);
    upsert('FB_PAGE_ACCESS_TOKEN', pageAccessToken);
    upsert('FB_PAGE_NAME', pageName ?? '');

    // Try to find linked IG Business Account
    let igAccountId = '';
    try {
      const igRes = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}`
      );
      const igData = await igRes.json() as { instagram_business_account?: { id: string } };
      igAccountId = igData.instagram_business_account?.id ?? '';
      if (igAccountId) upsert('IG_BUSINESS_ACCOUNT_ID', igAccountId);
    } catch { /* ig not linked */ }

    return NextResponse.json({ ok: true, pageId, pageName, igAccountId });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
/**
 * POST /api/fb-setup/save — save page credentials for a brand.
 * Works with tokens from any source: OAuth flow, Graph API Explorer,
 * or a Business Manager System User (recommended for customer brands).
 *
 * - Verifies the token against Graph API BEFORE saving (rejects invalid).
 * - Stores AES-256-GCM-encrypted in the per-brand `channels` table.
 * - Mirrors to legacy `settings` keys when saving the default brand
 *   so older code paths keep working.
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/db';
import { encrypt } from '@/lib/crypto';

export async function POST(req: NextRequest) {
  try {
    const { pageId, pageAccessToken, pageName, brandId } = await req.json() as {
      pageId?: string; pageAccessToken?: string; pageName?: string; brandId?: string;
    };
    if (!pageId || !pageAccessToken) {
      return NextResponse.json({ error: 'pageId and pageAccessToken required' }, { status: 400 });
    }
    const bid = brandId || 'loveintea';

    // 1. Verify the token actually works for this page BEFORE saving
    const vr = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}?fields=id,name,instagram_business_account&access_token=${pageAccessToken}`
    );
    const vd = await vr.json() as {
      id?: string; name?: string;
      instagram_business_account?: { id: string };
      error?: { message: string };
    };
    if (!vd.id) {
      return NextResponse.json(
        { error: `Token không hợp lệ cho page này: ${vd.error?.message ?? 'unknown error'}` },
        { status: 400 }
      );
    }
    const verifiedName = vd.name ?? pageName ?? '';
    const igAccountId = vd.instagram_business_account?.id ?? '';

    const db = getDb();

    // 2. Save encrypted into per-brand channels
    const tokEnc = encrypt(pageAccessToken);
    const credentials = JSON.stringify({
      page_id: pageId,
      page_name: verifiedName,
      ig_account_id: igAccountId,
      token_enc: tokEnc.enc,
      token_iv: tokEnc.iv,
      token_tag: tokEnc.tag,
    });

    const existing = db.prepare(
      `SELECT id FROM channels WHERE brand_id=? AND platform='facebook'`
    ).get(bid) as { id: string } | undefined;

    if (existing) {
      db.prepare(`UPDATE channels SET name=?, credentials=?, status='active' WHERE id=?`)
        .run(verifiedName, credentials, existing.id);
    } else {
      db.prepare(`INSERT INTO channels (id, brand_id, platform, name, credentials, status) VALUES (?,?,?,?,?,'active')`)
        .run(crypto.randomBytes(12).toString('hex'), bid, 'facebook', verifiedName, credentials);
    }

    // 3. Legacy mirror for the default brand
    if (bid === 'loveintea') {
      const upsert = (key: string, value: string) =>
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
      upsert('FB_PAGE_ID', pageId);
      upsert('FB_PAGE_ACCESS_TOKEN', pageAccessToken);
      upsert('FB_PAGE_NAME', verifiedName);
      if (igAccountId) upsert('IG_BUSINESS_ACCOUNT_ID', igAccountId);
    }

    return NextResponse.json({ ok: true, brandId: bid, pageId, pageName: verifiedName, igAccountId });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

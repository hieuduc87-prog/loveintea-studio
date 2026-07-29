export const dynamic = 'force-dynamic';
/**
 * GET  /api/auth/facebook/pages   — list all connected pages for current user
 * POST /api/auth/facebook/pages   — activate a specific page (body: { pageId })
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';
import { encrypt } from '@/lib/crypto';
import { decrypt } from '@/lib/crypto';
import { requireAdminSession } from '@/lib/api-auth';

const OWNER_USER_ID = 'owner';

interface FbPageRow {
  id: string;
  page_id: string;
  page_name: string;
  page_token_enc: string;
  page_token_iv: string;
  page_token_tag: string;
  ig_account_id: string;
  is_active: number;
  connection_id: string;
  fb_user_name: string;
  expires_at: string;
}

function upsertSetting(db: ReturnType<typeof getDb>, key: string, value: string) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export async function GET() {
  // Under /api/auth (middleware-excluded) → authenticate in-handler.
  const auth = await requireAdminSession();
  if ('error' in auth) return auth.error;
  try {
    const db = getDb();
    const pages = db.prepare(`
      SELECT p.*, c.fb_user_name, c.expires_at
      FROM fb_pages p
      JOIN fb_connections c ON c.id = p.connection_id
      WHERE c.user_id = ?
      ORDER BY p.is_active DESC, p.page_name ASC
    `).all(OWNER_USER_ID) as FbPageRow[];

    return NextResponse.json({
      connected: pages.length > 0,
      pages: pages.map(p => ({
        id: p.id,
        pageId: p.page_id,
        pageName: p.page_name,
        igAccountId: p.ig_account_id,
        isActive: Boolean(p.is_active),
        fbUserName: p.fb_user_name,
        expiresAt: p.expires_at,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Under /api/auth (middleware-excluded) → authenticate in-handler.
  const auth = await requireAdminSession();
  if ('error' in auth) return auth.error;
  try {
    const { pageId } = await req.json() as { pageId?: string };
    if (!pageId) return NextResponse.json({ error: 'pageId required' }, { status: 400 });

    const db = getDb();

    // Get the target page (verify it belongs to this user's connection)
    const page = db.prepare(`
      SELECT p.* FROM fb_pages p
      JOIN fb_connections c ON c.id = p.connection_id
      WHERE c.user_id = ? AND p.page_id = ?
    `).get(OWNER_USER_ID, pageId) as FbPageRow | undefined;

    if (!page) return NextResponse.json({ error: 'Page not found' }, { status: 404 });

    // Deactivate all, then activate this one
    db.prepare(`
      UPDATE fb_pages SET is_active=0
      WHERE connection_id = ?
    `).run(page.connection_id);
    db.prepare('UPDATE fb_pages SET is_active=1 WHERE id=?').run(page.id);

    // LỖ HỔNG ĐÃ VÁ (29/07): trước đây ghi THẲNG vào settings FB_* dùng chung —
    // brand B chọn page là ĐÈ token brand A → A đăng bài lên page của B.
    // Giờ: lưu vào channels THEO BRAND (mã hoá), settings chỉ mirror cho loveintea.
    const pageToken = decrypt(page.page_token_enc, page.page_token_iv, page.page_token_tag);
    const bid = getBrandId(req) || 'loveintea';
    const enc = encrypt(pageToken);
    const credentials = JSON.stringify({
      page_id: page.page_id, page_name: page.page_name,
      ig_account_id: page.ig_account_id || '',
      token_enc: enc.enc, token_iv: enc.iv, token_tag: enc.tag,
    });
    const existing = db.prepare(`SELECT id FROM channels WHERE brand_id=? AND platform='facebook'`)
      .get(bid) as { id: string } | undefined;
    if (existing) {
      db.prepare(`UPDATE channels SET name=?, credentials=?, status='active' WHERE id=?`)
        .run(page.page_name, credentials, existing.id);
    } else {
      db.prepare(`INSERT INTO channels (id, brand_id, platform, name, credentials, status) VALUES (?,?,?,?,?,'active')`)
        .run(crypto.randomBytes(12).toString('hex'), bid, 'facebook', page.page_name, credentials);
    }
    if (bid === 'loveintea') {
      upsertSetting(db, 'FB_PAGE_ID', page.page_id);
      upsertSetting(db, 'FB_PAGE_ACCESS_TOKEN', pageToken);
      upsertSetting(db, 'FB_PAGE_NAME', page.page_name);
      if (page.ig_account_id) upsertSetting(db, 'IG_BUSINESS_ACCOUNT_ID', page.ig_account_id);
    }

    return NextResponse.json({ ok: true, pageId: page.page_id, pageName: page.page_name });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

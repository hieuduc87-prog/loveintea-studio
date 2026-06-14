export const dynamic = 'force-dynamic';
/**
 * POST /api/auth/facebook/disconnect
 * Revokes FB permissions + deletes connection from DB + clears settings.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { revokePermissions } from '@/lib/facebook';

const OWNER_USER_ID = 'owner';

export async function POST() {
  try {
    const db = getDb();

    const conn = db.prepare(
      'SELECT * FROM fb_connections WHERE user_id=?'
    ).get(OWNER_USER_ID) as {
      id: string; user_token_enc: string; user_token_iv: string; user_token_tag: string
    } | undefined;

    if (conn) {
      // Revoke FB permissions (best-effort, don't fail if FB is down)
      try {
        const userToken = decrypt(conn.user_token_enc, conn.user_token_iv, conn.user_token_tag);
        await revokePermissions(userToken);
      } catch { /* ignore */ }

      // Delete from DB (cascades to fb_pages)
      db.prepare('DELETE FROM fb_connections WHERE id=?').run(conn.id);
    }

    // Clear settings table
    const clearKeys = ['FB_PAGE_ID', 'FB_PAGE_ACCESS_TOKEN', 'FB_PAGE_NAME', 'IG_BUSINESS_ACCOUNT_ID'];
    for (const key of clearKeys) {
      db.prepare('DELETE FROM settings WHERE key=?').run(key);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

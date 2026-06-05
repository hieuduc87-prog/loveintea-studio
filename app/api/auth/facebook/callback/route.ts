export const dynamic = 'force-dynamic';
/**
 * GET /api/auth/facebook/callback
 * Handles FB OAuth redirect. Validates CSRF state, exchanges code for tokens,
 * fetches all managed pages, encrypts and stores everything in DB.
 * Also updates the settings table for backward compat with existing publish code.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { getDb } from '@/lib/db';
import { encrypt } from '@/lib/crypto';
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getFbUser,
  getUserPages,
  getLinkedIgAccount,
} from '@/lib/facebook';

// For single-user app; replace with session-based user ID for multi-tenant
const OWNER_USER_ID = 'owner';

function newId() {
  return crypto.randomBytes(12).toString('hex');
}

function upsertSetting(db: ReturnType<typeof getDb>, key: string, value: string) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3202';
  const successUrl = `${siteUrl}/?fb_success=1`;
  const errorUrl   = (reason: string) => `${siteUrl}/?fb_error=${reason}`;

  if (error) {
    return NextResponse.redirect(errorUrl('denied'));
  }

  // Validate CSRF state
  const cookieStore = cookies();
  const savedState = cookieStore.get('fb_oauth_state')?.value;
  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(errorUrl('invalid_state'));
  }

  try {
    // 1. Exchange authorization code → short-lived user token
    const short = await exchangeCodeForToken(code);

    // 2. Upgrade to 60-day long-lived user token
    const long = await getLongLivedToken(short.access_token);
    const expiresAt = new Date(Date.now() + long.expires_in * 1000).toISOString();

    // 3. Get FB user identity
    const fbUser = await getFbUser(long.access_token);

    // 4. Encrypt user token
    const ut = encrypt(long.access_token);

    const db = getDb();

    // 5. Upsert fb_connections row
    const existingConn = db
      .prepare('SELECT id FROM fb_connections WHERE user_id=? AND fb_user_id=?')
      .get(OWNER_USER_ID, fbUser.id) as { id: string } | undefined;

    let connId: string;
    if (existingConn) {
      connId = existingConn.id;
      db.prepare(`
        UPDATE fb_connections
        SET user_token_enc=?, user_token_iv=?, user_token_tag=?,
            expires_at=?, fb_user_name=?, updated_at=datetime('now')
        WHERE id=?
      `).run(ut.enc, ut.iv, ut.tag, expiresAt, fbUser.name, connId);
    } else {
      connId = newId();
      db.prepare(`
        INSERT INTO fb_connections
          (id, user_id, fb_user_id, fb_user_name, user_token_enc, user_token_iv, user_token_tag, expires_at)
        VALUES (?,?,?,?,?,?,?,?)
      `).run(connId, OWNER_USER_ID, fbUser.id, fbUser.name, ut.enc, ut.iv, ut.tag, expiresAt);
    }

    // 6. Fetch all managed Pages + linked IG accounts, upsert fb_pages
    const pages = await getUserPages(long.access_token);
    let firstPageId = '';
    let firstPageToken = '';
    let firstIgId = '';

    for (const p of pages) {
      const pt = encrypt(p.access_token);
      const igId = await getLinkedIgAccount(p.id, p.access_token);

      const existingPage = db
        .prepare('SELECT id FROM fb_pages WHERE connection_id=? AND page_id=?')
        .get(connId, p.id) as { id: string } | undefined;

      if (existingPage) {
        db.prepare(`
          UPDATE fb_pages
          SET page_name=?, page_token_enc=?, page_token_iv=?, page_token_tag=?, ig_account_id=?
          WHERE id=?
        `).run(p.name, pt.enc, pt.iv, pt.tag, igId, existingPage.id);
      } else {
        db.prepare(`
          INSERT INTO fb_pages
            (id, connection_id, page_id, page_name, page_token_enc, page_token_iv, page_token_tag, ig_account_id)
          VALUES (?,?,?,?,?,?,?,?)
        `).run(newId(), connId, p.id, p.name, pt.enc, pt.iv, pt.tag, igId);
      }

      if (!firstPageId) {
        firstPageId = p.id;
        firstPageToken = p.access_token;
        firstIgId = igId;
      }
    }

    // 7. If no page is active yet, auto-activate the first one
    const activeCount = (
      db.prepare('SELECT COUNT(*) as cnt FROM fb_pages WHERE connection_id=? AND is_active=1')
        .get(connId) as { cnt: number }
    ).cnt;

    if (activeCount === 0 && firstPageId) {
      db.prepare('UPDATE fb_pages SET is_active=1 WHERE connection_id=? AND page_id=?')
        .run(connId, firstPageId);
      // Backward compat: keep settings table in sync so existing publish routes work
      upsertSetting(db, 'FB_PAGE_ID', firstPageId);
      upsertSetting(db, 'FB_PAGE_ACCESS_TOKEN', firstPageToken);
      if (firstIgId) upsertSetting(db, 'IG_BUSINESS_ACCOUNT_ID', firstIgId);
    }

    // Clear CSRF cookie on response
    const response = NextResponse.redirect(successUrl);
    response.cookies.set('fb_oauth_state', '', { maxAge: 0, path: '/' });
    return response;

  } catch (e) {
    console.error('[fb-oauth-callback]', e);
    const response = NextResponse.redirect(errorUrl('server_error'));
    response.cookies.set('fb_oauth_state', '', { maxAge: 0, path: '/' });
    return response;
  }
}

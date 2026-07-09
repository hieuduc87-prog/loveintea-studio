export const dynamic = 'force-dynamic';
/**
 * POST /api/webhooks/facebook/deauthorize
 * Facebook calls this when a user removes the app from their FB account.
 * Must verify signed_request signature, then delete stored tokens for that FB user.
 * Register this URL in your FB App → Settings → Advanced → Deauthorize Callback URL.
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/db';
import { safeEqual } from '@/lib/crypto';

function parseSignedRequest(signed: string): { user_id: string } {
  const [sig, payload] = signed.split('.');
  if (!sig || !payload) throw new Error('Malformed signed_request');

  const secret = process.env.FB_APP_SECRET;
  if (!secret) throw new Error('FB_APP_SECRET not set');

  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');

  if (!safeEqual(sig, expected)) throw new Error('Invalid signed_request signature');

  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const signedRequest = form.get('signed_request') as string | null;

    if (!signedRequest) {
      return NextResponse.json({ error: 'signed_request missing' }, { status: 400 });
    }

    const data = parseSignedRequest(signedRequest);
    const fbUserId = data.user_id;

    // Delete all connections for this FB user (cascades to fb_pages)
    const db = getDb();
    db.prepare('DELETE FROM fb_connections WHERE fb_user_id=?').run(fbUserId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    // FB expects a 200 even on errors, to avoid retries for our own validation failures
    console.error('[fb-deauthorize]', e);
    return NextResponse.json({ ok: false, error: (console.error('[api]', e), 'Có lỗi hệ thống') });
  }
}

export const dynamic = 'force-dynamic';
/**
 * GET /api/auth/facebook/start
 * Redirects to Facebook OAuth dialog. Sets CSRF state cookie.
 * User must be logged into the app before hitting this.
 *
 * Two modes:
 *  - Facebook Login for Business (app 1267157968709745 là Business-type):
 *    set FB_LOGIN_CONFIG_ID env → dialog dùng config_id (scope bị bỏ qua).
 *    Tạo configuration trong App Dashboard → Facebook Login for Business →
 *    Configurations, chọn đủ pages_* + instagram_* permissions.
 *  - Classic Login: không set FB_LOGIN_CONFIG_ID → dùng scope list dưới.
 */
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { APP_ID } from '@/lib/facebook';

// Full scopes for page + IG publishing. In Development Mode these work for
// app admins/developers/testers WITHOUT App Review. For external customers
// the app needs App Review + Business Verification (or System User tokens).
// NOTE: manage_pages / pages_read_engagement are deprecated — do not add.
const FB_SCOPES = [
  'email',
  'public_profile',
  'pages_show_list',
  'pages_manage_posts',
  'pages_manage_metadata',
  'pages_messaging',
  'read_insights',
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_insights',
  'instagram_manage_comments',
  'business_management',
].join(',');

export async function GET(req: Request) {
  const redirectUri = process.env.FB_REDIRECT_URI;
  if (!redirectUri) {
    return NextResponse.json({ error: 'FB_REDIRECT_URI env var not set' }, { status: 500 });
  }
  if (!process.env.FB_APP_SECRET) {
    return NextResponse.json({ error: 'FB_APP_SECRET env var not set' }, { status: 500 });
  }
  if (!process.env.TOKEN_ENCRYPTION_KEY) {
    return NextResponse.json({ error: 'TOKEN_ENCRYPTION_KEY env var not set' }, { status: 500 });
  }

  const state = crypto.randomBytes(16).toString('hex');

  const configId = process.env.FB_LOGIN_CONFIG_ID;
  const params = new URLSearchParams({
    client_id: APP_ID,
    redirect_uri: redirectUri,
    state,
    response_type: 'code',
    // Login for Business dùng config_id; classic login dùng scope
    ...(configId ? { config_id: configId } : { scope: FB_SCOPES }),
  });
  const oauthUrl = 'https://www.facebook.com/v21.0/dialog/oauth?' + params;

  const response = NextResponse.redirect(oauthUrl);
  // httpOnly cookie so XSS can't steal it; lax so FB can redirect back
  response.cookies.set('fb_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,   // 10 minutes
    path: '/',
  });
  return response;
}

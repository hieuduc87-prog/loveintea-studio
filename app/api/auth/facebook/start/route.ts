export const dynamic = 'force-dynamic';
/**
 * GET /api/auth/facebook/start
 * Redirects to Facebook OAuth dialog. Sets CSRF state cookie.
 * User must be logged into the app before hitting this.
 */
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { APP_ID } from '@/lib/facebook';

// Scopes needed for full page management + IG + analytics + messaging
const FB_SCOPES = [
  'pages_show_list',          // list all pages the user manages
  'pages_manage_posts',       // create/edit posts on page
  'pages_read_engagement',    // read likes, comments, post insights
  'pages_read_user_content',  // read user-generated content on page
  'pages_messaging',          // read/send Messenger messages
  'instagram_basic',          // read IG profile + media
  'instagram_content_publish',// publish to IG
  'instagram_manage_comments',// read/respond to IG comments
  'instagram_manage_insights',// IG analytics
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

  const oauthUrl = 'https://www.facebook.com/v21.0/dialog/oauth?' + new URLSearchParams({
    client_id: APP_ID,
    redirect_uri: redirectUri,
    scope: FB_SCOPES,
    state,
    response_type: 'code',
  });

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

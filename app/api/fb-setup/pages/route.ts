export const dynamic = 'force-dynamic';
/**
 * Given a User Access Token (from Graph API Explorer or FB Login),
 * returns all FB Pages this user manages + their page access tokens.
 */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { userToken } = await req.json();
    if (!userToken) return NextResponse.json({ error: 'userToken required' }, { status: 400 });

    // 1. Exchange short-lived user token for long-lived user token
    const APP_ID     = process.env.FB_APP_ID     ?? '1267157968709745';
    const APP_SECRET = process.env.FB_APP_SECRET ?? '1a7214dca7cf09db8f51ce9fe93c616a';

    const llRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${userToken}`
    );
    const llData = await llRes.json() as { access_token?: string; error?: { message: string } };
    const longToken = llData.access_token ?? userToken;

    // 2. Get all pages this user manages
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,category,access_token,picture&limit=20&access_token=${longToken}`
    );
    const pages = await pagesRes.json() as {
      data?: Array<{ id: string; name: string; category: string; access_token: string; picture?: { data?: { url?: string } } }>;
      error?: { message: string };
    };

    if (pages.error) return NextResponse.json({ error: pages.error.message }, { status: 400 });

    return NextResponse.json({ pages: pages.data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

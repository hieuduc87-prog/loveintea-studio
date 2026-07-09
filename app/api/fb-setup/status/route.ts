export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getChannelCreds } from '@/lib/facebook';
import { getBrandId } from '@/lib/brand-guard';

export async function GET(req: NextRequest) {
  // Read the trusted brand from the middleware-injected header, not the raw query.
  const brandId = getBrandId(req) || undefined;
  const creds = getChannelCreds(brandId);

  const connected = Boolean(creds.pageId && creds.pageToken);
  let pageInfo: Record<string, unknown> = {};

  if (connected) {
    try {
      const r = await fetch(
        `https://graph.facebook.com/v21.0/${creds.pageId}?fields=id,name,fan_count,picture&access_token=${creds.pageToken}`
      );
      pageInfo = await r.json() as Record<string, unknown>;
    } catch { /* ignore */ }
  }

  return NextResponse.json({
    connected,
    pageId: creds.pageId,
    pageName: creds.pageName || (pageInfo.name as string) || '',
    igId: creds.igId,
    source: creds.source,
    pageInfo,
  });
}

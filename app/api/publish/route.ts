export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { postToFacebook, postToInstagram } from '@/lib/facebook';

export async function POST(req: NextRequest) {
  try {
    const { caption, imageUrls, platforms, scheduledAt, brandId } = await req.json() as {
      caption: string;
      imageUrls: string[];
      platforms: string[];
      scheduledAt?: string;
      brandId?: string;
    };

    const result: Record<string, unknown> = {};
    const schedDate = scheduledAt ? new Date(scheduledAt) : undefined;

    if (platforms?.includes('facebook')) {
      result.fb = await postToFacebook({ caption, imageUrls, scheduledAt: schedDate, brandId });
    }
    if (platforms?.includes('instagram')) {
      if (schedDate) {
        // IG doesn't support scheduling via Graph API — the background
        // scheduler (lib/scheduler.ts) publishes it when scheduled_at is due.
        result.ig = { ok: true, deferred: true };
      } else {
        result.ig = await postToInstagram({ caption, imageUrls, brandId });
      }
    }

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

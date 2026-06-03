export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { postToFacebook, postToInstagram } from '@/lib/facebook';

export async function POST(req: NextRequest) {
  try {
    const { caption, imageUrls, platforms, scheduledAt } = await req.json() as {
      caption: string;
      imageUrls: string[];
      platforms: string[];
      scheduledAt?: string;
    };

    const result: Record<string, unknown> = {};
    const schedDate = scheduledAt ? new Date(scheduledAt) : undefined;

    if (platforms?.includes('facebook')) {
      result.fb = await postToFacebook({ caption, imageUrls, scheduledAt: schedDate });
    }
    if (platforms?.includes('instagram')) {
      // IG doesn't support scheduling via API — post immediately
      result.ig = await postToInstagram({ caption, imageUrls });
    }

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

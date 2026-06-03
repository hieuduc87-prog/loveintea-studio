export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { postToFacebook, postToInstagram } from '@/lib/facebook';

export async function POST(req: NextRequest) {
  try {
    const { caption, imageUrls, platforms } = await req.json();
    const result: Record<string, unknown> = {};

    if (platforms?.includes('facebook')) {
      result.fb = await postToFacebook({ caption, imageUrls });
    }
    if (platforms?.includes('instagram')) {
      result.ig = await postToInstagram({ caption, imageUrls });
    }

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

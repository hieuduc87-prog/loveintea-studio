export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getIgInsights, getIgMedia } from '@/lib/facebook';
import { getBrandId } from '@/lib/brand-guard';

export async function GET(req: NextRequest) {
  try {
    const brand = getBrandId(req) || 'loveintea';
    const [insights, media] = await Promise.allSettled([getIgInsights(brand), getIgMedia(12, brand)]);
    return NextResponse.json({
      insights: insights.status === 'fulfilled' ? insights.value?.data : [],
      media:    media.status    === 'fulfilled' ? media.value    : { data: [] },
    });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

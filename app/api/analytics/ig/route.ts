export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getIgInsights, getIgMedia } from '@/lib/facebook';

export async function GET() {
  try {
    const [insights, media] = await Promise.allSettled([getIgInsights(), getIgMedia(12)]);
    return NextResponse.json({
      insights: insights.status === 'fulfilled' ? insights.value?.data : [],
      media:    media.status    === 'fulfilled' ? media.value    : { data: [] },
    });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getPagePosts } from '@/lib/facebook';
import { getBrandId } from '@/lib/brand-guard';

export async function GET(req: NextRequest) {
  try {
    const brand = getBrandId(req) || 'loveintea';
    const data = await getPagePosts(20, brand);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

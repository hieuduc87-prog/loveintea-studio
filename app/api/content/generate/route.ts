export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { generateO3Content } from '@/lib/o3-engine';
import { getBrandId } from '@/lib/brand-guard';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Brand lấy từ header trung gian đã soát quyền (L3) — không tin body.
    const result = await generateO3Content({ ...body, brandId: getBrandId(req) || body.brandId || '' });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { generateO3Content } from '@/lib/o3-engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await generateO3Content(body);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

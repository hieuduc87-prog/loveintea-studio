export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getStoresWithStats, createStore } from '@/lib/provision';

// GET /api/admin/stores — all tenant stores with stats (super-admin console)
export async function GET() {
  return NextResponse.json({ stores: getStoresWithStats() });
}

// POST /api/admin/stores — create a new tenant store
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { name?: string; slug?: string; logo_url?: string; domain?: string };
    if (!body.name?.trim()) return NextResponse.json({ error: 'Tên store bắt buộc' }, { status: 400 });
    const { id, slug } = createStore({ name: body.name, slug: body.slug, logo_url: body.logo_url, domain: body.domain });
    return NextResponse.json({ ok: true, id, slug });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Không tạo được store' }, { status: 400 });
  }
}

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getStoreMembers, inviteToStore, removeMember } from '@/lib/provision';

// GET /api/admin/stores/[brand]/members
export async function GET(_req: NextRequest, { params }: { params: { brand: string } }) {
  return NextResponse.json({ members: getStoreMembers(params.brand) });
}

// POST /api/admin/stores/[brand]/members — invite/attach a customer to the store
export async function POST(req: NextRequest, { params }: { params: { brand: string } }) {
  try {
    const body = await req.json() as { email?: string; role?: string };
    if (!body.email?.trim()) return NextResponse.json({ error: 'Email bắt buộc' }, { status: 400 });
    const res = inviteToStore({ email: body.email, brandId: params.brand, role: body.role });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Không thêm được thành viên' }, { status: 400 });
  }
}

// DELETE /api/admin/stores/[brand]/members?userId=...
export async function DELETE(req: NextRequest, { params }: { params: { brand: string } }) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId bắt buộc' }, { status: 400 });
  removeMember(userId, params.brand);
  return NextResponse.json({ ok: true });
}

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getStoreMembers, inviteToStore, removeMember, resetMemberPassword } from '@/lib/provision';

// GET /api/admin/stores/[brand]/members
export async function GET(_req: NextRequest, { params }: { params: { brand: string } }) {
  return NextResponse.json({ members: getStoreMembers(params.brand) });
}

// POST /api/admin/stores/[brand]/members
//   { email, role }            → invite/attach a customer (returns tempPassword if new)
//   { action:'reset', userId } → regenerate a temp password for a member
export async function POST(req: NextRequest, { params }: { params: { brand: string } }) {
  try {
    const body = await req.json() as { email?: string; role?: string; action?: string; userId?: string };
    if (body.action === 'reset' && body.userId) {
      const tempPassword = resetMemberPassword(body.userId);
      return NextResponse.json({ ok: true, tempPassword });
    }
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

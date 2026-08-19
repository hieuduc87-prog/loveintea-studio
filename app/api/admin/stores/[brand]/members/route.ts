export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getStoreMembers, inviteToStore, removeMember, resetMemberPassword } from '@/lib/provision';
import { requireAdminSession } from '@/lib/api-auth';
import { buildWelcomeMessage } from '@/lib/welcome-message';
import { getDb } from '@/lib/db';

/** True if userId actually belongs to this store — prevents acting on a member
 *  of another store by passing an arbitrary body.userId. */
function isMemberOfBrand(userId: string, brand: string): boolean {
  return getStoreMembers(brand).some((m) => m.id === userId);
}

// GET /api/admin/stores/[brand]/members
export async function GET(_req: NextRequest, { params }: { params: { brand: string } }) {
  const auth = await requireAdminSession();
  if ('error' in auth) return auth.error;
  return NextResponse.json({ members: getStoreMembers(params.brand) });
}

// POST /api/admin/stores/[brand]/members
//   { email, role }            → invite/attach a customer (returns tempPassword if new)
//   { action:'reset', userId } → regenerate a temp password for a member
export async function POST(req: NextRequest, { params }: { params: { brand: string } }) {
  const auth = await requireAdminSession();
  if ('error' in auth) return auth.error;
  try {
    const body = await req.json() as { email?: string; role?: string; action?: string; userId?: string };
    const db = getDb();
    const store = db.prepare('SELECT id, name, slug FROM brands WHERE id=?').get(params.brand) as { id: string; name: string; slug: string } | undefined;
    if (!store) return NextResponse.json({ error: 'Store không tồn tại' }, { status: 404 });
    const q = db.prepare('SELECT plan, note FROM brand_quotas WHERE brand_id=?').get(params.brand) as { plan: string; note?: string } | undefined;
    const expiresMatch = q?.note?.match(/expires_at=(\d{4}-\d{2}-\d{2})/);
    const expiresAt = expiresMatch ? expiresMatch[1] : undefined;

    if (body.action === 'reset' && body.userId) {
      // Scope the reset to a member of THIS store, not any userId in the system.
      if (!isMemberOfBrand(body.userId, params.brand)) {
        return NextResponse.json({ error: 'User không thuộc store này' }, { status: 403 });
      }
      const tempPassword = resetMemberPassword(body.userId);
      const member = getStoreMembers(params.brand).find(m => m.id === body.userId);
      const welcomeMessage = member ? buildWelcomeMessage({
        storeName: store.name, slug: store.slug, ownerEmail: member.email,
        tempPassword, planNote: q?.plan, expiresAt, scenario: 'reset-password',
      }) : undefined;
      return NextResponse.json({ ok: true, tempPassword, welcomeMessage, storeUrl: `https://${store.slug}.easycreativehub.com`, ownerEmail: member?.email });
    }
    if (!body.email?.trim()) return NextResponse.json({ error: 'Email bắt buộc' }, { status: 400 });
    const res = inviteToStore({ email: body.email, brandId: params.brand, role: body.role });
    const welcomeMessage = buildWelcomeMessage({
      storeName: store.name, slug: store.slug, ownerEmail: body.email.trim().toLowerCase(),
      tempPassword: res.tempPassword ?? null, planNote: q?.plan, expiresAt, scenario: 'invite-member',
    });
    return NextResponse.json({ ok: true, ...res, welcomeMessage, storeUrl: `https://${store.slug}.easycreativehub.com` });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]',e),'Không thêm được thành viên') }, { status: 400 });
  }
}

// DELETE /api/admin/stores/[brand]/members?userId=...
export async function DELETE(req: NextRequest, { params }: { params: { brand: string } }) {
  const auth = await requireAdminSession();
  if ('error' in auth) return auth.error;
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId bắt buộc' }, { status: 400 });
  removeMember(userId, params.brand);
  return NextResponse.json({ ok: true });
}

/**
 * Whitelist truy cập Platform Console + xem Cost/P&L.
 *
 * PLATFORM_CONSOLE_EMAILS = ai được xem/tạo store, invite user, xem dashboard tổng
 *   (không thấy cost/revenue/profit — dashboard sẽ ẩn 3 widget đó)
 * COST_VIEWER_EMAILS = ai được xem Cost/Revenue/Profit + PUT đơn giá vốn
 *
 * Bảo mật: hardcode ở đây, không dùng env (env dễ leak qua .env commit / build layer).
 * Sửa email = sửa file này + deploy — cố ý để không ai đổi âm thầm.
 */

const PLATFORM_CONSOLE_EMAILS = new Set([
  'hieuduc87@gmail.com',
  'manhson.nguyen@gmail.com',
]);

// Cost/Revenue/Profit — chỉ founder chính, tách riêng vì đây là DỮ LIỆU TÀI CHÍNH
// (nội bộ tuyệt đối; kể cả admin cấp 2 KHÔNG được xem để tránh so bì hoặc rò khách).
const COST_VIEWER_EMAILS = new Set([
  'hieuduc87@gmail.com',
]);

export function isPlatformAdmin(email: string | null | undefined): boolean {
  return !!email && PLATFORM_CONSOLE_EMAILS.has(email.toLowerCase().trim());
}

export function isCostViewer(email: string | null | undefined): boolean {
  return !!email && COST_VIEWER_EMAILS.has(email.toLowerCase().trim());
}

/** Server-side guard cho routes /api/admin/* — kết hợp trong requireAdminSession sau. */
export async function requirePlatformAdminSession(): Promise<
  { session: Awaited<ReturnType<typeof import('next-auth').getServerSession>>; role: string; userId: string; email: string }
  | { error: import('next/server').NextResponse }
> {
  const { getServerSession } = await import('next-auth');
  const { NextResponse } = await import('next/server');
  const { authOptions } = await import('./auth-options');
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!session?.user || !email) return { error: NextResponse.json({ error: 'Unauthorized — cần đăng nhập.' }, { status: 401 }) };
  if (!isPlatformAdmin(email)) return { error: NextResponse.json({ error: 'Forbidden — chỉ founder (hieuduc87/manhson) truy cập được Platform Console.' }, { status: 403 }) };
  const role = ((session.user as { role?: string })?.role as string) ?? 'viewer';
  const userId = ((session.user as { id?: string })?.id) ?? '';
  return { session, role, userId, email };
}

export async function requireCostViewerSession(): Promise<
  { email: string }
  | { error: import('next/server').NextResponse }
> {
  const { getServerSession } = await import('next-auth');
  const { NextResponse } = await import('next/server');
  const { authOptions } = await import('./auth-options');
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!session?.user || !email) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isCostViewer(email)) return { error: NextResponse.json({ error: 'Forbidden — dữ liệu Cost/Revenue là nội bộ, chỉ founder chính xem được.' }, { status: 403 }) };
  return { email };
}

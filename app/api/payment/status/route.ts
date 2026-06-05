export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as Record<string, unknown>).id as string;

  const orderId = req.nextUrl.searchParams.get('orderId');
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

  const db  = getDb();
  const row = db.prepare(`
    SELECT bt.status, bt.amount, bt.paid_at, bt.expires_at, pp.name as plan_name, pp.type as plan_type
    FROM bank_transfers bt JOIN payment_plans pp ON pp.id = bt.plan_id
    WHERE bt.order_id = ? AND bt.user_id = ?
  `).get(orderId, userId) as Record<string, unknown> | undefined;

  if (!row) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  return NextResponse.json({
    status:    row.status,
    amount:    row.amount,
    paidAt:    row.paid_at,
    expiresAt: row.expires_at,
    planName:  row.plan_name,
    planType:  row.plan_type,
    expired:   row.status === 'pending' && new Date(row.expires_at as string) < new Date(),
  });
}

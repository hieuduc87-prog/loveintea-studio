export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getDb } from '@/lib/db';
import { getSubscriptionStatus } from '@/lib/payment';

export async function GET() {
  const db    = getDb();
  const plans = db.prepare('SELECT * FROM payment_plans WHERE is_active = 1 ORDER BY price').all();

  const session = await getServerSession(authOptions);
  const userId  = (session?.user as Record<string, unknown>)?.id as string | undefined;

  const subStatus = userId ? getSubscriptionStatus(userId) : null;

  const history = userId ? db.prepare(`
    SELECT bt.*, pp.name as plan_name, pp.type as plan_type
    FROM bank_transfers bt JOIN payment_plans pp ON pp.id = bt.plan_id
    WHERE bt.user_id = ?
    ORDER BY bt.created_at DESC LIMIT 10
  `).all(userId) : [];

  return NextResponse.json({ plans, subStatus, history });
}

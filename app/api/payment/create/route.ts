export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { createOrder } from '@/lib/payment';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const userId = (session.user as Record<string, unknown>).id as string;
  if (!userId) return NextResponse.json({ error: 'User ID missing' }, { status: 401 });

  const { planId } = await req.json() as { planId: string };
  if (!planId) return NextResponse.json({ error: 'planId required' }, { status: 400 });

  const order = createOrder(userId, planId);
  if (!order) return NextResponse.json({ error: 'Plan not found or inactive' }, { status: 404 });

  return NextResponse.json(order);
}

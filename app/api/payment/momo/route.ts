export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getDb } from '@/lib/db';
import { createMoMoPayment } from '@/lib/momo';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { planId } = await req.json() as { planId?: string };
    if (!planId) return NextResponse.json({ error: 'planId required' }, { status: 400 });

    const db = getDb();
    const plan = db.prepare('SELECT * FROM payment_plans WHERE id = ? AND is_active = 1').get(planId) as Record<string, unknown> | undefined;
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    const user = db.prepare('SELECT id FROM auth_users WHERE email = ?').get(session.user.email) as { id: string } | undefined;
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3202').trim();
    const orderId = `LIT${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const momoRes = await createMoMoPayment({
      orderId,
      amount: plan.price as number,
      orderInfo: `LoveinTea Studio — ${plan.name} (${orderId})`,
      redirectUrl: `${appUrl}/payment/momo-result?orderId=${orderId}`,
      ipnUrl:      `${appUrl}/api/payment/momo-callback`,
      extraData:   Buffer.from(JSON.stringify({ planId, userId: user.id })).toString('base64'),
    });

    if (momoRes.resultCode !== 0) {
      return NextResponse.json({ error: momoRes.message || 'MoMo error', resultCode: momoRes.resultCode }, { status: 400 });
    }

    // Persist pending momo payment
    db.prepare(`
      INSERT INTO momo_payments (id, user_id, order_id, plan_id, amount, status, pay_url, qr_code_url, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, datetime('now'))
    `).run(crypto.randomUUID(), user.id, orderId, planId, plan.price, momoRes.payUrl, momoRes.qrCodeUrl);

    return NextResponse.json({
      orderId,
      payUrl:     momoRes.payUrl,
      qrCodeUrl:  momoRes.qrCodeUrl,
      amount:     plan.price,
      planName:   plan.name,
    });
  } catch (err: unknown) {
    console.error('[MoMo] Error:', err);
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}

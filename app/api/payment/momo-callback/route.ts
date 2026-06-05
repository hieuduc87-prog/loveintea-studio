export const dynamic = 'force-dynamic';
/**
 * POST /api/payment/momo-callback — MoMo IPN webhook
 * MoMo calls this with payment result. Must respond 204.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyMoMoSignature } from '@/lib/momo';
import { fulfillOrder } from '@/lib/payment';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, resultCode, transId } = body as {
      orderId: string; resultCode: number; transId: string;
    };

    console.log(`[MoMo IPN] orderId=${orderId} resultCode=${resultCode}`);

    // Verify HMAC-SHA256 signature
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(body)) params[k] = String(v);

    if (!verifyMoMoSignature(params)) {
      console.error('[MoMo IPN] Invalid signature for', orderId);
      return new NextResponse(null, { status: 204 });
    }

    const db = getDb();

    if (resultCode === 0) {
      // Payment success — update momo_payments then fulfill subscription
      const mp = db.prepare(
        "UPDATE momo_payments SET status='paid', momo_trans_id=?, paid_at=datetime('now') WHERE order_id=? AND status='pending' RETURNING *"
      ).get(transId, orderId) as Record<string, unknown> | undefined;

      if (!mp) {
        console.log(`[MoMo IPN] Already processed or not found: ${orderId}`);
        return new NextResponse(null, { status: 204 });
      }

      // Fulfill the subscription (same logic as bank transfer)
      const ok = fulfillOrder(orderId, { cassoTid: `momo:${transId}` });
      console.log(`[MoMo IPN] Fulfilled=${ok} orderId=${orderId}`);
    } else {
      // Payment failed
      db.prepare("UPDATE momo_payments SET status='failed' WHERE order_id=? AND status='pending'").run(orderId);
      console.log(`[MoMo IPN] Payment failed for ${orderId}, resultCode=${resultCode}`);
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('[MoMo IPN] Error:', err);
    return new NextResponse(null, { status: 204 }); // always 204 to stop retries
  }
}

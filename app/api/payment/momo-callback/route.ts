export const dynamic = 'force-dynamic';
/**
 * POST /api/payment/momo-callback — MoMo IPN webhook
 * MoMo calls this with payment result. Must respond 204.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyMoMoSignature } from '@/lib/momo';
import { fulfillOrder } from '@/lib/payment';
import { getDb } from '@/lib/db';
import { enforceRateLimit } from '@/lib/rate-limit';
import { log } from '@/lib/logger';

export async function POST(req: NextRequest) {
  // Route này middleware KHÔNG gác (phải công khai cho MoMo gọi) → tự phanh,
  // nếu không nó là cổng dò chữ ký miễn phí cho bất kỳ ai.
  const limited = enforceRateLimit(req, { scope: 'momo:ipn', limit: 120, windowMs: 60_000 });
  if (limited) return limited;

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
      // Chữ ký sai = hoặc cấu hình lệch (khách trả tiền mà không được cấp), hoặc
      // có người đang dò. Cả hai đều phải có người xem, không được chỉ nằm log.
      log.error('payment.momo', 'IPN sai chữ ký — đơn KHÔNG được fulfil', { orderId });
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
      if (ok) {
        log.info('payment.momo', 'fulfil thành công', { orderId, transId });
      } else {
        // ĐÃ CẦM TIỀN NHƯNG KHÔNG CẤP DỊCH VỤ. Và vì momo_payments vừa bị đánh
        // 'paid' ở trên, MoMo gọi lại sẽ rơi vào nhánh "already processed" —
        // tức là tự nó KHÔNG BAO GIỜ sửa được. Bắt buộc có người vào cấp tay.
        log.error('payment.momo', 'ĐÃ THU TIỀN NHƯNG FULFIL HỎNG — phải cấp gói bằng tay', { orderId, transId });
      }
    } else {
      // Payment failed
      db.prepare("UPDATE momo_payments SET status='failed' WHERE order_id=? AND status='pending'").run(orderId);
      console.log(`[MoMo IPN] Payment failed for ${orderId}, resultCode=${resultCode}`);
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    log.error('payment.momo', 'IPN nổ giữa chừng — đơn có thể mất fulfil', { err });
    return new NextResponse(null, { status: 204 }); // always 204 to stop retries
  }
}

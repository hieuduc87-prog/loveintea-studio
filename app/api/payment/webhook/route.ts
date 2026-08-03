export const dynamic = 'force-dynamic';
/**
 * POST /api/payment/webhook — Casso bank transfer webhook
 * GET  /api/payment/webhook — health check (Casso URL verification)
 */
import { NextRequest, NextResponse } from 'next/server';
import { extractOrderId, fulfillOrder } from '@/lib/payment';
import { getDb } from '@/lib/db';
import { safeEqual } from '@/lib/crypto';
import { enforceRateLimit } from '@/lib/rate-limit';
import { log } from '@/lib/logger';

const CASSO_TOKEN = process.env.CASSO_SECURE_TOKEN || '';

function verifyToken(req: NextRequest): boolean {
  if (!CASSO_TOKEN) return false;
  // Check all header names Casso might use
  let token =
    req.headers.get('secure-token') ||
    req.headers.get('Secure-Token') ||
    req.headers.get('x-casso-signature') ||
    req.headers.get('authorization') ||
    req.headers.get('token') ||
    req.headers.get('security-token') ||
    req.headers.get('webhook-secret');
  if (!token) return false;
  if (token.startsWith('Bearer ')) token = token.slice(7);
  return safeEqual(token.trim(), CASSO_TOKEN);
}

interface NormalizedTx {
  id: string; tid: string; description: string;
  amount: number; senderName: string; senderAccount: string;
}

function parseTxs(body: Record<string, unknown>): NormalizedTx[] {
  const raw = body.data;
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : [raw];
  return items.map((tx: Record<string, unknown>) => ({
    id:            String(tx.id || ''),
    tid:           String(tx.reference || tx.tid || tx.id || ''),
    description:   String(tx.description || tx.content || ''),
    amount:        Number(tx.amount || 0),
    senderName:    String(tx.counterAccountName || tx.counterpartName || tx.corresponsiveName || ''),
    senderAccount: String(tx.counterAccountNumber || tx.counterpartAccountNumber || tx.corresponsiveAccount || ''),
  }));
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'loveintea-studio', timestamp: new Date().toISOString() });
}

export async function POST(req: NextRequest) {
  // Middleware KHÔNG gác route này (ngân hàng phải gọi được) → tự phanh, nếu
  // không thì CASSO_SECURE_TOKEN có thể bị dò với tốc độ không giới hạn.
  const limited = enforceRateLimit(req, { scope: 'casso:webhook', limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  if (!verifyToken(req)) {
    log.warn('payment.casso', 'webhook bị từ chối token', { ip: req.headers.get('cf-connecting-ip') || 'unknown' });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const transactions = parseTxs(body);
    log.info('payment.casso', `nhận ${transactions.length} giao dịch`);

    const db = getDb();
    let processed = 0;

    for (const tx of transactions) {
      if (tx.amount <= 0) continue;

      const orderId = extractOrderId(tx.description);
      if (!orderId) {
        console.log(`[CASSO] No order ID in: "${tx.description}"`);
        continue;
      }

      // Amount check: fetch pending order and verify amount matches
      const order = db.prepare(
        "SELECT amount FROM bank_transfers WHERE order_id = ? AND status = 'pending'"
      ).get(orderId) as { amount: number } | undefined;

      if (!order) {
        console.log(`[CASSO] No pending order for: ${orderId}`);
        continue;
      }

      if (tx.amount < order.amount) {
        // Khách CHUYỂN THIẾU: tiền đã vào tài khoản nhưng đơn treo mãi ở
        // 'pending' — khách tưởng đã mua, mình tưởng chưa ai trả. Phải có người biết.
        log.error('payment.casso', 'chuyển khoản THIẾU tiền — đơn treo, cần xử lý tay', {
          orderId, expected: order.amount, got: tx.amount,
        });
        continue;
      }

      const ok = fulfillOrder(orderId, {
        cassoTid:      tx.tid,
        senderName:    tx.senderName,
        senderAccount: tx.senderAccount,
      });

      if (ok) {
        processed++;
        log.info('payment.casso', 'fulfil thành công', { orderId, amount: tx.amount });
      } else {
        // Tiền vào đủ mà fulfil trả false = đơn đã đổi trạng thái giữa chừng
        // hoặc plan bị xoá. Tiền đã cầm, dịch vụ chưa cấp → không được im lặng.
        log.error('payment.casso', 'ĐÃ NHẬN TIỀN NHƯNG FULFIL HỎNG — phải cấp gói bằng tay', { orderId, amount: tx.amount });
      }
    }

    return NextResponse.json({ ok: true, processed });
  } catch (err) {
    log.error('payment.casso', 'webhook nổ giữa chừng — giao dịch có thể mất fulfil', { err });
    return NextResponse.json({ ok: true, processed: 0 }); // Always 200 to prevent Casso retries
  }
}

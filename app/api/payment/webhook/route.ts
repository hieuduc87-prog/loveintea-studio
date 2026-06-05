export const dynamic = 'force-dynamic';
/**
 * POST /api/payment/webhook — Casso bank transfer webhook
 * GET  /api/payment/webhook — health check (Casso URL verification)
 *
 * Casso sends data when a new bank transaction arrives.
 * We extract the order ID from the transfer description and fulfill the order.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyCassoToken, extractOrderId, fulfillOrder } from '@/lib/payment';

// Health check — Casso calls this to verify the URL is reachable
export async function GET() {
  return NextResponse.json({ ok: true, service: 'loveintea-studio' });
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('secure-token') || req.headers.get('authorization');
  if (!verifyCassoToken(token)) {
    console.error('[CASSO] Invalid token');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Casso v2: { data: [...] } | Legacy: [...] | Single: { ... }
    const transactions: Array<Record<string, unknown>> = Array.isArray(body.data) ? body.data
      : Array.isArray(body) ? body
      : body.data ? [body.data]
      : [body];

    let processed = 0;
    for (const tx of transactions) {
      const desc   = String(tx.description || tx.content || '');
      const amount = Number(tx.amount || 0);
      if (amount <= 0) continue; // skip debits

      const orderId = extractOrderId(desc);
      if (!orderId) {
        console.log(`[CASSO] No order ID in: "${desc}"`);
        continue;
      }

      console.log(`[CASSO] Payment detected: ${orderId} amount=${amount}`);

      const ok = fulfillOrder(orderId, {
        cassoTid:      String(tx.id || ''),
        senderName:    String(tx.counterpartName || tx.from_name || ''),
        senderAccount: String(tx.counterpartAccountNumber || tx.from_account || ''),
      });

      if (ok) {
        processed++;
        console.log(`[CASSO] Fulfilled: ${orderId}`);
      } else {
        console.log(`[CASSO] Order not found or already paid: ${orderId}`);
      }
    }

    return NextResponse.json({ ok: true, processed });
  } catch (err: unknown) {
    console.error('[CASSO] Error:', err);
    // Always return 200 to prevent Casso from retrying indefinitely
    return NextResponse.json({ ok: true, processed: 0 });
  }
}

export const dynamic = 'force-dynamic';
/**
 * POST /api/payment/webhook — Casso bank transfer webhook
 * GET  /api/payment/webhook — health check (Casso URL verification)
 */
import { NextRequest, NextResponse } from 'next/server';
import { extractOrderId, fulfillOrder } from '@/lib/payment';
import { getDb } from '@/lib/db';

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
  return token.trim() === CASSO_TOKEN;
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
  if (!verifyToken(req)) {
    console.error('[CASSO] Token rejected');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const transactions = parseTxs(body);
    console.log(`[CASSO] ${transactions.length} transaction(s)`, JSON.stringify(body).slice(0, 300));

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
        console.warn(`[CASSO] Amount mismatch ${orderId}: expected ${order.amount}, got ${tx.amount}`);
        continue;
      }

      const ok = fulfillOrder(orderId, {
        cassoTid:      tx.tid,
        senderName:    tx.senderName,
        senderAccount: tx.senderAccount,
      });

      if (ok) {
        processed++;
        console.log(`[CASSO] Fulfilled: ${orderId} amount=${tx.amount}`);
      }
    }

    return NextResponse.json({ ok: true, processed });
  } catch (err) {
    console.error('[CASSO] Error:', err);
    return NextResponse.json({ ok: true, processed: 0 }); // Always 200 to prevent Casso retries
  }
}

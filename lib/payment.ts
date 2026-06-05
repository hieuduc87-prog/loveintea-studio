/**
 * lib/payment.ts — VietQR bank transfer + Casso webhook payment system
 * Adapted from laixe-xuyenviet pattern.
 */
import crypto from 'crypto';
import { getDb } from '@/lib/db';

const BANK_BIN         = process.env.BANK_BIN          || '970422'; // MB Bank default
const BANK_ACCOUNT_NO  = process.env.BANK_ACCOUNT_NO   || '';
const BANK_ACCOUNT_NAME = process.env.BANK_ACCOUNT_NAME || '';
const CASSO_TOKEN      = process.env.CASSO_SECURE_TOKEN || '';

// ── Generate order ID ─────────────────────────────────────────────────────────
// Format: LIT + timestamp_base36 + 4 random chars — 14 chars total, unique in transfer memo
export function generateOrderId(): string {
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
  return `LIT${ts}${rand}`.slice(0, 16);
}

// ── VietQR URL ────────────────────────────────────────────────────────────────
export function generateVietQR(amount: number, transferContent: string): string {
  if (!BANK_ACCOUNT_NO) return '';
  const params = new URLSearchParams({
    amount:      String(amount),
    addInfo:     transferContent,
    accountName: BANK_ACCOUNT_NAME,
  });
  return `https://img.vietqr.io/image/${BANK_BIN}-${BANK_ACCOUNT_NO}-compact2.png?${params}`;
}

// ── Extract order ID from bank transfer description ───────────────────────────
export function extractOrderId(description: string): string | null {
  const match = description.match(/LIT[A-Z0-9]{8,16}/i);
  return match ? match[0].toUpperCase() : null;
}

// ── Verify Casso webhook token ────────────────────────────────────────────────
export function verifyCassoToken(header: string | null): boolean {
  if (!CASSO_TOKEN || !header) return false;
  return header.replace('Bearer ', '').trim() === CASSO_TOKEN;
}

// ── Bank display info (masked) ────────────────────────────────────────────────
export function getBankInfo() {
  return {
    bankName:    'MB Bank',
    bankBin:     BANK_BIN,
    accountNo:   BANK_ACCOUNT_NO ? `****${BANK_ACCOUNT_NO.slice(-4)}` : '(chưa cấu hình)',
    accountNoFull: BANK_ACCOUNT_NO,
    accountName: BANK_ACCOUNT_NAME,
  };
}

// ── Create order ──────────────────────────────────────────────────────────────
export function createOrder(userId: string, planId: string) {
  const db = getDb();
  const plan = db.prepare('SELECT * FROM payment_plans WHERE id = ? AND is_active = 1').get(planId) as Record<string, unknown> | undefined;
  if (!plan) return null;

  const orderId   = generateOrderId();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min

  db.prepare(`
    INSERT INTO bank_transfers (id, order_id, user_id, plan_id, amount, status, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, datetime('now'))
  `).run(orderId, orderId, userId, planId, plan.price, expiresAt);

  return {
    orderId,
    amount:          plan.price as number,
    planName:        plan.name as string,
    planType:        plan.type as string,
    qrUrl:           generateVietQR(plan.price as number, orderId),
    transferContent: orderId,
    expiresAt,
    bankInfo:        getBankInfo(),
  };
}

// ── Fulfill order after payment ───────────────────────────────────────────────
export function fulfillOrder(
  orderId: string,
  txData?: { cassoTid?: string; senderName?: string; senderAccount?: string }
): boolean {
  const db = getDb();
  const order = db.prepare(
    "SELECT * FROM bank_transfers WHERE order_id = ? AND status = 'pending'"
  ).get(orderId) as Record<string, unknown> | undefined;
  if (!order) return false;

  const plan = db.prepare('SELECT * FROM payment_plans WHERE id = ?').get(order.plan_id) as Record<string, unknown> | undefined;
  if (!plan) return false;

  const tx = db.transaction(() => {
    // Mark order paid
    db.prepare(`
      UPDATE bank_transfers
      SET status = 'paid', paid_at = datetime('now'),
          casso_tid = ?, sender_name = ?, sender_account = ?
      WHERE order_id = ?
    `).run(
      txData?.cassoTid || null,
      txData?.senderName || null,
      txData?.senderAccount || null,
      orderId
    );

    const userId  = order.user_id as string;
    const planType = plan.type as string;

    if (planType === 'subscription_monthly') {
      // Extend or create subscription (30-day rolling)
      const existing = db.prepare(
        "SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active'"
      ).get(userId) as Record<string, unknown> | undefined;

      if (existing) {
        // Extend current period by 30 days from current end
        const currentEnd = new Date(existing.current_period_end as string);
        const newEnd     = new Date(Math.max(currentEnd.getTime(), Date.now()) + 30 * 24 * 60 * 60 * 1000);
        db.prepare(`
          UPDATE subscriptions
          SET current_period_end = ?, payment_reference = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(newEnd.toISOString(), orderId, existing.id);
      } else {
        const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        db.prepare(`
          INSERT INTO subscriptions
            (id, user_id, plan_id, status, started_at, current_period_end, payment_method, payment_reference, created_at, updated_at)
          VALUES (?, ?, ?, 'active', datetime('now'), ?, 'bank_transfer', ?, datetime('now'), datetime('now'))
        `).run(crypto.randomUUID(), userId, order.plan_id, periodEnd.toISOString(), orderId);
      }
    } else {
      // setup_once — just create a one-time subscription record marking as lifetime/setup
      db.prepare(`
        INSERT OR IGNORE INTO subscriptions
          (id, user_id, plan_id, status, started_at, current_period_end, payment_method, payment_reference, created_at, updated_at)
        VALUES (?, ?, ?, 'active', datetime('now'), '2099-12-31T00:00:00.000Z', 'bank_transfer', ?, datetime('now'), datetime('now'))
      `).run(crypto.randomUUID(), userId, order.plan_id, orderId);
    }
  });

  tx();
  return true;
}

// ── Subscription status for a user ───────────────────────────────────────────
export function getSubscriptionStatus(userId: string) {
  const db = getDb();

  const sub = db.prepare(`
    SELECT s.*, p.name as plan_name, p.type as plan_type, p.features
    FROM subscriptions s JOIN payment_plans p ON p.id = s.plan_id
    WHERE s.user_id = ?
    ORDER BY s.created_at DESC LIMIT 1
  `).get(userId) as Record<string, unknown> | undefined;

  const hasSetup = !!(db.prepare(`
    SELECT 1 FROM subscriptions s
    JOIN payment_plans p ON p.id = s.plan_id
    WHERE s.user_id = ? AND p.type = 'setup_once'
  `).get(userId));

  const hasActiveSub = !!(db.prepare(`
    SELECT 1 FROM subscriptions s
    JOIN payment_plans p ON p.id = s.plan_id
    WHERE s.user_id = ? AND p.type = 'subscription_monthly'
      AND s.status = 'active' AND s.current_period_end > datetime('now')
  `).get(userId));

  return {
    subscription: sub || null,
    hasSetup,
    hasActiveSub,
    isActive: hasActiveSub,
  };
}

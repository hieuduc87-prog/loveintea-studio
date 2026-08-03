/**
 * THANH TOÁN — nơi sai một dòng là mất tiền thật hoặc mất khách thật.
 *
 * Hai lớp hỏng được nhắm vào đây:
 *   1. ĐỌC NHẦM MÃ ĐƠN từ nội dung chuyển khoản (ngân hàng nhét đủ thứ rác vào
 *      memo) → fulfil nhầm đơn của người khác, hoặc không fulfil được đơn nào.
 *   2. FULFIL HAI LẦN. Casso và MoMo đều RETRY khi không nhận đủ 2xx. Nếu
 *      fulfilOrder không idempotent, một cú retry = khách được cộng gói hai lần.
 *
 * Test chạy trên DB tạm — không chạm data thật.
 */
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lit-pay-'));
process.env.DATA_DIR = TMP;
process.env.TENANT_DB_SPLIT = '0'; // bảng thanh toán là PLATFORM (global DB)

const { extractOrderId, generateOrderId, fulfillOrder } = await import('../lib/payment.js');
const { getDb } = await import('../lib/db.js');

after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* */ } });

const db = getDb();
let seq = 0;

function seedOrder(opts: { type: 'subscription_monthly' | 'setup_once'; amount?: number }) {
  const n = ++seq;
  const planId = `ptest-plan-${n}`;
  const orderId = `LITTEST${String(n).padStart(5, '0')}`;
  const userId = `ptest-user-${n}`;
  const brandId = `ptest-brand-${n}`;
  const amount = opts.amount ?? 199_000;

  db.prepare('INSERT INTO payment_plans (id, name, type, price, is_active) VALUES (?,?,?,?,1)')
    .run(planId, `Gói test ${n}`, opts.type, amount);
  db.prepare(`INSERT INTO bank_transfers (id, order_id, user_id, plan_id, amount, status, brand_id, created_at)
    VALUES (?,?,?,?,?, 'pending', ?, datetime('now'))`)
    .run(orderId, orderId, userId, planId, amount, brandId);

  return { orderId, userId, brandId, planId, amount };
}

const subsOf = (brandId: string) =>
  db.prepare('SELECT * FROM subscriptions WHERE brand_id = ?').all(brandId) as Array<Record<string, unknown>>;

describe('extractOrderId — đọc mã đơn từ memo ngân hàng', () => {
  test('lấy được mã trong memo có rác xung quanh', () => {
    const id = generateOrderId();
    assert.equal(extractOrderId(`CT DEN:0123 ${id} TU NGUYEN VAN A`), id);
  });

  test('memo viết thường vẫn nhận, trả về CHỮ HOA', () => {
    // Nhiều ngân hàng hạ chữ thường toàn bộ nội dung.
    assert.equal(extractOrderId('thanh toan litmfkx1234ab'), 'LITMFKX1234AB');
  });

  test('không có mã → null (không đoán bừa)', () => {
    assert.equal(extractOrderId('CHUYEN TIEN AN TRUA'), null);
    assert.equal(extractOrderId(''), null);
  });

  test('chuỗi quá ngắn sau LIT không được tính là mã', () => {
    assert.equal(extractOrderId('LIT123'), null, 'mã ngắn lọt lưới sẽ khớp nhầm đơn khác');
  });

  test('mã do chính hệ sinh ra luôn đọc lại được', () => {
    // Vòng tròn sinh → đọc phải khép kín, nếu không thì mọi đơn đều treo.
    for (let i = 0; i < 50; i++) {
      const id = generateOrderId();
      assert.equal(extractOrderId(`NOI DUNG ${id}`), id, `không đọc lại được mã vừa sinh: ${id}`);
    }
  });

  test('BIẾT TRƯỚC: chữ LIT nằm giữa từ khác vẫn bị nhận nhầm', () => {
    // Regex hiện tại không có ranh giới từ, nên "SPLIT12345678" chứa "LIT12345678".
    // Ghi lại làm CHỐT: nếu ai sửa regex cho chặt hơn, ca này đỏ và người sửa
    // biết mình vừa đổi hành vi — chứ không phải phát hiện qua một đơn fulfil nhầm.
    // Rủi ro thật thấp (memo phải chứa đúng mã đơn đang pending) nhưng có thật.
    assert.equal(extractOrderId('THANH TOAN SPLIT12345678'), 'LIT12345678');
  });
});

describe('fulfillOrder — idempotent trước retry của ngân hàng', () => {
  test('đơn hợp lệ: fulfil thành công và tạo đúng 1 subscription', () => {
    const o = seedOrder({ type: 'subscription_monthly' });
    assert.equal(fulfillOrder(o.orderId, { cassoTid: 'tid-1' }), true);

    const row = db.prepare('SELECT status, paid_at, casso_tid FROM bank_transfers WHERE order_id=?')
      .get(o.orderId) as { status: string; paid_at: string; casso_tid: string };
    assert.equal(row.status, 'paid');
    assert.ok(row.paid_at, 'phải ghi thời điểm trả tiền');
    assert.equal(row.casso_tid, 'tid-1', 'phải lưu mã giao dịch để đối soát');
    assert.equal(subsOf(o.brandId).length, 1);
  });

  test('GỌI LẠI LẦN 2 KHÔNG cộng gói thêm lần nữa', () => {
    const o = seedOrder({ type: 'subscription_monthly' });
    assert.equal(fulfillOrder(o.orderId, { cassoTid: 'tid-a' }), true);
    const endAfterFirst = (subsOf(o.brandId)[0] as { current_period_end: string }).current_period_end;

    // Casso retry cùng một giao dịch.
    assert.equal(fulfillOrder(o.orderId, { cassoTid: 'tid-a' }), false, 'lần 2 phải trả false');

    const subs = subsOf(o.brandId);
    assert.equal(subs.length, 1, 'retry tạo thêm subscription');
    assert.equal((subs[0] as { current_period_end: string }).current_period_end, endAfterFirst,
      'retry gia hạn thêm 30 ngày MIỄN PHÍ cho khách');
  });

  test('gọi lại 5 lần liên tiếp vẫn chỉ tính 1', () => {
    const o = seedOrder({ type: 'subscription_monthly' });
    const results = Array.from({ length: 5 }, () => fulfillOrder(o.orderId));
    assert.deepEqual(results, [true, false, false, false, false]);
    assert.equal(subsOf(o.brandId).length, 1);
  });

  test('mã đơn không tồn tại → false, không tạo gì', () => {
    assert.equal(fulfillOrder('LITKHONGCOTHAT'), false);
  });

  test('gói setup_once: fulfil ra subscription vĩnh viễn, lặp lại không nhân bản', () => {
    const o = seedOrder({ type: 'setup_once', amount: 5_000_000 });
    assert.equal(fulfillOrder(o.orderId), true);
    const subs = subsOf(o.brandId);
    assert.equal(subs.length, 1);
    assert.equal(fulfillOrder(o.orderId), false);
    assert.equal(subsOf(o.brandId).length, 1);
  });

  test('gia hạn CỘNG DỒN từ ngày hết hạn cũ, không cắt ngắn của khách', () => {
    // Khách gia hạn sớm: 30 ngày mới phải cộng vào phần còn lại, không đè lên.
    const first = seedOrder({ type: 'subscription_monthly' });
    assert.equal(fulfillOrder(first.orderId), true);
    const end1 = new Date((subsOf(first.brandId)[0] as { current_period_end: string }).current_period_end);

    // Đơn thứ hai CÙNG brand.
    const n = ++seq;
    const orderId2 = `LITTEST${String(n).padStart(5, '0')}`;
    db.prepare(`INSERT INTO bank_transfers (id, order_id, user_id, plan_id, amount, status, brand_id, created_at)
      VALUES (?,?,?,?,?, 'pending', ?, datetime('now'))`)
      .run(orderId2, orderId2, first.userId, first.planId, first.amount, first.brandId);

    assert.equal(fulfillOrder(orderId2), true);
    const subs = subsOf(first.brandId);
    assert.equal(subs.length, 1, 'gia hạn phải sửa sub cũ, không tạo sub thứ hai');
    const end2 = new Date((subs[0] as { current_period_end: string }).current_period_end);
    const addedDays = (end2.getTime() - end1.getTime()) / 86_400_000;
    assert.ok(Math.abs(addedDays - 30) < 1, `gia hạn cộng ${addedDays.toFixed(1)} ngày thay vì 30`);
  });

  test('subscription của brand này không dính sang brand khác', () => {
    const a = seedOrder({ type: 'subscription_monthly' });
    const b = seedOrder({ type: 'subscription_monthly' });
    fulfillOrder(a.orderId);
    assert.equal(subsOf(a.brandId).length, 1);
    assert.equal(subsOf(b.brandId).length, 0, 'RÒ CHÉO: fulfil brand A tạo gói cho brand B');
  });
});

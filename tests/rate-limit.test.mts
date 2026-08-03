/**
 * Rate limiter — lưới chặn dò mật khẩu và đốt ví.
 *
 * Vì sao test: đây là lớp gác mà HỎNG THÌ IM LẶNG. Limiter luôn cho qua trông
 * y hệt limiter hoạt động tốt — không có triệu chứng nào cho tới lúc xem hoá đơn
 * hoặc mất tài khoản. Chỉ test mới phân biệt được hai trạng thái đó.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { rateLimit } from '../lib/rate-limit.js';

// Mỗi ca dùng key riêng: bucket là Map dùng chung toàn module, ca này rò sang ca kia
// thì test xanh/đỏ theo THỨ TỰ chạy — loại lỗi tệ nhất trong một bộ test.
let n = 0;
const freshKey = (label: string) => `test:${label}:${++n}:${process.hrtime.bigint()}`;

describe('rateLimit', () => {
  test('cho qua đúng `limit` lần rồi chặn', () => {
    const key = freshKey('basic');
    for (let i = 1; i <= 5; i++) {
      assert.equal(rateLimit(key, 5, 60_000).ok, true, `lần ${i} phải qua`);
    }
    assert.equal(rateLimit(key, 5, 60_000).ok, false, 'lần 6 phải bị chặn');
  });

  test('remaining đếm lùi đúng và không âm', () => {
    const key = freshKey('remaining');
    assert.equal(rateLimit(key, 3, 60_000).remaining, 2);
    assert.equal(rateLimit(key, 3, 60_000).remaining, 1);
    assert.equal(rateLimit(key, 3, 60_000).remaining, 0);
    // Vượt trần vẫn phải là 0, không phải số âm (giá trị này đi thẳng ra header).
    assert.equal(rateLimit(key, 3, 60_000).remaining, 0);
  });

  test('key khác nhau đếm độc lập — khách A không tiêu hạn mức của khách B', () => {
    const a = freshKey('iso-a');
    const b = freshKey('iso-b');
    for (let i = 0; i < 3; i++) rateLimit(a, 3, 60_000);
    assert.equal(rateLimit(a, 3, 60_000).ok, false, 'A đã hết lượt');
    assert.equal(rateLimit(b, 3, 60_000).ok, true, 'B phải còn nguyên lượt');
  });

  test('hết cửa sổ thì mở lại', async () => {
    const key = freshKey('window');
    assert.equal(rateLimit(key, 1, 60).ok, true);
    assert.equal(rateLimit(key, 1, 60).ok, false, 'trong cửa sổ: chặn');
    await new Promise(r => setTimeout(r, 90));
    assert.equal(rateLimit(key, 1, 60).ok, true, 'qua cửa sổ: mở lại');
  });

  test('retryAfterSec chỉ có khi bị chặn, và luôn ≥ 1', () => {
    const key = freshKey('retry');
    assert.equal(rateLimit(key, 1, 60_000).retryAfterSec, 0, 'qua thì không có Retry-After');
    const blocked = rateLimit(key, 1, 60_000);
    assert.equal(blocked.ok, false);
    assert.ok(blocked.retryAfterSec >= 1, 'Retry-After = 0 khiến client thử lại tức thì → bão request');
    assert.ok(blocked.retryAfterSec <= 60, `Retry-After không được vượt cửa sổ, nhận ${blocked.retryAfterSec}`);
  });

  test('limit 0 chặn ngay từ request đầu (dùng làm công tắc khoá)', () => {
    assert.equal(rateLimit(freshKey('zero'), 0, 60_000).ok, false);
  });
});

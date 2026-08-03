/**
 * BÁO ĐỘNG — và van an toàn của chính nó.
 *
 * Nghịch lý của hệ báo động: thứ dễ gây sự cố nhất lại chính là nó. Một route
 * hỏng bắn 1000 tin/phút sẽ (a) bị Telegram khoá bot, (b) dạy người chủ phớt lờ
 * thông báo — và lần sập THẬT tiếp theo sẽ trôi qua không ai nhìn. Nên van gộp
 * trùng + trần/giờ không phải tính năng phụ, nó là điều kiện để báo động còn
 * đáng tin. Đó là lý do test nằm ở đây.
 */
import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

// File test này TỰ dựng môi trường của nó và phải làm chủ hoàn toàn — kể cả
// khi bên ngoài đã đặt sẵn biến. CI đặt ALERT_ENABLED=0 làm van an toàn chung
// (để không có test nào lỡ bắn Telegram thật); nếu không gỡ ở đây thì 8 ca
// dưới thấy "0 tin gửi đi" và đỏ vì đúng cái van bảo vệ chúng.
delete process.env.ALERT_ENABLED;
process.env.ALERT_TELEGRAM_TOKEN = 'test-token';
process.env.ALERT_TELEGRAM_CHAT_ID = '12345';
process.env.LOG_LEVEL = 'fatal'; // im tiếng stdout để output test đọc được

// Chặn mọi lời gọi mạng thật: test không được phép gọi ra Telegram.
const sent: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  sent.push(String(init?.body ?? ''));
  return new Response('{"ok":true}', { status: 200 });
}) as typeof fetch;
after(() => { globalThis.fetch = realFetch; });

const { alert, log, __resetAlertState } = await import('../lib/logger.js');

let n = 0;
const scope = () => `test-scope-${++n}`;

beforeEach(() => { __resetAlertState(); sent.length = 0; });

describe('gộp trùng', () => {
  test('cùng một lỗi lặp lại chỉ bắn 1 tin', () => {
    const s = scope();
    assert.equal(alert(s, 'DB timeout'), true, 'lần đầu phải bắn');
    for (let i = 0; i < 50; i++) alert(s, 'DB timeout');
    assert.equal(sent.length, 1, `bắn ${sent.length} tin cho cùng một lỗi`);
  });

  test('lỗi KHÁC nhau vẫn bắn riêng — gộp không được nuốt lỗi mới', () => {
    const s = scope();
    alert(s, 'DB timeout');
    alert(s, 'token Facebook hỏng');
    assert.equal(sent.length, 2, 'gộp quá tay làm mất lỗi thứ hai');
  });

  test('vân tay bỏ qua con số — cùng lỗi khác id vẫn là một', () => {
    // "render video RM-001 lỗi" và "render video RM-002 lỗi" là CÙNG sự cố.
    // Không chuẩn hoá thì một hàng đợi hỏng sẽ bắn một tin cho mỗi job.
    const s = scope();
    alert(s, 'render video 1001 thất bại');
    for (let i = 1002; i < 1050; i++) alert(s, `render video ${i} thất bại`);
    assert.equal(sent.length, 1, `bắn ${sent.length} tin cho cùng một lớp sự cố`);
  });

  test('scope khác nhau không gộp vào nhau', () => {
    alert(scope(), 'lỗi giống hệt');
    alert(scope(), 'lỗi giống hệt');
    assert.equal(sent.length, 2);
  });
});

describe('trần theo giờ', () => {
  test('không vượt quá 20 tin/giờ dù có bao nhiêu lỗi khác nhau', () => {
    // Ca thật: deploy hỏng làm 200 route khác nhau cùng nổ.
    for (let i = 0; i < 200; i++) alert(scope(), `lỗi loại ${String.fromCharCode(65 + (i % 26))}${i}`);
    assert.ok(sent.length <= 20, `bắn ${sent.length} tin — vượt trần, Telegram sẽ khoá bot`);
    assert.ok(sent.length >= 15, `chỉ bắn ${sent.length} tin — trần siết quá tay, mất cảnh báo thật`);
  });
});

describe('nội dung tin', () => {
  test('có scope và nội dung để biết chỗ nào hỏng', () => {
    alert('payment.momo', 'fulfil hỏng', { orderId: 'LIT123' });
    const body = sent[0];
    assert.match(body, /payment\.momo/);
    assert.match(body, /fulfil hỏng/);
    assert.match(body, /LIT123/, 'thiếu ngữ cảnh thì tin báo vô dụng');
  });

  test('KHÔNG được lộ token/mật khẩu vào tin báo', () => {
    // Tin báo đi ra Telegram — log lộ secret là lộ thật, khó thu hồi.
    alert(scope(), 'gọi API hỏng', {
      apiKey: 'sk-live-SUPERSECRET',
      password: 'hunter2',
      authorization: 'Bearer abc123',
      orderId: 'LIT999',
    });
    const body = sent[0];
    assert.ok(!body.includes('SUPERSECRET'), 'apiKey lọt vào tin báo');
    assert.ok(!body.includes('hunter2'), 'password lọt vào tin báo');
    assert.ok(!body.includes('abc123'), 'authorization lọt vào tin báo');
    assert.match(body, /LIT999/, 'lọc quá tay làm mất cả ngữ cảnh vô hại');
  });

  test('Error object ra được message, không phải "{}"', () => {
    alert(scope(), 'vòng nền lỗi', { err: new Error('SQLITE_BUSY: database is locked') });
    assert.match(sent[0], /SQLITE_BUSY/, 'Error serialize thành {} là mất sạch thông tin gỡ lỗi');
  });
});

describe('van an toàn', () => {
  test('tắt bằng ALERT_ENABLED=0', () => {
    process.env.ALERT_ENABLED = '0';
    try {
      assert.equal(alert(scope(), 'không được bắn'), false);
      assert.equal(sent.length, 0);
    } finally { delete process.env.ALERT_ENABLED; }
  });

  test('chưa cấu hình Telegram thì im lặng, KHÔNG nổ', () => {
    const t = process.env.ALERT_TELEGRAM_TOKEN;
    delete process.env.ALERT_TELEGRAM_TOKEN;
    try {
      assert.equal(alert(scope(), 'thiếu cấu hình'), false);
      assert.equal(sent.length, 0);
    } finally { process.env.ALERT_TELEGRAM_TOKEN = t; }
  });

  test('log.errorQuiet ghi log nhưng KHÔNG đánh thức ai', () => {
    log.errorQuiet(scope(), 'lỗi đã có đường phục hồi');
    assert.equal(sent.length, 0, 'errorQuiet mà vẫn bắn thì không còn cách nào ghi lỗi im lặng');
  });

  test('fetch hỏng không được làm nổ chỗ gọi', async () => {
    const f = globalThis.fetch;
    globalThis.fetch = (async () => { throw new Error('mạng chết'); }) as typeof fetch;
    try {
      assert.doesNotThrow(() => alert(scope(), 'lỗi khi mạng chết'));
      await new Promise(r => setTimeout(r, 30)); // để promise reject kịp nổ nếu không được bắt
    } finally { globalThis.fetch = f; }
  });
});

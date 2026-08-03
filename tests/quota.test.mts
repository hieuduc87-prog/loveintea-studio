/**
 * HẠN MỨC — cổng chắn giữa khách và hoá đơn AI.
 *
 * Vì sao test lớp này trước mọi lớp khác: hỏng theo CẢ HAI CHIỀU đều đắt và
 * đều im lặng. Lỏng quá → khách gói 199$ render 100 video, chỉ phát hiện lúc
 * nhà cung cấp gửi bill. Chặt quá / trừ nhầm → khách trả tiền mà bị chặn, và
 * họ không báo lỗi, họ bỏ đi.
 *
 * Test chạy trên DB tạm (DATA_DIR riêng) — không bao giờ chạm data thật.
 */
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lit-quota-'));
process.env.DATA_DIR = TMP;
// Hạn mức/sổ chi phí là bảng PLATFORM (sống ở global DB) — tách tenant không
// liên quan, tắt cho test chạy nhanh và độc lập với cờ migration.
process.env.TENANT_DB_SPLIT = '0';

const { DEFAULT_QUOTA, getQuota, setQuota, checkQuota, consumeQuota, refundQuota, reserveQuota, getUsage } =
  await import('../lib/quota.js');
const { recordCost } = await import('../lib/cost-ledger.js');

after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* dọn dẹp lỗi không làm đỏ test */ } });

let seq = 0;
const brand = (label: string) => `qtest-${label}-${++seq}`;

describe('getQuota / setQuota', () => {
  test('brand chưa gán hạn mức → gói trial CHẶT, không phải vô hạn', () => {
    const q = getQuota(brand('default'));
    assert.deepEqual(q, DEFAULT_QUOTA);
    // Luật quan trọng nhất của file: mặc định phải là CHẶN, không phải MỞ.
    // Nếu ai đó đổi default thành -1, khách mới sẽ đốt tiền không giới hạn.
    assert.ok(q.videos >= 0 && q.images >= 0 && q.content >= 0, 'mặc định KHÔNG được là vô hạn');
    assert.ok(q.capUsd > 0, 'mặc định phải có trần chi tiêu');
  });

  test('lưu rồi đọc lại ra đúng số', () => {
    const b = brand('roundtrip');
    setQuota(b, { plan: 'pro', videos: 50, images: 500, content: 2000, capUsd: 300 });
    const q = getQuota(b);
    assert.equal(q.plan, 'pro');
    assert.equal(q.videos, 50);
    assert.equal(q.capUsd, 300);
  });

  test('cập nhật một phần không xoá các trường còn lại', () => {
    const b = brand('partial');
    setQuota(b, { plan: 'pro', videos: 50, images: 500, content: 2000, capUsd: 300 });
    setQuota(b, { videos: 99 });
    const q = getQuota(b);
    assert.equal(q.videos, 99);
    assert.equal(q.images, 500, 'images bị mất khi chỉ sửa videos');
    assert.equal(q.plan, 'pro', 'plan bị mất khi chỉ sửa videos');
  });
});

describe('đếm và trừ', () => {
  test('consume cộng dồn, refund trừ lại, không bao giờ âm', () => {
    const b = brand('count');
    consumeQuota(b, 'video', 2);
    consumeQuota(b, 'video', 1);
    assert.equal(getUsage(b).video, 3);
    refundQuota(b, 'video', 1);
    assert.equal(getUsage(b).video, 2);
    // Refund quá tay (retry hoàn hai lần) không được tạo hạn mức từ hư không.
    refundQuota(b, 'video', 99);
    assert.equal(getUsage(b).video, 0, 'used âm = khách được tặng lượt miễn phí');
  });

  test('các metric đếm riêng — dùng hết ảnh không được khoá video', () => {
    const b = brand('metrics');
    setQuota(b, { videos: 5, images: 1, content: 5, capUsd: 0 });
    consumeQuota(b, 'image', 1);
    assert.equal(checkQuota(b, 'image').ok, false);
    assert.equal(checkQuota(b, 'video').ok, true, 'hết ảnh mà chặn cả video là chặn oan');
  });

  test('hạn mức tách theo brand — khách A tiêu không đụng khách B', () => {
    const a = brand('iso-a');
    const b = brand('iso-b');
    setQuota(a, { videos: 1, images: 1, content: 1, capUsd: 0 });
    setQuota(b, { videos: 1, images: 1, content: 1, capUsd: 0 });
    consumeQuota(a, 'video', 1);
    assert.equal(checkQuota(a, 'video').ok, false);
    assert.equal(checkQuota(b, 'video').ok, true, 'RÒ CHÉO BRAND: A tiêu làm B bị chặn');
  });
});

describe('checkQuota — biên', () => {
  test('cho tới đúng trần, chặn từ đơn vị vượt', () => {
    const b = brand('edge');
    setQuota(b, { videos: 3, images: 3, content: 3, capUsd: 0 });
    consumeQuota(b, 'video', 2);
    assert.equal(checkQuota(b, 'video', 1).ok, true, 'đơn vị thứ 3 vẫn phải qua');
    assert.equal(checkQuota(b, 'video', 2).ok, false, 'xin 2 khi chỉ còn 1 phải chặn');
  });

  test('xin nhiều đơn vị một lần được xét theo TỔNG, không phải từng cái', () => {
    // Sinh hàng loạt (plan generate 10 ảnh) phải chặn TRƯỚC, không cho lọt 1 rồi hỏng.
    const b = brand('batch');
    setQuota(b, { videos: 0, images: 5, content: 0, capUsd: 0 });
    assert.equal(checkQuota(b, 'image', 10).ok, false);
    assert.equal(checkQuota(b, 'image', 5).ok, true);
  });

  test('-1 = vô hạn: không chặn dù đã dùng rất nhiều', () => {
    const b = brand('unlimited');
    setQuota(b, { videos: -1, images: -1, content: -1, capUsd: 0 });
    consumeQuota(b, 'video', 9999);
    assert.equal(checkQuota(b, 'video', 100).ok, true);
  });

  test('lý do chặn là câu tiếng Việt khách đọc hiểu', () => {
    const b = brand('reason');
    setQuota(b, { videos: 1, images: 1, content: 1, capUsd: 0 });
    consumeQuota(b, 'video', 1);
    const c = checkQuota(b, 'video');
    assert.equal(c.ok, false);
    assert.ok(c.reason && c.reason.length > 10, 'chặn mà không nói lý do = khách không biết phải làm gì');
  });
});

describe('trần chi tiêu (cap_usd) — lưới an toàn cuối', () => {
  test('chạm trần thì chặn kể cả khi còn dư hạn mức đơn vị', () => {
    const b = brand('cap');
    setQuota(b, { videos: 1000, images: 1000, content: 1000, capUsd: 5 });
    assert.equal(checkQuota(b, 'video').ok, true, 'chưa tiêu gì thì phải cho qua');
    recordCost({ brandId: b, feature: 'video_clip', provider: 'fal', model: 'hailuo-02', usd: 6 });
    assert.equal(checkQuota(b, 'video').ok, false, 'vượt trần USD mà vẫn cho chạy = lỗ không đáy');
  });

  test('lý do chặn KHÔNG được lộ giá vốn cho khách', () => {
    // Luật ghi trong lib/quota.ts: cap_usd/spentUsd là số NỘI BỘ. Lộ ra là khách
    // biết chính xác biên lợi nhuận trên mỗi video.
    const b = brand('cap-secret');
    setQuota(b, { videos: 1000, images: 1000, content: 1000, capUsd: 5 });
    recordCost({ brandId: b, feature: 'video_clip', provider: 'fal', model: 'hailuo-02', usd: 7.4321 });
    const c = checkQuota(b, 'video');
    assert.equal(c.ok, false);
    const reason = c.reason ?? '';
    assert.ok(!/usd|\$|7\.43|đô/i.test(reason), `lý do lộ giá vốn: "${reason}"`);
  });

  test('capUsd = 0 nghĩa là KHÔNG áp trần (không phải trần bằng 0)', () => {
    const b = brand('cap-zero');
    setQuota(b, { videos: 10, images: 10, content: 10, capUsd: 0 });
    recordCost({ brandId: b, feature: 'video_clip', provider: 'fal', model: 'hailuo-02', usd: 500 });
    assert.equal(checkQuota(b, 'video').ok, true, 'capUsd=0 bị hiểu thành trần 0 sẽ khoá sạch mọi brand chưa cấu hình');
  });
});

describe('reserveQuota — đặt chỗ trước khi làm việc tốn tiền', () => {
  test('qua cổng thì TRỪ NGAY (không đợi việc xong)', () => {
    // Render video mất vài phút. Đếm lúc xong thì 50 request song song lọt hết.
    const b = brand('reserve');
    setQuota(b, { videos: 2, images: 2, content: 2, capUsd: 0 });
    assert.equal(reserveQuota(b, 'video', 1), null);
    assert.equal(getUsage(b).video, 1, 'phải trừ NGAY lúc đặt chỗ');
  });

  test('bị chặn thì KHÔNG trừ — khách không mất lượt oan', () => {
    const b = brand('reserve-block');
    setQuota(b, { videos: 1, images: 1, content: 1, capUsd: 0 });
    reserveQuota(b, 'video', 1);
    const before = getUsage(b).video;
    const denied = reserveQuota(b, 'video', 1);
    assert.ok(denied, 'phải bị chặn');
    assert.equal(getUsage(b).video, before, 'bị chặn mà vẫn trừ = khách mất lượt vì lỗi của hệ');
  });

  test('chặn song song: N lời gọi liên tiếp chỉ qua đúng `limit` lần', () => {
    // Đây là ca thật của "50 request cùng lúc" — reserve phải là cổng một chiều.
    const b = brand('race');
    setQuota(b, { videos: 3, images: 3, content: 3, capUsd: 0 });
    const passed = Array.from({ length: 10 }, () => reserveQuota(b, 'video', 1)).filter(r => r === null).length;
    assert.equal(passed, 3, `cho qua ${passed} lần trong khi hạn mức là 3`);
    assert.equal(getUsage(b).video, 3);
  });
});

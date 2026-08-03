export const dynamic = 'force-dynamic';
/**
 * GET /api/health/live — LIVENESS CÔNG KHAI cho máy dò ngoài (UptimeRobot…).
 *
 * Vì sao tách khỏi /api/health: cái kia nằm sau NextAuth nên máy dò bên ngoài
 * KHÔNG gọi được — tức là hệ không có cách nào báo "tôi chết" ra ngoài. Mà
 * process chết thì mọi báo động trong process cũng chết theo: chỉ con mắt ĐỨNG
 * NGOÀI mới thấy. Đây là mắt đó.
 *
 * KHÔNG trả bất kỳ dữ liệu khách / cấu hình nào — endpoint này ai cũng gọi được.
 * 200 = sống lành; 503 = sống nhưng hỏng (DB không mở được / scheduler treo)
 * để máy dò biết mà báo, thay vì thấy 200 rồi yên tâm.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { enforceRateLimit } from '@/lib/rate-limit';

/** Scheduler tick 60s/lần; quá 5 phút không nhúc nhích = vòng nền đã treo. */
const TICK_STALE_MS = 5 * 60_000;

export async function GET(req: NextRequest) {
  // Công khai = phải có phanh, nếu không nó thành cổng khuếch đại DB.
  const limited = enforceRateLimit(req, { scope: 'health:live', limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const out: Record<string, unknown> = {
    ok: true,
    at: new Date().toISOString(),
    uptimeSec: Math.round(process.uptime()),
    rev: process.env.GIT_REV || 'unknown',
  };

  let healthy = true;

  // 1. DB có mở và đọc được không (bắt cả hỏng đĩa / file khoá).
  try {
    getDb().prepare('SELECT 1').get();
    out.db = 'ok';
  } catch (e) {
    healthy = false;
    out.db = 'fail';
    out.dbError = e instanceof Error ? e.message : 'unknown';
  }

  // 2. Vòng nền còn nhúc nhích không. Bỏ qua trong 5 phút đầu sau boot —
  //    scheduler chưa kịp tick lần nào, báo lúc đó là báo nhầm.
  try {
    const row = getDb().prepare("SELECT value FROM settings WHERE key='scheduler_last_tick'").get() as { value: string } | undefined;
    const ageMs = row ? Date.now() - new Date(row.value).getTime() : null;
    out.schedulerAgeSec = ageMs === null ? null : Math.round(ageMs / 1000);

    // Thứ tự xét quan trọng: CÓ TICK MỚI thắng mọi thứ khác. Bản đầu xét
    // `booting` trước nên trong 5 phút đầu luôn trả 'booting' kể cả khi vòng
    // nền đã chạy ngon — khiến 'ok' không bao giờ đạt tới và mọi thứ chờ tín
    // hiệu sẵn sàng (CI, deploy) treo vô ích.
    if (ageMs !== null && ageMs <= TICK_STALE_MS) {
      out.scheduler = 'ok';
    } else if (process.uptime() * 1000 < TICK_STALE_MS) {
      // Chưa tick lần nào nhưng mới boot — chưa kết luận, cũng chưa báo động.
      out.scheduler = 'booting';
    } else {
      healthy = false;
      out.scheduler = 'stale';
    }
  } catch {
    out.scheduler = 'unknown';
  }

  out.ok = healthy;
  return NextResponse.json(out, {
    status: healthy ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}

/**
 * Next.js instrumentation hook — runs once when the server process boots.
 * Starts the background scheduler (scheduled-post publishing + metrics sync)
 * và cài LƯỚI BẮT LỖI TOÀN CỤC.
 *
 * Vì sao có lưới: một `throw` lọt ra ngoài mọi try/catch sẽ giết cả process —
 * Docker restart, scheduler mất trạng thái, bài hẹn giờ trễ — mà không ai biết
 * vì log chỉ nằm trong container. Bắt ở đây để BÁO trước khi chết.
 *
 * ⚠️ TOÀN BỘ thân hàm PHẢI nằm trong `if (NEXT_RUNTIME === 'nodejs') { … }`.
 * Next build file này cho CẢ hai runtime; chỉ ở dạng KHỐI IF thì webpack mới
 * thay hằng số rồi loại sạch nhánh chết khỏi bundle edge. Viết thành early
 * return (`if (… !== 'nodejs') return`) trông tương đương nhưng webpack vẫn
 * kéo scheduler → lib/facebook → `crypto` vào bundle edge và BUILD HỎNG.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { log, alert } = await import('./lib/logger');

    // Promise reject không ai bắt: Node 20 mặc định GIẾT process.
    process.on('unhandledRejection', (reason) => {
      log.fatal('process', 'unhandledRejection — process sắp chết', { err: reason });
    });

    // Exception đồng bộ lọt lưới: báo rồi thoát để Docker restart sạch (giữ
    // process sống sau uncaughtException là trạng thái không xác định, nguy hiểm hơn).
    process.on('uncaughtException', (err) => {
      log.fatal('process', 'uncaughtException — thoát để restart', { err });
      setTimeout(() => process.exit(1), 1500);
    });

    // Deploy dừng container: phân biệt "chết vì lỗi" với "dừng có chủ ý".
    for (const sig of ['SIGTERM', 'SIGINT'] as const) {
      process.on(sig, () => {
        log.info('process', `nhận ${sig} — dừng có chủ ý`);
        process.exit(0);
      });
    }

    const { startScheduler } = await import('./lib/scheduler');
    startScheduler();

    log.info('boot', 'server khởi động', {
      node: process.version,
      env: process.env.NODE_ENV,
      rev: process.env.GIT_REV || 'unknown',
      alerts: process.env.ALERT_TELEGRAM_TOKEN ? 'on' : 'off',
    });

    // Báo động CHƯA cấu hình thì nói to một lần — lưới không bật vẫn là mù, và
    // mù mà tưởng mình sáng thì tệ hơn mù mà biết.
    if (!process.env.ALERT_TELEGRAM_TOKEN || !process.env.ALERT_TELEGRAM_CHAT_ID) {
      log.warn('boot', 'BÁO ĐỘNG TẮT — chưa có ALERT_TELEGRAM_TOKEN/ALERT_TELEGRAM_CHAT_ID, sự cố prod sẽ không ai được đánh thức');
    } else {
      alert('boot', 'server vừa khởi động lại', { rev: process.env.GIT_REV || 'unknown' });
    }
  }
}

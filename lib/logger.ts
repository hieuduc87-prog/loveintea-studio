/**
 * LOG CÓ CẤU TRÚC + BÁO ĐỘNG — hết mù prod.
 *
 * Vì sao: trước file này, cả hệ chỉ có `console.log`/`console.error` rải rác.
 * Prod sập lúc 2h sáng thì biết qua lời khách, không phải qua máy. Sổ chi phí
 * và hạn mức đã có cổng gác, nhưng KHÔNG có gì đánh thức người khi cổng gãy.
 *
 * BA LỚP:
 *   1. `log.*`   — một dòng JSON ra stdout ⇒ `docker logs` grep/jq được, thay
 *                  cho chuỗi console.log không parse nổi.
 *   2. `alert()` — đẩy Telegram cho việc NGƯỜI phải biết ngay (scheduler chết,
 *                  thanh toán fulfil hỏng, process sắp chết).
 *   3. Van an toàn — báo động là thứ TỰ NÓ gây sự cố nếu không chặn: một route
 *                  hỏng có thể bắn 1000 tin/phút, Telegram khoá bot, và người
 *                  học cách phớt lờ. Nên: gộp trùng theo vân tay + trần/giờ.
 *
 * LUẬT: log/alert KHÔNG BAO GIỜ được làm hỏng việc thật — mọi đường đều nuốt
 * lỗi và không await (cùng nguyên tắc với cost-ledger.ts).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, fatal: 50 };
const MIN_RANK = LEVEL_RANK[(process.env.LOG_LEVEL as LogLevel) || 'info'] ?? 20;

export interface LogMeta { [k: string]: unknown }

/** Bỏ khoá nhạy cảm khỏi log — token/khoá API lọt vào log là lộ thật. */
const SECRET_KEY = /token|secret|password|passwd|api_?key|authorization|cookie|credential/i;

function scrub(v: unknown, depth = 0): unknown {
  if (v === null || v === undefined) return v;
  if (depth > 4) return '[deep]';
  if (v instanceof Error) return { name: v.name, message: v.message, stack: v.stack?.split('\n').slice(0, 6).join('\n') };
  if (Array.isArray(v)) return v.slice(0, 20).map(x => scrub(x, depth + 1));
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = SECRET_KEY.test(k) ? '[redacted]' : scrub(val, depth + 1);
    }
    return out;
  }
  if (typeof v === 'string' && v.length > 2000) return v.slice(0, 2000) + '…';
  return v;
}

function emit(level: LogLevel, scope: string, msg: string, meta?: LogMeta): void {
  if (LEVEL_RANK[level] < MIN_RANK) return;
  try {
    const line = JSON.stringify({
      t: new Date().toISOString(),
      lvl: level,
      scope,
      msg,
      ...(meta ? { meta: scrub(meta) as LogMeta } : {}),
    });
    // stderr cho warn trở lên: tách được luồng khi thu log.
    if (LEVEL_RANK[level] >= 30) console.error(line); else console.log(line);
  } catch { /* log hỏng không được giết việc thật */ }
}

// ── Báo động Telegram ──────────────────────────────────────────────────────
// Cấu hình runtime (route/scheduler chạy node runtime nên .env lúc `docker run`
// có tác dụng — KHÁC middleware edge, xem lib/rate-limit.ts).
const TG_TOKEN = () => process.env.ALERT_TELEGRAM_TOKEN || '';
const TG_CHAT = () => process.env.ALERT_TELEGRAM_CHAT_ID || '';
const ALERTS_ON = () => process.env.ALERT_ENABLED !== '0' && Boolean(TG_TOKEN() && TG_CHAT());

const DEDUPE_MS = 10 * 60_000;   // cùng một vân tay: 10 phút gộp 1 lần
const HOURLY_CAP = 20;           // trần tuyệt đối để không tự DoS chính mình

interface AlertState { firstAt: number; lastSentAt: number; suppressed: number }
const alertState = new Map<string, AlertState>();
let hourStart = 0;
let hourCount = 0;

/** Vân tay = scope + msg đã bỏ số (id/timestamp) — cùng lỗi thì cùng vân tay. */
function fingerprint(scope: string, msg: string): string {
  return `${scope}:${msg.replace(/\d+/g, '#').slice(0, 160)}`;
}

function withinBudget(now: number): boolean {
  if (now - hourStart > 3600_000) { hourStart = now; hourCount = 0; }
  if (hourCount >= HOURLY_CAP) return false;
  hourCount++;
  return true;
}

async function sendTelegram(text: string): Promise<void> {
  const url = `https://api.telegram.org/bot${TG_TOKEN()}/sendMessage`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT(), text, disable_web_page_preview: true }),
      signal: ctrl.signal,
    });
  } finally { clearTimeout(timer); }
}

/**
 * Đánh thức người. KHÔNG await ở chỗ gọi — hàm này tự nuốt lỗi.
 * Trả về `true` nếu tin được gửi đi (dùng cho test), `false` nếu bị gộp/chặn.
 */
export function alert(scope: string, msg: string, meta?: LogMeta): boolean {
  emit('error', scope, msg, meta);
  if (!ALERTS_ON()) return false;

  const now = Date.now();
  const fp = fingerprint(scope, msg);
  const st = alertState.get(fp);
  if (st && now - st.lastSentAt < DEDUPE_MS) { st.suppressed++; return false; }
  if (!withinBudget(now)) return false;

  const repeat = st?.suppressed ? `\n(đã gộp ${st.suppressed} lần giống hệt trong ${Math.round(DEDUPE_MS / 60000)} phút)` : '';
  alertState.set(fp, { firstAt: st?.firstAt ?? now, lastSentAt: now, suppressed: 0 });

  const env = process.env.NODE_ENV === 'production' ? 'PROD' : 'DEV';
  const detail = meta ? `\n${JSON.stringify(scrub(meta)).slice(0, 900)}` : '';
  const text = `🚨 [${env}] ${scope}\n${msg}${detail}${repeat}`;

  void sendTelegram(text).catch(() => { /* báo động hỏng không được giết việc thật */ });
  return true;
}

export const log = {
  debug: (scope: string, msg: string, meta?: LogMeta) => emit('debug', scope, msg, meta),
  info: (scope: string, msg: string, meta?: LogMeta) => emit('info', scope, msg, meta),
  warn: (scope: string, msg: string, meta?: LogMeta) => emit('warn', scope, msg, meta),
  /** Lỗi CÓ NGƯỜI phải xử lý → vừa ghi log vừa báo động. */
  error: (scope: string, msg: string, meta?: LogMeta) => { alert(scope, msg, meta); },
  /** Lỗi ghi nhận nhưng KHÔNG đánh thức ai (đã có đường phục hồi). */
  errorQuiet: (scope: string, msg: string, meta?: LogMeta) => emit('error', scope, msg, meta),
  fatal: (scope: string, msg: string, meta?: LogMeta) => { emit('fatal', scope, msg, meta); alert(scope, `FATAL: ${msg}`, meta); },
};

/** Chỉ dùng trong test — xoá trạng thái gộp/trần giữa các ca. */
export function __resetAlertState(): void {
  alertState.clear(); hourStart = 0; hourCount = 0;
}

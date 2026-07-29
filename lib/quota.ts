/**
 * HẠN MỨC THEO KHÁCH — cổng chặn chi phí AI.
 *
 * Vì sao: mọi call AI đi qua API key của nền tảng, khách trả tiền theo gói.
 * Không có hạn mức thì một khách trả 199 USD render 100 video là nền tảng lỗ,
 * và không có gì báo động cho tới lúc xem hoá đơn nhà cung cấp.
 *
 * HAI LỚP:
 *   1. Hạn mức ĐƠN VỊ (video/ảnh/nội dung mỗi tháng) — khách hiểu được, hiện lên UI.
 *   2. TRẦN CHI TIÊU (cap_usd) — lưới an toàn cuối, tính từ cost_ledger. Bắt được
 *      cả trường hợp một đường tốn tiền nào đó chưa kịp gắn cổng đơn vị.
 *
 * ĐẶT TRƯỚC KHI LÀM, KHÔNG PHẢI SAU: render video mất nhiều phút, nếu chỉ đếm
 * lúc xong thì 50 request song song lọt hết. Việc hỏng thì hoàn lại (refundQuota).
 *
 * GIÁ VỐN (cap_usd, spentUsd) LÀ SỐ NỘI BỘ — không được lọt ra API khách xem.
 */
import { getDb } from './db';
import { brandSpend } from './cost-ledger';

export type QuotaMetric = 'video' | 'image' | 'content';

export interface BrandQuota {
  plan: string;
  videos: number;   // -1 = không giới hạn
  images: number;
  content: number;
  capUsd: number;   // NỘI BỘ
  note?: string | null;
}

/** Gói mặc định khi brand chưa được gán hạn mức — cố tình CHẶT (khách mới = dùng thử). */
export const DEFAULT_QUOTA: BrandQuota = { plan: 'trial', videos: 4, images: 40, content: 150, capUsd: 20 };

const LIMIT_FIELD: Record<QuotaMetric, keyof Pick<BrandQuota, 'videos' | 'images' | 'content'>> = {
  video: 'videos', image: 'images', content: 'content',
};

/** Kỳ tính hạn mức: tháng theo UTC (container chạy UTC — khớp scheduled_at). */
export function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

export function getQuota(brandId: string): BrandQuota {
  try {
    const r = getDb().prepare(
      'SELECT plan, videos, images, content, cap_usd, note FROM brand_quotas WHERE brand_id=?'
    ).get(brandId) as { plan: string; videos: number; images: number; content: number; cap_usd: number; note: string | null } | undefined;
    if (!r) return DEFAULT_QUOTA;
    return { plan: r.plan, videos: r.videos, images: r.images, content: r.content, capUsd: r.cap_usd, note: r.note };
  } catch { return DEFAULT_QUOTA; }
}

export function setQuota(brandId: string, q: Partial<BrandQuota>): void {
  const cur = getQuota(brandId);
  const n = { ...cur, ...q };
  getDb().prepare(
    `INSERT INTO brand_quotas (brand_id, plan, videos, images, content, cap_usd, note, updated_at)
     VALUES (?,?,?,?,?,?,?, datetime('now'))
     ON CONFLICT(brand_id) DO UPDATE SET
       plan=excluded.plan, videos=excluded.videos, images=excluded.images,
       content=excluded.content, cap_usd=excluded.cap_usd, note=excluded.note,
       updated_at=datetime('now')`
  ).run(brandId, n.plan, n.videos, n.images, n.content, n.capUsd, n.note ?? null);
}

/** Đã dùng bao nhiêu trong kỳ này. */
export function getUsage(brandId: string): Record<QuotaMetric, number> {
  const out: Record<QuotaMetric, number> = { video: 0, image: 0, content: 0 };
  try {
    const rows = getDb().prepare(
      'SELECT metric, used FROM usage_counters WHERE brand_id=? AND period=?'
    ).all(brandId, currentPeriod()) as Array<{ metric: QuotaMetric; used: number }>;
    for (const r of rows) if (r.metric in out) out[r.metric] = r.used;
  } catch { /* bảng chưa có → coi như chưa dùng gì */ }
  return out;
}

export interface QuotaCheck {
  ok: boolean;
  used: number;
  limit: number;      // -1 = không giới hạn
  reason?: string;    // câu tiếng Việt hiện cho khách
}

/**
 * Kiểm tra CÓ ĐỦ hạn mức cho n đơn vị không. Không trừ.
 * Chặn khi vượt đơn vị HOẶC chạm trần chi tiêu.
 */
export function checkQuota(brandId: string, metric: QuotaMetric, n = 1): QuotaCheck {
  const q = getQuota(brandId);
  const used = getUsage(brandId)[metric];
  const limit = q[LIMIT_FIELD[metric]];

  // Lưới an toàn: trần chi tiêu — lý do KHÔNG tiết lộ con số giá vốn cho khách.
  if (q.capUsd > 0 && brandSpend(brandId, 31) >= q.capUsd) {
    return { ok: false, used, limit, reason: 'Đã chạm trần sử dụng của tháng này. Liên hệ quản trị để nâng gói.' };
  }
  if (limit < 0) return { ok: true, used, limit };
  if (used + n > limit) {
    const label = metric === 'video' ? 'video' : metric === 'image' ? 'ảnh' : 'lượt tạo nội dung';
    return {
      ok: false, used, limit,
      reason: `Hết hạn mức ${label} tháng này (đã dùng ${used}/${limit}). Sang tháng sẽ tự làm mới, hoặc liên hệ quản trị để nâng gói.`,
    };
  }
  return { ok: true, used, limit };
}

/** Trừ hạn mức (đặt chỗ trước khi làm việc tốn tiền). */
export function consumeQuota(brandId: string, metric: QuotaMetric, n = 1): void {
  try {
    getDb().prepare(
      `INSERT INTO usage_counters (brand_id, period, metric, used) VALUES (?,?,?,?)
       ON CONFLICT(brand_id, period, metric) DO UPDATE SET used = used + excluded.used`
    ).run(brandId, currentPeriod(), metric, n);
  } catch { /* đếm hỏng không được chặn việc thật */ }
}

/** Hoàn lại khi việc hỏng ngay từ đầu (không tiêu tiền AI nào). */
export function refundQuota(brandId: string, metric: QuotaMetric, n = 1): void {
  try {
    getDb().prepare(
      `UPDATE usage_counters SET used = MAX(0, used - ?) WHERE brand_id=? AND period=? AND metric=?`
    ).run(n, brandId, currentPeriod(), metric);
  } catch { /* */ }
}

/**
 * Cổng dùng trong route: kiểm tra + đặt chỗ trong một bước.
 * Trả `null` nếu qua; trả object lỗi nếu chặn (route tự bọc NextResponse 429).
 */
export function reserveQuota(brandId: string, metric: QuotaMetric, n = 1):
  { error: string; used: number; limit: number } | null {
  const c = checkQuota(brandId, metric, n);
  if (!c.ok) return { error: c.reason ?? 'Hết hạn mức', used: c.used, limit: c.limit };
  consumeQuota(brandId, metric, n);
  return null;
}

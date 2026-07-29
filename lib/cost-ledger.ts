/**
 * SỔ CHI PHÍ THEO KHÁCH (NT5 — quy hoạch đa-brand).
 *
 * Vì sao cần: mọi call AI hiện đi qua API key của nền tảng. Không ghi sổ theo
 * brand thì (a) không biết khách nào tiêu bao nhiêu → không thu tiền được,
 * (b) không phát hiện được khách đốt tiền bất thường.
 *
 * Nguyên tắc: ghi sổ KHÔNG BAO GIỜ được làm hỏng việc thật → mọi hàm nuốt lỗi.
 */
import { getDb } from './db';
import { randomUUID } from 'crypto';

export type CostFeature = 'video_clip' | 'video_image' | 'video_sfx' | 'image_gen'
  | 'image_edit' | 'text_gen' | 'vision' | 'other';

export interface CostEntry {
  brandId: string;
  feature: CostFeature;
  provider: string;       // fal | openai | gemini | elevenlabs
  model: string;
  usd: number;
  qty?: string;           // "6s 768P", "1024x1536 medium"…
  refId?: string;         // mã video / id job — để truy ngược
}

/** Đơn giá đã verify (cập nhật khi nhà cung cấp đổi giá — ghi ngày verify). */
export const UNIT_PRICE = {
  'fal:hailuo-02': 0.045,          // /giây — verify 27/07/2026
  'fal:kling-2.5': 0.07,
  'fal:seedance-pro': 0.06,
  'fal:flux-schnell': 0.003,       // /megapixel
  'fal:flux-kontext': 0.04,        // /ảnh
  'fal:elevenlabs-sfx': 0.002,     // /giây
  'openai:gpt-image-2-medium': 0.06,
  'gemini:2.5-flash': 0.0004,      // ước lượng/call ngắn
} as const;

export function recordCost(e: CostEntry): void {
  if (!e.brandId || !(e.usd > 0)) return;
  try {
    getDb().prepare(
      `INSERT INTO cost_ledger (id, brand_id, feature, provider, model, qty, usd, ref_id, created_at)
       VALUES (?,?,?,?,?,?,?,?, datetime('now'))`
    ).run(randomUUID(), e.brandId, e.feature, e.provider, e.model,
      e.qty ?? null, Math.round(e.usd * 10000) / 10000, e.refId ?? null);
  } catch { /* sổ sách không bao giờ chặn việc thật */ }
}

export interface BrandCost {
  brandId: string; total: number; calls: number;
  byFeature: Record<string, number>;
  byProvider: Record<string, number>;
}

/** Tổng chi phí theo brand trong N ngày gần nhất. */
export function costByBrand(days = 30): BrandCost[] {
  try {
    const rows = getDb().prepare(
      `SELECT brand_id, feature, provider, COUNT(*) n, SUM(usd) s
       FROM cost_ledger WHERE created_at > datetime('now', ?)
       GROUP BY brand_id, feature, provider`
    ).all(`-${Math.max(1, days)} days`) as Array<{ brand_id: string; feature: string; provider: string; n: number; s: number }>;

    const map = new Map<string, BrandCost>();
    for (const r of rows) {
      const b = map.get(r.brand_id) ?? { brandId: r.brand_id, total: 0, calls: 0, byFeature: {}, byProvider: {} };
      b.total += r.s; b.calls += r.n;
      b.byFeature[r.feature] = Math.round(((b.byFeature[r.feature] ?? 0) + r.s) * 10000) / 10000;
      b.byProvider[r.provider] = Math.round(((b.byProvider[r.provider] ?? 0) + r.s) * 10000) / 10000;
      map.set(r.brand_id, b);
    }
    return [...map.values()]
      .map(b => ({ ...b, total: Math.round(b.total * 10000) / 10000 }))
      .sort((a, b) => b.total - a.total);
  } catch { return []; }
}

/** Chi phí của một brand (cho hạn mức / cảnh báo). */
export function brandSpend(brandId: string, days = 30): number {
  try {
    const r = getDb().prepare(
      `SELECT COALESCE(SUM(usd),0) s FROM cost_ledger WHERE brand_id=? AND created_at > datetime('now', ?)`
    ).get(brandId, `-${Math.max(1, days)} days`) as { s: number };
    return Math.round(r.s * 10000) / 10000;
  } catch { return 0; }
}

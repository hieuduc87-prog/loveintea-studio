/**
 * Template operating flow — AUTO-MATCH theo chủ đề content + rotation + win-bias.
 *
 * (a) Auto-match: chấm điểm template khớp với "yêu cầu content" của plan item (intent =
 *     purpose/pillar/hook/copy direction) qua bản đồ chủ đề (VI+EN).
 * (b) Rotation + random: không lặp 1 mẫu; rải đều khi điểm ngang.
 * (c) Win-bias: khi đã có metric thì lean theo template thắng. Chưa có metric → BỎ win-rate.
 */
import { getDb } from './db';

export interface PickedTemplate {
  id: string; name: string; image_url: string; analysis: string;
  format: string; category: string; aspect_ratio: string; kind: string;
}

export interface TemplatePerf {
  id: string; name: string; image_url: string; category: string; format: string; kind: string;
  usage_count: number; posts: number; avg_engaged: number; avg_reach: number; win: boolean;
}

// Bản đồ CHỦ ĐỀ content → từ khoá nhận diện (cả intent VI lẫn nội dung template EN).
const THEMES: Record<string, string[]> = {
  sleep:      ['sleep', 'calming', 'calm', 'night', 'nighty', 'relax', 'ngủ', 'thư giãn', 'an thần', 'bedtime', 'rest'],
  ingredient: ['ingredient', 'herb', 'botanical', 'thành phần', 'nguyên liệu', 'thảo mộc', 'tea leaf', 'leaves'],
  benefit:    ['benefit', 'health', 'wellness', 'detox', 'digest', 'immunity', 'lợi ích', 'sức khỏe', 'tiêu hóa', 'thanh lọc', 'công dụng'],
  lifestyle:  ['lifestyle', 'human', 'ritual', 'moment', 'routine', 'người', 'đời sống', 'thói quen', 'khoảnh khắc', 'hands', 'cozy'],
  variety:    ['variety', 'range', 'collection', 'many', 'options', 'đa dạng', 'bộ sưu tập', 'nhiều', 'tất cả', 'dòng sản phẩm'],
  origin:     ['origin', 'farm', 'organic', 'harvest', 'source', 'nguồn gốc', 'nông trại', 'thu hái', 'hữu cơ', 'vùng trồng'],
  product:    ['product', 'packshot', 'pack', 'box', 'bag', 'sản phẩm', 'bao bì', 'hộp', 'túi', 'gói'],
  promo:      ['promo', 'sale', 'offer', 'discount', 'launch', 'deal', 'ưu đãi', 'khuyến mãi', 'giảm giá', 'ra mắt', 'mới'],
  educate:    ['educate', 'how to', 'guide', 'tip', 'learn', 'brew', 'mẹo', 'hướng dẫn', 'cách', 'pha', 'học'],
  story:      ['story', 'brand', 'about', 'journey', 'câu chuyện', 'thương hiệu', 'hành trình'],
};

function themesOf(text: string): Set<string> {
  const s = (text || '').toLowerCase();
  const out = new Set<string>();
  for (const [theme, words] of Object.entries(THEMES)) {
    if (words.some(w => s.includes(w))) out.add(theme);
  }
  return out;
}

function templateSearchText(name: string, analysisJson: string): string {
  let a: { best_for?: string[]; style_keywords?: string[]; structure?: string; content_direction?: string; skeleton?: string } = {};
  try { a = JSON.parse(analysisJson || '{}'); } catch { /* */ }
  return [name, (a.best_for ?? []).join(' '), (a.style_keywords ?? []).join(' '), a.structure, a.content_direction, a.skeleton]
    .filter(Boolean).join(' ');
}

/** Per-template performance from linked posts' metrics (best-effort). */
export function getTemplatePerformance(brandId: string): TemplatePerf[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT t.id, t.name, t.image_url, t.category, t.format, t.kind, t.usage_count,
      COUNT(DISTINCT p.id) AS posts,
      COALESCE(AVG(pm.engaged), 0) AS avg_engaged,
      COALESCE(AVG(pm.reach), 0)   AS avg_reach
    FROM content_templates t
    LEFT JOIN posts p ON p.template_id = t.id AND p.status='published'
    LEFT JOIN post_metrics pm ON pm.post_id = p.id
    WHERE t.brand_id = ? AND t.is_active = 1
    GROUP BY t.id
    ORDER BY avg_engaged DESC
  `).all(brandId) as Array<Omit<TemplatePerf, 'win'>>;
  const withData = rows.filter(r => r.posts > 0).map(r => r.avg_engaged).sort((a, b) => a - b);
  const median = withData.length ? withData[Math.floor(withData.length / 2)] : 0;
  return rows.map(r => ({ ...r, win: r.posts > 0 && r.avg_engaged >= median && median > 0 }));
}

/**
 * Chọn 1 template cho brand. opts.intent = mô tả yêu cầu content (auto-match theo chủ đề).
 * opts.kind ('single'|'collection') lọc mềm (fallback nếu rỗng). format/category = boost mềm.
 * KHÔNG mark usage — gọi recordTemplateUse() sau khi tạo post.
 */
export function pickTemplate(
  brandId: string,
  opts: { format?: string; category?: string; kind?: string; intent?: string } = {}
): PickedTemplate | null {
  const db = getDb();
  type Row = PickedTemplate & { usage_count: number; last_used_at: string | null; avg_engaged: number; metric_rows: number };
  const rows = db.prepare(`
    SELECT t.id, t.name, t.image_url, t.analysis, t.format, t.category, t.aspect_ratio,
           t.kind, t.usage_count, t.last_used_at,
           COALESCE(AVG(pm.engaged),0) AS avg_engaged, COUNT(pm.id) AS metric_rows
    FROM content_templates t
    LEFT JOIN posts p ON p.template_id = t.id AND p.status='published'
    LEFT JOIN post_metrics pm ON pm.post_id = p.id
    WHERE t.brand_id = ? AND t.is_active = 1
    GROUP BY t.id
  `).all(brandId) as Row[];
  if (!rows.length) return null;

  // Lọc MỀM theo kind (carousel→collection): chỉ áp nếu có template cùng kind, không thì bỏ qua.
  let pool = rows;
  if (opts.kind) { const k = rows.filter(r => r.kind === opts.kind); if (k.length) pool = k; }

  const intentThemes = themesOf(opts.intent || '');
  const maxEng = Math.max(1, ...pool.map(r => r.avg_engaged));
  const hasMetrics = pool.some(r => r.metric_rows > 0);
  const now = Date.now();

  const scored = pool.map(r => {
    const tThemes = themesOf(templateSearchText(r.name, r.analysis));
    const match = intentThemes.size
      ? [...intentThemes].filter(t => tThemes.has(t)).length / intentThemes.size   // 0..1 độ khớp chủ đề
      : 0;
    const ageDays = r.last_used_at ? (now - new Date(r.last_used_at).getTime()) / 86_400_000 : 999;
    const recency = Math.min(1, ageDays / 7);
    const fmtBoost = opts.format && r.format === opts.format ? 0.08 : 0;
    const catBoost = opts.category && r.category === opts.category ? 0.05 : 0;
    const score = hasMetrics
      ? (r.avg_engaged / maxEng) * 0.4 + match * 0.35 + recency * 0.15 + fmtBoost + catBoost - r.usage_count * 0.001 + Math.random() * 0.18
      // early (chưa có metric): match chủ đề là chính + rotation + random; bỏ win-rate
      : match * 0.5 + recency * 0.22 + fmtBoost + catBoost - r.usage_count * 0.08 + Math.random() * 0.35;
    return { r, score };
  }).sort((a, b) => b.score - a.score);

  const { r } = scored[0];
  return { id: r.id, name: r.name, image_url: r.image_url, analysis: r.analysis, format: r.format, category: r.category, aspect_ratio: r.aspect_ratio, kind: r.kind };
}

export function recordTemplateUse(templateId: string) {
  getDb().prepare(`UPDATE content_templates SET usage_count = usage_count + 1, last_used_at = datetime('now') WHERE id = ?`).run(templateId);
}

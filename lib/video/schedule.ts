/**
 * Video schedules — tuyến video content định kỳ.
 * Scheduler gọi processVideoSchedules() mỗi 5 phút: schedule đến hạn →
 * xoay vòng sản phẩm → (recipe từ Nguồn học nếu gắn) → director dựng storyboard
 * → video_projects status='queued' (render tuần tự qua processVideoQueue).
 * Render xong → onScheduledProjectDone() tạo posts row (draft hoặc scheduled).
 */
import { v4 as uuid } from 'uuid';
import { getDb } from '../db';
import { buildStoryboard, Storyboard, VideoRecipe } from './director';

const VN_OFFSET_H = 7; // giờ VN — container chạy UTC

export interface VideoSchedule {
  id: string; brand_id: string; name: string | null;
  product_strategy: string; product_id: string | null; last_product_id: string | null;
  purpose: string; target_duration_s: number; use_voiceover: number;
  language: string | null; inspiration_item_id: string | null;
  cadence_days: number; hour_local: number; auto_post: string; platforms: string;
  enabled: number; last_run_at: string | null; next_run_at: string | null;
}

/** Lần chạy kế tiếp: from + cadence ngày, tại hour_local giờ VN (lưu ISO UTC). */
export function computeNextRun(cadenceDays: number, hourLocal: number, from = new Date()): string {
  const utcHour = ((hourLocal - VN_OFFSET_H) % 24 + 24) % 24;
  const d = new Date(from.getTime() + Math.max(1, cadenceDays) * 86_400_000);
  d.setUTCHours(utcHour, 0, 0, 0);
  if (d.getTime() <= from.getTime()) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

/** Xoay vòng sản phẩm theo sort_order; fixed → product_id cố định. */
function pickProduct(s: VideoSchedule): string | null {
  const db = getDb();
  if (s.product_strategy === 'fixed') return s.product_id;
  const products = db.prepare(
    'SELECT id FROM products WHERE brand_id=? ORDER BY sort_order, id'
  ).all(s.brand_id) as Array<{ id: string }>;
  if (!products.length) return null;
  const idx = products.findIndex(p => p.id === s.last_product_id);
  return products[(idx + 1) % products.length].id;
}

/** Chạy các lịch đến hạn. Gọi từ scheduler — nuốt lỗi per-schedule để không chặn lịch khác. */
export async function processVideoSchedules(): Promise<void> {
  const db = getDb();
  const due = db.prepare(`
    SELECT * FROM video_schedules
    WHERE enabled=1 AND (next_run_at IS NULL OR datetime(next_run_at) <= datetime('now'))
  `).all() as VideoSchedule[];
  if (!due.length) return;

  for (const s of due) {
    // Chống dồn job: nếu lịch này còn project chưa render xong thì bỏ lượt, thử lại tick sau.
    const pending = db.prepare(
      `SELECT COUNT(*) c FROM video_projects WHERE schedule_id=? AND status IN ('queued','rendering')`
    ).get(s.id) as { c: number };
    if (pending.c > 0) continue;

    try {
      const productId = pickProduct(s);
      let recipe: VideoRecipe | null = null;
      if (s.inspiration_item_id) {
        const item = db.prepare(
          'SELECT recipe_json FROM inspiration_items WHERE id=? AND brand_id=?'
        ).get(s.inspiration_item_id, s.brand_id) as { recipe_json: string } | undefined;
        try {
          const r = JSON.parse(item?.recipe_json || '{}') as VideoRecipe;
          if (r?.scenes?.length) recipe = r;
        } catch { /* recipe hỏng → dựng tự do */ }
      }

      const board = await buildStoryboard({
        brandId: s.brand_id, purpose: s.purpose, productId: productId ?? undefined,
        targetDurationS: s.target_duration_s, notes: s.name ? `Video định kỳ: ${s.name}` : undefined,
        language: s.language ?? undefined, recipe,
      });

      const projectId = uuid();
      db.prepare(`INSERT INTO video_projects
        (id, brand_id, title, purpose, product_id, target_duration_s, script_json, status,
         use_voiceover, vo_script, vo_voice, reference_recipe_json, schedule_id)
        VALUES (?,?,?,?,?,?,?, 'queued', ?,?,?,?,?)`)
        .run(projectId, s.brand_id, board.title, s.purpose, productId, s.target_duration_s,
          JSON.stringify(board), s.use_voiceover ? 1 : 0, board.voiceover ?? '', 'nova',
          recipe ? JSON.stringify(recipe) : null, s.id);

      db.prepare(`UPDATE video_schedules SET last_run_at=datetime('now'), last_product_id=?,
        next_run_at=?, last_error=NULL, updated_at=datetime('now') WHERE id=?`)
        .run(productId, computeNextRun(s.cadence_days, s.hour_local), s.id);
      console.log(`[video-schedule] ${s.id} (${s.brand_id}): queued project ${projectId} (product=${productId})`);
    } catch (e) {
      // Vẫn dời next_run để không retry mỗi tick — lỗi hiện trong UI qua last_error.
      db.prepare(`UPDATE video_schedules SET last_error=?, next_run_at=?, updated_at=datetime('now') WHERE id=?`)
        .run(String(e).slice(0, 400), computeNextRun(s.cadence_days, s.hour_local), s.id);
      console.error(`[video-schedule] ${s.id} failed:`, e);
    }
  }
}

function firstSentences(text: string, n: number): string {
  const parts = String(text || '').split(/(?<=[.!?。])\s+/).filter(Boolean);
  return parts.slice(0, n).join(' ').trim();
}

/** Render xong 1 project thuộc lịch → tạo bài đăng mang video (draft hoặc lên lịch đăng ngay). */
export function onScheduledProjectDone(projectId: string): void {
  const db = getDb();
  const p = db.prepare('SELECT * FROM video_projects WHERE id=?').get(projectId) as
    (Record<string, string | number | null> & { schedule_id?: string | null }) | undefined;
  if (!p?.schedule_id || !p.output_url) return;
  const s = db.prepare('SELECT * FROM video_schedules WHERE id=?').get(p.schedule_id) as VideoSchedule | undefined;
  if (!s) return;

  let board: Storyboard | null = null;
  try { board = JSON.parse(String(p.script_json || '{}')) as Storyboard; } catch { /* */ }
  const dna = db.prepare('SELECT hashtags FROM brand_dna WHERE brand_id=?').get(s.brand_id) as { hashtags: string } | undefined;
  let hashtags = '';
  try { hashtags = (JSON.parse(dna?.hashtags || '[]') as string[]).join(' '); } catch { /* */ }

  const caption = [
    board?.hook ?? String(p.title ?? ''),
    firstSentences(board?.voiceover ?? '', 2),
    board?.cta_text ? `👉 ${board.cta_text}` : '',
  ].filter(Boolean).join('\n\n');

  const product = p.product_id
    ? db.prepare('SELECT slug FROM products WHERE id=?').get(String(p.product_id)) as { slug: string } | undefined
    : undefined;

  const auto = s.auto_post === 'auto';
  db.prepare(`INSERT INTO posts
    (id, sku_id, caption, hashtags, platforms, status, scheduled_at, brand_id, video_url, notes, review_status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(uuid(), product?.slug ?? 'video', caption, hashtags, s.platforms,
      auto ? 'scheduled' : 'draft', auto ? new Date().toISOString() : null,
      s.brand_id, String(p.output_url),
      `Tự động từ lịch video "${s.name ?? s.id}" — project ${projectId}`,
      auto ? 'approved' : 'pending');
  console.log(`[video-schedule] post created for project ${projectId} (${auto ? 'scheduled now' : 'draft'})`);
}

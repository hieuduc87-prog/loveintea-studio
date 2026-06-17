/**
 * Unified Job Queue — mọi nơi "bấm Tạo" (ảnh, content, carousel, plan, phân tích video mẫu)
 * ghi 1 job để người dùng theo dõi tập trung: trạng thái, log, lỗi, tiến độ, kết quả.
 *
 * Triết lý: job tracking KHÔNG được làm hỏng công việc thật → mọi hàm bọc try/catch,
 * lỗi ghi job thì nuốt (best-effort). Endpoint vẫn chạy + trả kết quả như cũ.
 */
import { getDb } from './db';
import { v4 as uuid } from 'uuid';

export type JobKind = 'image' | 'content' | 'carousel' | 'plan' | 'reference' | 'video';

export function createJob(o: { brandId?: string; kind: JobKind; title: string; source?: string; meta?: unknown }): string {
  const id = uuid();
  try {
    getDb().prepare(
      `INSERT INTO jobs (id, brand_id, kind, title, source, meta_json, status, started_at)
       VALUES (?,?,?,?,?,?, 'running', datetime('now'))`
    ).run(id, o.brandId || 'loveintea', o.kind, (o.title || o.kind).slice(0, 200), o.source ?? null, o.meta ? JSON.stringify(o.meta) : null);
  } catch { /* jobs là phụ trợ — không bao giờ chặn việc thật */ }
  return id;
}

export function logJob(id: string, msg: string): void {
  if (!id) return;
  try {
    const ts = new Date().toISOString().slice(11, 19);
    getDb().prepare(`UPDATE jobs SET log = COALESCE(log,'') || ? WHERE id=?`).run(`[${ts}] ${msg}\n`, id);
  } catch { /* */ }
}

export function progressJob(id: string, pct: number): void {
  if (!id) return;
  try { getDb().prepare(`UPDATE jobs SET progress=? WHERE id=?`).run(Math.max(0, Math.min(100, Math.round(pct))), id); } catch { /* */ }
}

export function finishJob(id: string, result?: unknown): void {
  if (!id) return;
  try {
    getDb().prepare(
      `UPDATE jobs SET status='done', progress=100, result_json=?, completed_at=datetime('now'),
       duration_ms = CAST((julianday('now') - julianday(started_at)) * 86400000 AS INTEGER) WHERE id=?`
    ).run(result !== undefined ? JSON.stringify(result) : null, id);
  } catch { /* */ }
}

export function failJob(id: string, error: unknown): void {
  if (!id) return;
  try {
    getDb().prepare(
      `UPDATE jobs SET status='failed', error=?, completed_at=datetime('now'),
       duration_ms = CAST((julianday('now') - julianday(started_at)) * 86400000 AS INTEGER) WHERE id=?`
    ).run(String(error instanceof Error ? error.message : error).slice(0, 800), id);
  } catch { /* */ }
}

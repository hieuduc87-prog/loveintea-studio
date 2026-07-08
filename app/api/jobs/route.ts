export const dynamic = 'force-dynamic';
/**
 * GET /api/jobs?status=&limit= — UNIFIED feed: bảng `jobs` (mọi nút Tạo) + `video_projects`
 * (render video) gộp chung 1 dòng thời gian để theo dõi tập trung. Trả counts theo trạng thái.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';

interface UnifiedJob {
  id: string; brand_id: string; kind: string; title: string; source: string | null;
  status: string; progress: number; log: string; error: string | null;
  result_json: string | null; duration_ms: number | null;
  created_at: string; completed_at: string | null;
}

// video_projects.status → job status
const VIDEO_STATUS: Record<string, string> = { draft: 'pending', queued: 'pending', rendering: 'running', done: 'done', failed: 'failed' };

export async function GET(req: NextRequest) {
  const db = getDb();
  const status = req.nextUrl.searchParams.get('status');
  const limit = Math.min(200, parseInt(req.nextUrl.searchParams.get('limit') ?? '80'));
  const brandId = getBrandId(req);

  // ── jobs table ──
  const jobRows = db.prepare(
    `SELECT id, brand_id, kind, title, source, status, progress, log, error, result_json, duration_ms, created_at, completed_at
     FROM jobs ${brandId ? 'WHERE brand_id=?' : ''} ORDER BY created_at DESC LIMIT 300`
  ).all(...(brandId ? [brandId] : [])) as UnifiedJob[];

  // ── video_projects → job shape ──
  const vidRows = (db.prepare(
    `SELECT id, brand_id, title, status, render_log, error, output_url, created_at, updated_at
     FROM video_projects ${brandId ? 'WHERE brand_id=?' : ''} ORDER BY created_at DESC LIMIT 100`
  ).all(...(brandId ? [brandId] : [])) as Array<Record<string, string | null>>).map(v => ({
    id: String(v.id), brand_id: String(v.brand_id ?? 'loveintea'), kind: 'video',
    title: v.title || 'Video render', source: 'Video Studio',
    status: VIDEO_STATUS[String(v.status)] ?? 'pending', progress: 0,
    log: v.render_log || '', error: v.error,
    result_json: v.output_url ? JSON.stringify({ url: v.output_url }) : null,
    duration_ms: null, created_at: String(v.created_at), completed_at: v.updated_at,
  } as UnifiedJob));

  let all = [...jobRows, ...vidRows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const counts = ['pending', 'running', 'done', 'failed'].map(s => ({ status: s, count: all.filter(j => j.status === s).length }));
  if (status && status !== 'all') all = all.filter(j => j.status === status);
  all = all.slice(0, limit);

  return NextResponse.json({ jobs: all, counts });
}

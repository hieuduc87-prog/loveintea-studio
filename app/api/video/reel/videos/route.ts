export const dynamic = 'force-dynamic';
/**
 * Danh sách video Reel Machine của brand — MÃ VIDEO là khoá vận hành:
 * nhân viên copy mã tạo card kanban feedback; Claude grep mã ra project +
 * plan + render_log + cost để dò lỗi.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';

export async function GET(req: NextRequest) {
  const brandId = getBrandId(req);
  const rows = getDb().prepare(
    `SELECT id, video_code, title, purpose, product_id, status, output_url, error,
            version_label, script_json, grade_json, created_at, updated_at
     FROM video_projects WHERE brand_id=? AND template='ai_reel'
     ORDER BY created_at DESC LIMIT 60`
  ).all(brandId) as Array<Record<string, string | null>>;

  const videos = rows.map(r => {
    let templateId = ''; let productName = '';
    try {
      const plan = JSON.parse(String(r.script_json || '{}'));
      templateId = plan.template || '';
      productName = plan.profile?.productName || '';
    } catch { /* */ }
    let costUsd: number | null = null;
    try { costUsd = JSON.parse(String(r.grade_json || '{}')).cost_usd ?? null; } catch { /* */ }
    return {
      id: r.id, videoCode: r.video_code, title: r.title, productName,
      templateId, status: r.status, outputUrl: r.output_url, error: r.error,
      versionLabel: r.version_label, costUsd, createdAt: r.created_at, updatedAt: r.updated_at,
    };
  });
  return NextResponse.json({ videos });
}

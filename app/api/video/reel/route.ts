export const dynamic = 'force-dynamic';
export const maxDuration = 120;
/**
 * Creative Hub Reel Machine — API đề bài Iced Summer.
 * GET  /api/video/reel            → checklist BRAND_LIBRARY + SKU list (UI hiển thị đỏ/xanh)
 * POST /api/video/reel            → build ReelPlan (Gemini, nhanh) → tạo N video_projects
 *                                    status 'queued' — scheduler render nền 1-at-a-time.
 * Isolation: brandId CHỈ lấy từ getBrandId(req) (middleware đã validate quyền ?brand=) —
 * KHÔNG tin brandId trong body (bài học audit LIT-SEC-0721).
 */
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';
import { enforceRateLimit } from '@/lib/rate-limit';
import { createJob, logJob, failJob } from '@/lib/jobs';
import { buildReelPlan } from '@/lib/video/reel-director';
import { SKUS, VIDEO_TYPE_ORDERS } from '@/lib/video/reel-template';
import { libraryChecklist } from '@/lib/video/brand-library';

export async function GET(req: NextRequest) {
  const brandId = getBrandId(req);
  const skuCodes = Object.keys(SKUS);
  const slugs = Object.fromEntries(skuCodes.map(k => [k, SKUS[k].productSlug]));
  const checklist = libraryChecklist(brandId, skuCodes, slugs);
  return NextResponse.json({
    checklist,
    skus: skuCodes.map(k => ({ code: k, name: SKUS[k].name, moment: SKUS[k].moment })),
    videoTypes: Object.keys(VIDEO_TYPE_ORDERS),
    falConfigured: Boolean(process.env.FAL_KEY),
  });
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { scope: 'ai:reel', limit: 6, windowMs: 60_000 });
  if (limited) return limited;
  const brandId = getBrandId(req);
  if (!process.env.FAL_KEY) {
    return NextResponse.json({ error: 'FAL_KEY chưa cấu hình — founder thêm key fal.ai vào .env server rồi restart.' }, { status: 400 });
  }
  const body = await req.json().catch(() => ({})) as {
    sku?: string; videoType?: string; prompt?: string; versions?: number;
  };
  const sku = String(body.sku || 'HIB').toUpperCase();
  if (!SKUS[sku]) return NextResponse.json({ error: `SKU không hợp lệ: ${sku}` }, { status: 400 });
  const videoType = VIDEO_TYPE_ORDERS[String(body.videoType || '')] ? String(body.videoType) : 'iced_summer';
  const userPrompt = String(body.prompt || '').slice(0, 600);
  if (!userPrompt.trim()) return NextResponse.json({ error: 'Prompt là bắt buộc (Phiếu A).' }, { status: 400 });
  const versions = Math.min(3, Math.max(1, Number(body.versions) || 1));

  const db = getDb();
  const jobId = createJob({
    brandId, kind: 'video', source: 'ReelMachine',
    title: `🧊 Reel AI ${SKUS[sku].name} ×${versions}`,
    meta: { sku, videoType, versions },
  });

  try {
    const projectIds: string[] = [];
    for (let v = 0; v < versions; v++) {
      logJob(jobId, `Dựng plan ${v + 1}/${versions} (Gemini)…`);
      const plan = await buildReelPlan({ brandId, sku, videoType, userPrompt, versionIndex: v });
      const id = uuid();
      db.prepare(`INSERT INTO video_projects
        (id, brand_id, title, purpose, product_id, platform, aspect, target_duration_s,
         script_json, status, template, batch_id, version_label)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(id, brandId, `🧊 ${SKUS[sku].name} Reel ${plan.versionLabel}`, videoType,
          `prod-${SKUS[sku].productSlug}`, 'reels', '9:16', Math.round(plan.totalS),
          JSON.stringify(plan), 'queued', 'ai_reel', jobId, plan.versionLabel);
      projectIds.push(id);
    }
    logJob(jobId, `${versions} bản đã vào hàng render (scheduler xử lý lần lượt, ~3-8 phút/bản).`);
    return NextResponse.json({ ok: true, jobId, projectIds });
  } catch (e) {
    failJob(jobId, e);
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e).slice(0, 400) }, { status: 500 });
  }
}

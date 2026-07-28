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
import { libraryChecklist, listReelTemplates } from '@/lib/video/brand-library';

/** Mã video để nhân viên claim/feedback qua kanban: RM-<PROD>-<DDMM>-<n>.
 *  Grep mã trong video_projects.video_code là ra project + plan + render_log. */
function nextVideoCode(db: ReturnType<typeof getDb>, brandId: string, prodSlug: string): string {
  const d = new Date();
  const dm = String(d.getUTCDate()).padStart(2, '0') + String(d.getUTCMonth() + 1).padStart(2, '0');
  const prod = prodSlug.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 4) || 'PROD';
  const prefix = `RM-${prod}-${dm}`;
  const row = db.prepare('SELECT COUNT(*) c FROM video_projects WHERE brand_id=? AND video_code LIKE ?')
    .get(brandId, `${prefix}-%`) as { c: number };
  return `${prefix}-${row.c + 1}`;
}

export async function GET(req: NextRequest) {
  const brandId = getBrandId(req);
  const skuCodes = Object.keys(SKUS);
  const slugs = Object.fromEntries(skuCodes.map(k => [k, SKUS[k].productSlug]));
  const checklist = libraryChecklist(brandId, skuCodes, slugs);
  // KHÁI QUÁT: mọi sản phẩm của brand đều chạy được (profile tự đúc từ DB)
  const products = getDb().prepare(
    'SELECT id, name, slug, image_url FROM products WHERE brand_id=? ORDER BY sort_order, name LIMIT 100'
  ).all(brandId) as Array<{ id: string; name: string; slug: string; image_url: string | null }>;
  return NextResponse.json({
    checklist,
    products: products.map(p => ({ id: p.id, name: p.name, hasImage: Boolean(p.image_url) })),
    skus: skuCodes.map(k => ({ code: k, name: SKUS[k].name, moment: SKUS[k].moment })),
    templates: listReelTemplates(brandId),
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
    sku?: string; productId?: string; videoType?: string; prompt?: string; versions?: number; templateId?: string;
  };
  const templateId = String(body.templateId || '').replace(/[^a-z0-9_]/g, '').slice(0, 40) || undefined;
  const db = getDb();
  // KHÁI QUÁT: productId của brand là đường chính; sku code là legacy LoveinTea
  let productId = String(body.productId || '').trim() || undefined;
  const sku = body.sku ? String(body.sku).toUpperCase() : undefined;
  if (productId) {
    const owned = db.prepare('SELECT id, name FROM products WHERE id=? AND brand_id=?').get(productId, brandId) as { id: string; name: string } | undefined;
    if (!owned) return NextResponse.json({ error: 'Sản phẩm không thuộc brand này' }, { status: 403 });
  } else if (!sku || !SKUS[sku]) {
    return NextResponse.json({ error: 'Cần chọn sản phẩm (productId) hoặc SKU hợp lệ' }, { status: 400 });
  }
  const displayName = productId
    ? (db.prepare('SELECT name FROM products WHERE id=?').get(productId) as { name: string }).name
    : SKUS[sku!].name;
  const videoType = VIDEO_TYPE_ORDERS[String(body.videoType || '')] ? String(body.videoType) : 'iced_summer';
  const userPrompt = String(body.prompt || '').slice(0, 600);
  if (!userPrompt.trim()) return NextResponse.json({ error: 'Prompt là bắt buộc (Phiếu A).' }, { status: 400 });
  const versions = Math.min(3, Math.max(1, Number(body.versions) || 1));

  const jobId = createJob({
    brandId, kind: 'video', source: 'ReelMachine',
    title: `🧊 Reel AI ${displayName} ×${versions}`,
    meta: { sku, productId, videoType, versions },
  });

  try {
    const projectIds: string[] = [];
    const videoCodes: string[] = [];
    for (let v = 0; v < versions; v++) {
      logJob(jobId, `Dựng plan ${v + 1}/${versions} (Gemini)…`);
      const plan = await buildReelPlan({ brandId, sku, productId, videoType, userPrompt, templateId, versionIndex: v });
      const id = uuid();
      const videoCode = nextVideoCode(db, brandId, plan.profile?.productSlug || sku || 'prod');
      db.prepare(`INSERT INTO video_projects
        (id, brand_id, title, purpose, product_id, platform, aspect, target_duration_s,
         script_json, status, template, batch_id, version_label, video_code)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(id, brandId, `🧊 [${videoCode}] ${displayName} ${plan.versionLabel}`, videoType,
          productId || plan.profile?.productId || null, 'reels', '9:16', Math.round(plan.totalS),
          JSON.stringify(plan), 'queued', 'ai_reel', jobId, plan.versionLabel, videoCode);
      logJob(jobId, `Mã video: ${videoCode}`);
      projectIds.push(id);
      videoCodes.push(videoCode);
    }
    logJob(jobId, `${versions} bản đã vào hàng render (scheduler xử lý lần lượt, ~3-8 phút/bản).`);
    return NextResponse.json({ ok: true, jobId, projectIds, videoCodes });
  } catch (e) {
    failJob(jobId, e);
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e).slice(0, 400) }, { status: 500 });
  }
}

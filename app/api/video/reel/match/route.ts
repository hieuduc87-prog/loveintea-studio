export const dynamic = 'force-dynamic';
export const maxDuration = 60;
/**
 * Brief matcher — cơ chế "ném brief vào là hệ tự khớp" (mô hình amz-pipeline):
 * nhận brief tự do (hoặc dán phiếu A-E) → Gemini match với TEMPLATE REGISTRY +
 * danh sách SẢN PHẨM của brand → trả cấu hình chạy chuẩn {templateId, productId,
 * videoType, prompt} + những gì còn thiếu. Template chưa có → trả outline để đúc
 * template mới (lưu BRAND_LIBRARY/TEMPLATES/reel_<id>.json là dùng được ngay).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';
import { enforceRateLimit } from '@/lib/rate-limit';
import { generateJSON } from '@/lib/gemini';
import { listReelTemplates } from '@/lib/video/brand-library';
import { VIDEO_TYPE_ORDERS } from '@/lib/video/reel-template';

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { scope: 'ai:reel-match', limit: 10, windowMs: 60_000 });
  if (limited) return limited;
  const brandId = getBrandId(req);
  const body = await req.json().catch(() => ({})) as { brief?: string };
  const brief = String(body.brief || '').slice(0, 4000);
  if (!brief.trim()) return NextResponse.json({ error: 'Thiếu brief' }, { status: 400 });

  const templates = listReelTemplates(brandId);
  const products = getDb().prepare(
    'SELECT id, name, slug, description FROM products WHERE brand_id=? ORDER BY sort_order, name LIMIT 100'
  ).all(brandId) as Array<{ id: string; name: string; slug: string; description?: string }>;

  try {
    const r = await generateJSON<{
      match: { templateId: string | null; productId: string | null; videoType: string; prompt: string; versions: number };
      confidence: number; reason: string; missing: string[];
      newTemplateOutline?: { id: string; name: string; description: string; blocks: Array<{ id: string; durS: number; concept: string }> } | null;
    }>(
      `You are the intake matcher of an automated video production line. Match this BRIEF to the available TEMPLATES and PRODUCTS.
BRIEF (Vietnamese possible): """${brief}"""
TEMPLATES: ${JSON.stringify(templates)}
PRODUCTS of this brand: ${JSON.stringify(products.map(p => ({ id: p.id, name: p.name, desc: String(p.description || '').slice(0, 100) })))}
VIDEO TYPES: ${JSON.stringify(Object.keys(VIDEO_TYPE_ORDERS))}
Return ONLY JSON:
{"match":{"templateId":"<best template id or null if NONE fits>","productId":"<best product id or null>","videoType":"<one of video types>","prompt":"<clean 1-2 sentence creative prompt in Vietnamese distilled from the brief>","versions":<1-3>},
 "confidence":<0-1>,
 "reason":"1 câu tiếng Việt vì sao match",
 "missing":["các thứ brief thiếu mà người ra đề cần bổ sung (tiếng Việt), [] nếu đủ"],
 "newTemplateOutline": <null nếu template có sẵn đủ dùng; nếu brief cần format video KHÁC HẲN (vd how-to steps, talking head, comparison), đề xuất khung template mới: {"id":"snake_case_v01","name":"...","description":"...","blocks":[{"id":"BLOCK_ID","durS":<num>,"concept":"..."}]}>}`
    );
    return NextResponse.json({ ok: true, ...r, templates, products: products.map(p => ({ id: p.id, name: p.name })) });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e).slice(0, 300) }, { status: 500 });
  }
}

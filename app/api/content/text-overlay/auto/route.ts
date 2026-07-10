export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateJSON, analyzeImage } from '@/lib/gemini';
import { getBrandId } from '@/lib/brand-guard';
import { resolveLangName } from '@/lib/brand-lang';
import { OverlayLayout } from '@/lib/text-overlay';
import { renderOverlayToUrl, imageRefToBuffer } from '@/lib/text-overlay-render';

/**
 * TỰ ĐỘNG chèn chữ lên ảnh — 1 lần, không cần duyệt.
 * Đọc ẢNH MẪU (reference) bằng vision → hiểu bố cục + kiểu chữ mẫu dùng →
 * sinh chữ CỦA BRAND theo đúng bố cục đó (thay nội dung, giữ phong cách) → render.
 * body: { baseImageUrl, productId?, referenceId?, layout?, brandName? }
 * - Nếu không truyền referenceId: tự chọn 1 ảnh mẫu của brand cho layout (nếu có).
 * - Nếu brand chưa có ảnh mẫu nào: fallback sinh chữ thuần từ Brand DNA.
 */
const LAYOUTS: OverlayLayout[] = ['bottom-headline', 'top-banner', 'center-quote', 'benefit-list', 'promo-badge'];

export async function POST(req: NextRequest) {
  try {
    const brandId = getBrandId(req) || 'loveintea';
    const body = await req.json() as { baseImageUrl?: string; productId?: string; referenceId?: string; layout?: string; brandName?: string };
    if (!body.baseImageUrl) return NextResponse.json({ error: 'Thiếu ảnh nền' }, { status: 400 });
    const db = getDb();

    const dna = db.prepare('SELECT * FROM brand_dna WHERE brand_id=?').get(brandId) as Record<string, string> | undefined;
    const product = body.productId
      ? db.prepare('SELECT name, pitch, theme, ingredients, best_moment FROM products WHERE id=? OR (brand_id=? AND slug=?)').get(body.productId, brandId, body.productId) as Record<string, string> | undefined
      : undefined;

    // Chọn ảnh mẫu: theo referenceId, hoặc tự lấy 1 ảnh mẫu của brand (ưu tiên layout đã chọn).
    const layoutHint = body.layout && LAYOUTS.includes(body.layout as OverlayLayout) ? body.layout : undefined;
    const ref = (body.referenceId
      ? db.prepare('SELECT * FROM overlay_references WHERE id=? AND brand_id=?').get(body.referenceId, brandId)
      : db.prepare(`SELECT * FROM overlay_references WHERE brand_id=? ${layoutHint ? 'AND layout=?' : ''} ORDER BY created_at DESC LIMIT 1`)
          .get(...(layoutHint ? [brandId, layoutHint] : [brandId]))
    ) as { id: string; layout: string; image_url: string } | undefined;

    const langName = resolveLangName(undefined, brandId);
    const brandBlock = `BRAND: ${brandId}
- Tagline: ${dna?.tagline ?? ''} | Voice: ${dna?.voice_traits ?? '[]'}
- Khách hàng: ${dna?.target_audience ?? ''} | Insight: ${dna?.insight ?? ''}
- COMPLIANCE (tuyệt đối tuân thủ, KHÔNG nói điều cấm): ${dna?.compliance_json ?? '{}'}
${product ? `SẢN PHẨM: ${product.name} — ${product.pitch ?? ''} (${product.theme ?? ''}; thành phần: ${product.ingredients ?? ''})` : 'Brand-level (không gắn sản phẩm cụ thể)'}`;

    const rules = `- Viết TOÀN BỘ chữ bằng ${langName}. Ngắn, mạnh, dừng-cuộn được.
- layout ∈ [${LAYOUTS.join(', ')}] (bottom-headline=tiêu đề đáy; top-banner=banner đỉnh; center-quote=trích dẫn giữa; benefit-list=liệt kê lợi ích; promo-badge=khuyến mãi).
- headline: ≤7 từ, hook mạnh. sub: 1 câu (benefit-list=2-3 lợi ích ngăn bằng dấu |). cta: động từ cụ thể. badge: chỉ khi promo, không thì rỗng.
Trả ONLY JSON: {"layout":"...","headline":"...","sub":"...","cta":"...","badge":""}`;

    let plan: { layout?: string; headline?: string; sub?: string; cta?: string; badge?: string };
    let usedReference = false;

    if (ref) {
      // VISION: đọc ảnh mẫu → nhại bố cục/kiểu chữ, thay bằng nội dung brand.
      try {
        const { buffer, mimeType } = imageRefToBuffer(ref.image_url);
        const visionPrompt = `Bạn là art director. Đây là 1 ẢNH MẪU (reference) có chữ của 1 post đẹp.
Nhiệm vụ: (1) đọc BỐ CỤC chữ trong ảnh mẫu (chữ nằm đâu: đáy/đỉnh/giữa; có mấy dòng; có CTA/badge không; tông chữ to-nhỏ), (2) sinh chữ MỚI cho THƯƠNG HIỆU của tôi theo ĐÚNG bố cục & phong cách đó nhưng thay bằng nội dung của tôi (KHÔNG chép chữ trong ảnh mẫu).
Chọn layout gần nhất với ảnh mẫu.
${brandBlock}
YÊU CẦU:
${rules}`;
        const raw = await analyzeImage(buffer, mimeType, visionPrompt);
        const m = raw.match(/\{[\s\S]*\}/);
        plan = m ? JSON.parse(m[0]) : {};
        usedReference = true;
      } catch {
        plan = await generateJSON(`Bạn là art director. Đề xuất chữ phủ lên ảnh quảng cáo, đúng chất brand.\n${brandBlock}\nYÊU CẦU:\n${rules}`);
      }
    } else {
      // Không có ảnh mẫu → sinh chữ thuần từ Brand DNA.
      plan = await generateJSON(`Bạn là art director. Đề xuất chữ phủ lên ảnh quảng cáo, đúng chất brand.\n${brandBlock}\nYÊU CẦU:\n${rules}`);
    }

    const layout = (LAYOUTS.includes(plan.layout as OverlayLayout) ? plan.layout : (layoutHint || 'bottom-headline')) as OverlayLayout;
    const url = await renderOverlayToUrl({
      baseImageUrl: body.baseImageUrl, layout,
      fields: {
        headline: String(plan.headline ?? '').trim(),
        sub: String(plan.sub ?? '').trim(),
        cta: String(plan.cta ?? '').trim(),
        badge: String(plan.badge ?? '').trim(),
      },
      brandId, brandName: body.brandName,
    });

    return NextResponse.json({
      ok: true, url, layout, usedReference,
      headline: String(plan.headline ?? '').trim(), sub: String(plan.sub ?? '').trim(),
      cta: String(plan.cta ?? '').trim(), badge: String(plan.badge ?? '').trim(),
    });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[text-overlay/auto]', e), (e as Error).message || 'Lỗi tự động chèn chữ') }, { status: 500 });
  }
}

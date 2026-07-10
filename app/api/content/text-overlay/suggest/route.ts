export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateJSON } from '@/lib/gemini';
import { getBrandId } from '@/lib/brand-guard';
import { resolveLangName } from '@/lib/brand-lang';

/**
 * POST /api/content/text-overlay/suggest
 * AI đề xuất PHƯƠNG ÁN CHỮ (layout + headline/sub/cta/badge) phù hợp để phủ lên ảnh,
 * đúng chất brand (DNA + ngôn ngữ + compliance) và — nếu chọn template — bám kiểu
 * chữ mà template đó dùng (typography / text_on_image từ phân tích template).
 * body: { productId?, templateId?, topic?, layout? }
 */
const LAYOUTS = ['bottom-headline', 'top-banner', 'center-quote', 'benefit-list', 'promo-badge'];

export async function POST(req: NextRequest) {
  try {
    const brandId = getBrandId(req) || 'loveintea';
    const body = await req.json() as { productId?: string; templateId?: string; topic?: string; layout?: string };
    const db = getDb();
    const dna = db.prepare('SELECT * FROM brand_dna WHERE brand_id=?').get(brandId) as Record<string, string> | undefined;
    const product = body.productId
      ? db.prepare('SELECT name, pitch, theme, ingredients, best_moment FROM products WHERE id=? OR (brand_id=? AND slug=?)').get(body.productId, brandId, body.productId) as Record<string, string> | undefined
      : undefined;

    // Phân tích chữ của template đã chọn (nếu có) — để bám ĐÚNG kiểu text template dùng.
    let tplText = '';
    if (body.templateId) {
      const tpl = db.prepare('SELECT analysis FROM content_templates WHERE id=?').get(body.templateId) as { analysis?: string } | undefined;
      try {
        const a = JSON.parse(tpl?.analysis || '{}') as { typography?: Record<string, unknown>; text_on_image?: string; slides?: Array<{ text_on_image?: string }> };
        const bits = [
          a.typography ? `Kiểu chữ template: ${JSON.stringify(a.typography)}` : '',
          a.text_on_image ? `Chữ trên ảnh mẫu: "${a.text_on_image}"` : '',
          Array.isArray(a.slides) ? a.slides.map(s => s.text_on_image).filter(Boolean).slice(0, 4).map(t => `- "${t}"`).join('\n') : '',
        ].filter(Boolean);
        if (bits.length) tplText = `\nTEMPLATE ĐÃ CHỌN (bám kiểu & vị trí chữ này):\n${bits.join('\n')}`;
      } catch { /* template chưa phân tích */ }
    }

    const langName = resolveLangName(undefined, brandId);
    const prompt = `Bạn là art director. Đề xuất PHƯƠNG ÁN CHỮ để PHỦ LÊN ẢNH quảng cáo (không viết caption dài), đúng chất thương hiệu.

BRAND: ${brandId}
- Tagline: ${dna?.tagline ?? ''} | Voice: ${dna?.voice_traits ?? '[]'}
- Khách hàng: ${dna?.target_audience ?? ''} | Insight: ${dna?.insight ?? ''}
- COMPLIANCE (tuyệt đối tuân thủ, KHÔNG nói điều cấm): ${dna?.compliance_json ?? '{}'}
${product ? `SẢN PHẨM: ${product.name} — ${product.pitch ?? ''} (${product.theme ?? ''}; thành phần: ${product.ingredients ?? ''})` : 'Brand-level (không gắn sản phẩm cụ thể)'}
${body.topic ? `Ý CHÍNH: ${body.topic}` : ''}${tplText}

YÊU CẦU:
- Viết TOÀN BỘ chữ bằng ${langName}. Ngắn, mạnh, dừng-cuộn được.
- Chọn 1 layout phù hợp trong: ${LAYOUTS.join(', ')} (bottom-headline=tiêu đề đáy; top-banner=banner đỉnh; center-quote=trích dẫn giữa; benefit-list=liệt kê lợi ích; promo-badge=khuyến mãi).
- headline: cực ngắn (≤7 từ), hook mạnh. sub: 1 câu bổ trợ (có thể rỗng). cta: động từ + cụ thể (vd "Mua ngay"). badge: chỉ khi promo (vd "MỚI","-20%"), không thì rỗng.
- Nếu layout=benefit-list: sub là 2-3 lợi ích ngăn nhau bằng dấu | .

Trả ONLY JSON: {"layout":"...","headline":"...","sub":"...","cta":"...","badge":""}`;

    const o = await generateJSON<{ layout?: string; headline?: string; sub?: string; cta?: string; badge?: string }>(prompt);
    const layout = LAYOUTS.includes(String(o.layout)) ? String(o.layout) : (body.layout && LAYOUTS.includes(body.layout) ? body.layout : 'bottom-headline');
    return NextResponse.json({
      ok: true,
      layout,
      headline: String(o.headline ?? '').trim(),
      sub: String(o.sub ?? '').trim(),
      cta: String(o.cta ?? '').trim(),
      badge: String(o.badge ?? '').trim(),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Lỗi gợi ý' }, { status: 500 });
  }
}

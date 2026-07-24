export const dynamic = 'force-dynamic';
export const maxDuration = 300;
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateJSON } from '@/lib/gemini';
import { getBrandId } from '@/lib/brand-guard';
import { resolveLangName } from '@/lib/brand-lang';
import { renderOverlayToUrl } from '@/lib/text-overlay-render';
import { OverlayLayout } from '@/lib/text-overlay';
import { enforceRateLimit } from '@/lib/rate-limit';

/**
 * POST /api/content/text-overlay/carousel (card 80981061)
 * Chữ lên ảnh cho CAROUSEL 2-5 ảnh: AI viết bộ chữ NỐI TIẾP nhau (ảnh 1 = title/hook,
 * ảnh 2..n mỗi ảnh 1 ý theo mạch), rồi render từng ảnh với cùng 1 layout.
 * body: { imageUrls: string[], topic?, productId?, layout?, brandName? }
 */
const LAYOUTS = ['bottom-headline', 'top-banner', 'center-quote', 'benefit-list', 'promo-badge'];

export async function POST(req: NextRequest) {
  try {
    const limited = enforceRateLimit(req, { scope: 'ai:overlay-carousel', limit: 6, windowMs: 60_000 });
    if (limited) return limited;
    const brandId = getBrandId(req) || 'loveintea';
    const body = await req.json() as { imageUrls?: string[]; topic?: string; productId?: string; layout?: string; brandName?: string };
    const imageUrls = (body.imageUrls || []).filter(u => typeof u === 'string' && u.trim()).slice(0, 5);
    if (imageUrls.length < 2) return NextResponse.json({ error: 'Chọn ít nhất 2 ảnh (tối đa 5) cho carousel' }, { status: 400 });

    const db = getDb();
    const dna = db.prepare('SELECT * FROM brand_dna WHERE brand_id=?').get(brandId) as Record<string, string> | undefined;
    const product = body.productId
      ? db.prepare('SELECT name, pitch, theme, ingredients, best_moment, use_cases FROM products WHERE id=? OR (brand_id=? AND slug=?)').get(body.productId, brandId, body.productId) as Record<string, string> | undefined
      : undefined;
    const langName = resolveLangName(undefined, brandId);
    const n = imageUrls.length;

    // Layout do NGƯỜI DÙNG chọn quyết định (card cafd98b7) — KHÔNG để AI đổi.
    const layout = (body.layout && LAYOUTS.includes(body.layout) ? body.layout : 'bottom-headline') as OverlayLayout;
    const LAYOUT_DESC: Record<string, string> = {
      'bottom-headline': 'tiêu đề lớn ở đáy + phụ đề',
      'top-banner': 'banner màu ở đỉnh, headline + phụ đề, có thể có CTA',
      'center-quote': 'TRÍCH DẪN căn giữa như 1 câu quote — headline là câu quote ngắn, sub là nguồn/tên người nói (có thể rỗng), KHÔNG cta/badge',
      'benefit-list': 'liệt kê lợi ích — headline là tiêu đề, sub là 2-3 lợi ích NGĂN BẰNG DẤU | , có thể có cta',
      'promo-badge': 'khuyến mãi — headline + sub + cta + badge tròn (vd "MỚI","-20%")',
    };

    const prompt = `Bạn là art director. Viết BỘ CHỮ NỐI TIẾP cho carousel ${n} ảnh (chữ sẽ được PHỦ LÊN từng ảnh — không phải caption dài). Nội dung ${n} slide phải là MỘT MẠCH liền: slide 1 = tiêu đề/hook của cả carousel, các slide sau mỗi slide 1 ý triển khai (vd công dụng 1, công dụng 2, ...), slide cuối có thể chốt CTA.

BRAND: ${brandId}
- Tagline: ${dna?.tagline ?? ''} | Voice: ${dna?.voice_traits ?? '[]'}
- Khách hàng: ${dna?.target_audience ?? ''} | Insight: ${dna?.insight ?? ''}
- COMPLIANCE (tuyệt đối tuân thủ, KHÔNG nói điều cấm; công dụng phải diễn đạt kiểu "theo truyền thống dùng để hỗ trợ..." nếu compliance yêu cầu): ${dna?.compliance_json ?? '{}'}
${product ? `SẢN PHẨM (BÁM SÁT — viết ĐÚNG về sản phẩm này, KHÔNG chung chung):
- Tên: ${product.name}
- Pitch: ${product.pitch ?? ''}
- Chủ đề/công dụng chính: ${product.theme ?? ''}
- Thành phần: ${product.ingredients ?? ''}
- Thời điểm dùng: ${product.best_moment ?? ''}
- Trường hợp dùng / lợi ích: ${product.use_cases ?? ''}` : 'Brand-level (không gắn sản phẩm cụ thể)'}
${body.topic ? `CHỦ ĐỀ / Ý CHÍNH NGƯỜI DÙNG YÊU CẦU (BÁM SÁT chủ đề này): ${body.topic}` : ''}

YÊU CẦU:
- Viết TOÀN BỘ chữ bằng ${langName}. Ngắn, mạnh, đọc nhanh khi lướt.
${product || body.topic ? '- Nội dung PHẢI liên quan trực tiếp tới sản phẩm/chủ đề nêu trên (đúng thành phần, công dụng, cách dùng thật) — TUYỆT ĐỐI không viết chung chung lạc đề.' : ''}
- Kiểu layout CỐ ĐỊNH cho cả ${n} slide: "${layout}" (${LAYOUT_DESC[layout]}). Viết chữ ĐÚNG kiểu layout này.
- Mỗi slide: headline ≤7 từ; sub 1 câu ngắn (với benefit-list: 2-3 lợi ích ngăn bằng |); cta chỉ ở slide cuối (rỗng ở slide khác) trừ layout center-quote thì bỏ cta; badge chỉ khi layout promo-badge.
- Đánh số mạch nội dung tự nhiên (không ghi "slide 1/5" vào chữ).

Trả ONLY JSON: {"slides":[{"headline":"...","sub":"...","cta":"","badge":""}, ... đúng ${n} phần tử]}`;

    const o = await generateJSON<{ slides?: Array<{ headline?: string; sub?: string; cta?: string; badge?: string }> }>(prompt);
    const slides = Array.from({ length: n }, (_, i) => {
      const s = o.slides?.[i] ?? {};
      return {
        headline: String(s.headline ?? '').trim(),
        sub: String(s.sub ?? '').trim(),
        cta: String(s.cta ?? '').trim(),
        badge: String(s.badge ?? '').trim(),
      };
    });
    if (!slides[0].headline) return NextResponse.json({ error: 'AI không sinh được bộ chữ — thử lại' }, { status: 500 });

    // Render tuần tự (mỗi render là 1 phiên Puppeteer — tránh dồn RAM container)
    const urls: string[] = [];
    for (let i = 0; i < n; i++) {
      const url = await renderOverlayToUrl({
        baseImageUrl: imageUrls[i], layout, fields: slides[i], brandId, brandName: body.brandName,
      });
      urls.push(url);
    }
    return NextResponse.json({ ok: true, layout, urls, slides });
  } catch (e) {
    console.error('[overlay-carousel]', e);
    return NextResponse.json({ error: (e as Error).message || 'Lỗi tạo carousel' }, { status: 500 });
  }
}

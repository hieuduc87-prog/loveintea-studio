export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { generateJSON } from '@/lib/gemini';
import { isAllBrands } from '@/lib/brand-guard';

/**
 * POST /api/knowledge/classify { type, title, content }
 * AI gợi ý tri thức này là "platform" (nguyên tắc workflow chung — áp mọi brand)
 * hay "brand" (DNA/đặc thù riêng của 1 thương hiệu). Người dùng duyệt bằng toggle.
 */
export async function POST(req: NextRequest) {
  try {
    const { type, title, content } = await req.json() as { type?: string; title?: string; content?: string };
    const text = `${title ?? ''}\n${content ?? ''}`.trim();
    if (!text) return NextResponse.json({ scope: 'brand', reason: '' });

    const prompt = `Phân loại mẩu tri thức marketing sau là PLATFORM hay BRAND.
- PLATFORM = nguyên tắc / quy trình / bài học CHUNG, đúng cho MỌI thương hiệu (vd: "hook 3 giây đầu quyết định", "đăng 20-22h engagement cao", "caption đừng quá 2 câu trước CTA").
- BRAND = đặc thù RIÊNG của 1 thương hiệu (vd: "brand X không nói giảm cân", "giọng của X mộc mạc", "sản phẩm X thành phần Y").

TRI THỨC (loại: ${type ?? ''}):
"""${text.slice(0, 2000)}"""

Trả ONLY JSON: {"scope":"platform"|"brand","reason":"1 câu ngắn giải thích tiếng Việt"}`;

    const o = await generateJSON<{ scope?: string; reason?: string }>(prompt);
    const scope = o.scope === 'platform' ? 'platform' : 'brand';
    return NextResponse.json({
      scope,
      reason: String(o.reason ?? '').trim(),
      canPromote: isAllBrands(req),   // chỉ admin mới lưu được platform
    });
  } catch {
    return NextResponse.json({ scope: 'brand', reason: '', canPromote: false });
  }
}

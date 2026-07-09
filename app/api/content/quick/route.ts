export const dynamic = 'force-dynamic';
/**
 * POST /api/content/quick — manual content with only 2-4 fields; everything else
 * (voice, audience, compliance, USP angle) is auto-detected from Brand DNA +
 * product + active rules + expert knowledge.
 * body: { brandId, productId?, message, tone?, platform?, n? }
 * Returns n variants: [{ caption, hashtags, image_prompt, targeting }]
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateJSON } from '@/lib/gemini';
import { getExpertKnowledgeBlock } from '@/lib/brand-knowledge';
import { createJob, finishJob, failJob } from '@/lib/jobs';
import { getBrandId } from '@/lib/brand-guard';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { scope: 'ai:text', limit: 30, windowMs: 60_000 });
  if (limited) return limited;
  let jobId = '';
  try {
    const body = await req.json() as { brandId?: string; productId?: string; message?: string; tone?: string; segment?: string; platform?: string; n?: number; templateId?: string; language?: string; length?: string };
    const brandId = getBrandId(req) || body.brandId || '';
    const message = (body.message || '').trim();
    if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 });
    const n = Math.min(5, Math.max(1, body.n || 1));
    // Brand bán US → mặc định caption Tiếng Anh. Đổi 'vi' nếu cần.
    const langName = (body.language ?? 'en').toLowerCase().startsWith('vi') ? 'Vietnamese' : 'English';
    const isLong = (body.length ?? 'short').toLowerCase().startsWith('l');
    const lengthRule = isLong
      ? 'Length: LONG-FORM — 3-5 short paragraphs, storytelling, build desire then CTA.'
      : 'Length: SHORT — 1-2 punchy paragraphs, scannable, fast to the CTA.';

    const db = getDb();
    const dna = db.prepare('SELECT * FROM brand_dna WHERE brand_id=?').get(brandId) as Record<string, string> | undefined;
    const product = body.productId
      ? db.prepare('SELECT * FROM products WHERE id=? OR (brand_id=? AND slug=?)').get(body.productId, brandId, body.productId) as Record<string, string> | undefined
      : undefined;
    const rules = (db.prepare(`SELECT rule_text FROM content_rules WHERE brand_id=? AND status='active' ORDER BY created_at DESC LIMIT 15`).all(brandId) as Array<{ rule_text: string }>).map(r => r.rule_text);

    // Picked template → follow its analysed structure/skeleton for THIS product
    let templateBlock = '';
    if (body.templateId) {
      const tpl = db.prepare('SELECT analysis FROM content_templates WHERE id=?').get(body.templateId) as { analysis: string } | undefined;
      try {
        const a = JSON.parse(tpl?.analysis || '{}') as { structure?: string; skeleton?: string; style_keywords?: string[]; layout?: { description?: string } };
        const bits = [a.structure && `Cấu trúc: ${a.structure}`, a.skeleton && `Khung sườn: ${a.skeleton}`, a.layout?.description && `Layout: ${a.layout.description}`, a.style_keywords?.length && `Style: ${a.style_keywords.join(', ')}`].filter(Boolean);
        if (bits.length) templateBlock = `\nTEMPLATE ĐÃ CHỌN — dựng bài theo cấu trúc/khung sườn này nhưng cho ĐÚNG sản phẩm trên:\n${bits.join('\n')}`;
      } catch { /* template chưa phân tích */ }
    }

    const prompt = `Bạn viết bài social cho brand "${brandId}". Người dùng chỉ đưa Ý CHÍNH — bạn TỰ suy ra giọng, đối tượng, USP, compliance từ Brand DNA. Tạo ${n} biến thể.

Ý CHÍNH NGƯỜI DÙNG: "${message}"
${body.tone ? `Tông yêu cầu: ${body.tone}` : ''}
${body.segment ? `Đối tượng MỤC TIÊU (viết hướng tới nhóm này): ${body.segment}` : ''}
Nền tảng: ${body.platform || 'facebook,instagram'}
${product ? `Sản phẩm: ${product.name} — ${product.pitch ?? ''} (${product.theme ?? ''}, thành phần: ${product.ingredients ?? ''})` : 'Brand-level (không gắn sản phẩm)'}

BRAND DNA (auto-detect, tuân thủ):
- Tagline: ${dna?.tagline ?? ''} | Archetype: ${dna?.archetype ?? ''} | Voice: ${dna?.voice_traits ?? '[]'}
- Khách hàng: ${dna?.target_audience ?? ''} | Insight: ${dna?.insight ?? ''} | Hành vi: ${dna?.behavior ?? ''}
- COMPLIANCE: ${dna?.compliance_json ?? '{}'}
${dna?.brand_rules ? `- RULE BRAND: ${dna.brand_rules}` : ''}
${rules.length ? `ACTIVE RULES:\n${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}` : ''}
${getExpertKnowledgeBlock(brandId)}
${templateBlock}

OUTPUT REQUIREMENTS:
- Write the caption AND hashtags in ${langName}. Do NOT mix languages. (Brand bán thị trường US → mặc định English.)
- Start every caption with a STRONG scroll-stopping hook (first line): a bold claim, a pain point, a question, or a surprising fact. The hook must earn the next line.
- ${lengthRule}
- Hashtags: 5-10 relevant ${langName} hashtags.

Trả ONLY JSON: {"variants":[{"caption":"...","hashtags":"#a #b","image_prompt":"50-90 words English, vertical, no text in image","targeting":{"segment":"...","insight":"...","behavior":"..."}}]}`;

    jobId = createJob({ brandId, kind: 'content', source: 'CreateLab', title: `Tạo content (${n} biến thể): ${message.slice(0, 50)}`, meta: { productId: body.productId, language: langName, n } });
    const out = await generateJSON<{ variants: Array<{ caption: string; hashtags: string; image_prompt: string; targeting?: Record<string, string> }> }>(prompt);
    const variants = (out.variants ?? []).slice(0, n);
    finishJob(jobId, { count: variants.length });
    return NextResponse.json({ ok: true, variants });
  } catch (e) {
    failJob(jobId, e);
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

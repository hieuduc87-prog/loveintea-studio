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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { brandId?: string; productId?: string; message?: string; tone?: string; platform?: string; n?: number };
    const brandId = body.brandId || 'loveintea';
    const message = (body.message || '').trim();
    if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 });
    const n = Math.min(5, Math.max(1, body.n || 1));

    const db = getDb();
    const dna = db.prepare('SELECT * FROM brand_dna WHERE brand_id=?').get(brandId) as Record<string, string> | undefined;
    const product = body.productId
      ? db.prepare('SELECT * FROM products WHERE id=? OR (brand_id=? AND slug=?)').get(body.productId, brandId, body.productId) as Record<string, string> | undefined
      : undefined;
    const rules = (db.prepare(`SELECT rule_text FROM content_rules WHERE brand_id=? AND status='active' ORDER BY created_at DESC LIMIT 15`).all(brandId) as Array<{ rule_text: string }>).map(r => r.rule_text);

    const prompt = `Bạn viết bài social cho brand "${brandId}". Người dùng chỉ đưa Ý CHÍNH — bạn TỰ suy ra giọng, đối tượng, USP, compliance từ Brand DNA. Tạo ${n} biến thể.

Ý CHÍNH NGƯỜI DÙNG: "${message}"
${body.tone ? `Tông yêu cầu: ${body.tone}` : ''}
Nền tảng: ${body.platform || 'facebook,instagram'}
${product ? `Sản phẩm: ${product.name} — ${product.pitch ?? ''} (${product.theme ?? ''}, thành phần: ${product.ingredients ?? ''})` : 'Brand-level (không gắn sản phẩm)'}

BRAND DNA (auto-detect, tuân thủ):
- Tagline: ${dna?.tagline ?? ''} | Archetype: ${dna?.archetype ?? ''} | Voice: ${dna?.voice_traits ?? '[]'}
- Khách hàng: ${dna?.target_audience ?? ''} | Insight: ${dna?.insight ?? ''} | Hành vi: ${dna?.behavior ?? ''}
- COMPLIANCE: ${dna?.compliance_json ?? '{}'}
${dna?.brand_rules ? `- RULE BRAND: ${dna.brand_rules}` : ''}
${rules.length ? `ACTIVE RULES:\n${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}` : ''}
${getExpertKnowledgeBlock(brandId)}

Trả ONLY JSON: {"variants":[{"caption":"...","hashtags":"#a #b","image_prompt":"50-90 từ English, vertical, no text in image","targeting":{"segment":"...","insight":"...","behavior":"..."}}]}`;

    const out = await generateJSON<{ variants: Array<{ caption: string; hashtags: string; image_prompt: string; targeting?: Record<string, string> }> }>(prompt);
    return NextResponse.json({ ok: true, variants: (out.variants ?? []).slice(0, n) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

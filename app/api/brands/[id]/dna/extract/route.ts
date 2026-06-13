export const dynamic = 'force-dynamic';
export const maxDuration = 120;
/**
 * POST /api/brands/[id]/dna/extract
 * Synthesises the Brand DNA strategy fields (target_audience / insight /
 * behavior / brand_rules) from data ALREADY in the system — the uploaded
 * knowledge_docs (playbook, communication direction, guidelines) plus the
 * hardcoded audience SEGMENTS — so the user never retypes what they imported.
 *
 * body (optional): { text } to also fold in pasted/extra text.
 * Returns the synthesised fields (NOT saved — UI reviews then PATCHes).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateJSON } from '@/lib/gemini';
import { SEGMENTS } from '@/lib/brand-dna';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: brandId } = await params;
  try {
    const db = getDb();
    const body = await req.json().catch(() => ({})) as { text?: string };

    // 1. Pull existing uploaded knowledge (the docs the user already imported)
    const docs = db.prepare(
      `SELECT title, type, content FROM knowledge_docs WHERE brand_id=?
       AND type IN ('playbook','communication_direction','guideline','social_strategy','research')
       ORDER BY length(content) DESC LIMIT 6`
    ).all(brandId) as Array<{ title: string; type: string; content: string }>;

    // 2. Audience segments — DB table first, else the seeded SEGMENTS for loveintea
    const dbAud = db.prepare('SELECT code, name, age_range, tension FROM audiences WHERE brand_id=?').all(brandId) as Array<{ code: string; name: string; age_range: string; tension: string }>;
    const segments = dbAud.length ? dbAud
      : (brandId === 'loveintea' ? SEGMENTS.map(s => ({ code: s.id, name: s.name, age_range: s.age, tension: s.tension })) : []);

    const dna = db.prepare('SELECT tagline, archetype, voice_traits, compliance_json FROM brand_dna WHERE brand_id=?').get(brandId) as Record<string, string> | undefined;

    if (!docs.length && !segments.length && !body.text) {
      return NextResponse.json({ error: 'Chưa có tài liệu nào trong hệ thống để tổng hợp. Hãy upload tài liệu brand trước (Knowledge Hub).' }, { status: 400 });
    }

    const docsBlock = docs.map(d => `### ${d.title} (${d.type})\n${(d.content || '').slice(0, 7000)}`).join('\n\n').slice(0, 38000);

    const prompt = `You are a brand strategist. From the brand's OWN already-uploaded documents and audience segments below, SYNTHESISE four strategy fields in Vietnamese. Use only what's supported by the source — do not invent. Be concrete and concise.

BRAND: ${brandId}
TAGLINE: ${dna?.tagline ?? ''} | ARCHETYPE: ${dna?.archetype ?? ''}
VOICE: ${dna?.voice_traits ?? '[]'}
COMPLIANCE: ${dna?.compliance_json ?? '{}'}

AUDIENCE SEGMENTS (đã định nghĩa sẵn):
${JSON.stringify(segments, null, 1)}

UPLOADED STRATEGY DOCS:
"""
${docsBlock}
"""
${body.text ? `\nEXTRA NOTES:\n"""${body.text.slice(0, 8000)}"""` : ''}

Return ONLY JSON:
{
 "target_audience": "Mô tả khách hàng mục tiêu: gộp các segment (tuổi, nhu cầu, ai nên dùng) thành 1 đoạn rõ ràng",
 "insight": "Insight cốt lõi — sự thật ngầm hiểu / nỗi đau / mong muốn sâu, rút từ tension của các segment + docs",
 "behavior": "Hành vi: thói quen lướt mạng, giờ vàng, cách tương tác/mua hàng, kênh — từ docs nếu có, suy luận hợp lý từ chân dung nếu không",
 "brand_rules": "Các rule riêng bắt buộc khi làm content cho brand này — rút từ playbook/communication direction/compliance (giọng văn, điều nên/không nên, cấu trúc bài)"
}`;

    const out = await generateJSON<Record<string, string>>(prompt);
    const fields = {
      target_audience: String(out.target_audience ?? '').trim(),
      insight: String(out.insight ?? '').trim(),
      behavior: String(out.behavior ?? '').trim(),
      brand_rules: String(out.brand_rules ?? '').trim(),
    };
    return NextResponse.json({ ok: true, fields, sources: docs.map(d => d.title), segmentCount: segments.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

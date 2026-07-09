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
import { fileToText } from '@/lib/product-knowledge';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: brandId } = await params;
  try {
    const db = getDb();
    // Customer file upload → extract DNA strategy fields directly from it
    if ((req.headers.get('content-type') || '').includes('multipart/form-data')) {
      const fd = await req.formData();
      // Nhận NHIỀU file (kéo-thả cả folder) — 'files' mảng + backward-compat 'file' đơn.
      const files = [...fd.getAll('files'), fd.get('file')].filter((f): f is File => f instanceof File && f.size > 0);
      if (!files.length) return NextResponse.json({ error: 'Chưa có file nào' }, { status: 400 });
      const parts: string[] = []; const names: string[] = [];
      for (const f of files) {
        try {
          const t = fileToText(Buffer.from(await f.arrayBuffer()), f.name);
          if (t.trim()) { parts.push(`### ${f.name}\n${t.slice(0, 12000)}`); names.push(f.name); }
        } catch { /* bỏ qua file không đọc được */ }
      }
      const text = parts.join('\n\n').slice(0, 42000);
      if (!text.trim()) return NextResponse.json({ error: 'Không đọc được nội dung file nào (hỗ trợ .xlsx/.docx/.txt/.csv/.md/.json)' }, { status: 400 });

      // Trích XUẤT FULL DNA trong 1 lần (không chỉ 4 trường chiến lược).
      const fullPrompt = `Bạn là brand strategist. Từ (các) tài liệu thương hiệu khách gửi dưới đây, trích xuất bộ Brand DNA đầy đủ bằng tiếng Việt. CHỈ dùng thông tin CÓ trong tài liệu; thiếu thì để "" hoặc []. Không bịa.

TÀI LIỆU:
"""${text}"""

Trả ONLY JSON:
{
 "tagline": "khẩu hiệu ngắn (nếu có)",
 "archetype": "hình mẫu thương hiệu (vd: The Caregiver, The Sage)",
 "through_line": "1 câu định vị xuyên suốt",
 "voice_traits": ["3-5 nét tính cách giọng nói, mỗi cái 1 cụm ngắn"],
 "hashtags": ["#hashtag brand nếu có"],
 "compliance": {"neverSay": ["điều KHÔNG được nói"], "alwaysSay": ["điều NÊN nói"]},
 "target_audience": "khách hàng mục tiêu (tuổi, nhu cầu, ai nên dùng)",
 "insight": "insight cốt lõi / nỗi đau / mong muốn sâu",
 "behavior": "hành vi: giờ lướt mạng, kênh, cách mua",
 "brand_rules": "luật riêng khi làm content (giọng, nên/không nên, cấu trúc bài)"
}`;
      const o = await generateJSON<Record<string, unknown>>(fullPrompt);
      const arr = (v: unknown) => JSON.stringify(Array.isArray(v) ? v.filter(x => typeof x === 'string') : []);
      const fields: Record<string, string> = {
        tagline: String(o.tagline ?? '').trim(),
        archetype: String(o.archetype ?? '').trim(),
        through_line: String(o.through_line ?? '').trim(),
        voice_traits: arr(o.voice_traits),
        hashtags: arr(o.hashtags),
        compliance_json: JSON.stringify((o.compliance && typeof o.compliance === 'object') ? o.compliance : {}),
        target_audience: String(o.target_audience ?? '').trim(),
        insight: String(o.insight ?? '').trim(),
        behavior: String(o.behavior ?? '').trim(),
        brand_rules: String(o.brand_rules ?? '').trim(),
      };
      // Auto-save (?save=1): upsert brand_dna, chỉ ghi trường có nội dung (không xoá dữ liệu cũ).
      if (req.nextUrl.searchParams.get('save') === '1') {
        const cols = Object.entries(fields).filter(([, v]) => v && v !== '[]' && v !== '{}');
        if (!db.prepare('SELECT id FROM brand_dna WHERE brand_id=?').get(brandId)) {
          db.prepare('INSERT INTO brand_dna (id, brand_id) VALUES (?, ?)').run(crypto.randomUUID(), brandId);
        }
        if (cols.length) db.prepare(`UPDATE brand_dna SET ${cols.map(([k]) => `${k}=?`).join(', ')} WHERE brand_id=?`).run(...cols.map(([, v]) => v), brandId);
      }
      return NextResponse.json({ ok: true, fields, sources: names, saved: req.nextUrl.searchParams.get('save') === '1' });
    }
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
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

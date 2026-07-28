export const dynamic = 'force-dynamic';
export const maxDuration = 120;
/**
 * TEMPLATE COMPOSER — việc 1 của dây chuyền: CHO BRIEF → SẢN XUẤT RA TEMPLATE.
 * Brief (tự do / phiếu A-E) → Gemini sinh full ReelTemplateDef đúng schema →
 * CODE validate từng luật (VERIFY-GATE: code quyết, không tin verdict LLM) →
 * lưu BRAND_LIBRARY/TEMPLATES/reel_<id>.json → dùng được NGAY qua registry
 * (getReelTemplate) cho mọi SKU của brand.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getBrandId } from '@/lib/brand-guard';
import { enforceRateLimit } from '@/lib/rate-limit';
import { generateJSON } from '@/lib/gemini';
import { writeLibJson, ensureBrandLibrary, readLibJson } from '@/lib/video/brand-library';
import {
  ReelTemplateDef, ReelBlock, ICED_SUMMER_TEMPLATE, REEL_TEMPLATES,
  NEGATIVE_PROMPT, QUALITY_BLOCK, REEL_GRADE_VF,
} from '@/lib/video/reel-template';

interface RawBlock {
  id?: string; durS?: number; concept?: string; camera?: string; sfx?: string;
  transitionOut?: string; kind?: string; hasGlass?: boolean; edit?: string;
}

/** Validate + chuẩn hoá bằng CODE — mọi luật cứng của pipeline phải được đảm bảo
 *  trước khi template được phép lưu. Trả lỗi cụ thể để Gemini/người sửa. */
function normalizeTemplate(raw: {
  id?: string; name?: string; description?: string; totalS?: number;
  heroConcept?: string; sceneCanvas?: string; blocks?: RawBlock[]; softCtas?: string[];
}): { def?: ReelTemplateDef; errors: string[] } {
  const errors: string[] = [];
  const id = String(raw.id || '').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').slice(0, 40);
  if (!/^[a-z][a-z0-9_]{3,}$/.test(id)) errors.push('id không hợp lệ (snake_case, ≥4 ký tự)');
  if (REEL_TEMPLATES[id]) errors.push(`id trùng template builtin: ${id}`);
  if (!raw.name) errors.push('thiếu name');
  if (!raw.heroConcept || !raw.heroConcept.includes('{heroSubject}'))
    errors.push('heroConcept phải chứa placeholder {heroSubject} (nguồn continuity)');
  const blocksIn = Array.isArray(raw.blocks) ? raw.blocks : [];
  if (blocksIn.length < 4 || blocksIn.length > 10) errors.push(`số block ${blocksIn.length} ngoài 4-10`);

  const totalS = Math.min(30, Math.max(8, Number(raw.totalS) || 10));
  const sumDur = blocksIn.reduce((a, b) => a + (Number(b.durS) || 0), 0);
  if (sumDur < 4) errors.push('tổng durS quá ngắn');

  let cursor = 0;
  const blocks: ReelBlock[] = blocksIn.map((b, i) => {
    const durS = Math.round(((Number(b.durS) || 1) / sumDur) * totalS * 10) / 10;
    const isLast = i === blocksIn.length - 1;
    const blockId = String(b.id || `BLOCK_${i}`).toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 30);
    const kind = (isLast || b.kind === 'endcard') ? 'endcard' as const : 'ai' as const;
    if (kind === 'ai') {
      if (!b.concept) errors.push(`block ${blockId} thiếu concept`);
      if (!b.sfx) errors.push(`block ${blockId} thiếu sfx`);
      if (!b.camera) errors.push(`block ${blockId} thiếu camera`);
      if (b.hasGlass && b.edit && !/exact|same|identical|keep/i.test(String(b.edit)))
        errors.push(`block ${blockId} edit phải là lệnh GIỮ NGUYÊN chủ thể (Keep the EXACT same…)`);
    }
    // Props dễ sinh chữ AI (túi trà/tag/nhãn/bao bì) → ép mô tả "trơn không chữ"
    // ngay trong concept — bài học DROP_TEA_BAG 28/07: tag túi trà luôn ra chữ.
    const textyProp = /tea bag|teabag|sachet|label|tag|package|packaging|box|wrapper/i;
    const plainify = (txt: string) => textyProp.test(txt)
      ? `${txt} (all props plain and unmarked, blank tags, absolutely no printed text or logos)`
      : txt;
    const out: ReelBlock = {
      id: blockId,
      start: Math.round(cursor * 10) / 10,
      end: Math.round((cursor + durS) * 10) / 10,
      concept: plainify(String(b.concept || '').slice(0, 400)),
      camera: String(b.camera || 'locked static shot').slice(0, 120),
      sfx: String(b.sfx || 'soft ambient room tone').slice(0, 200),
      transitionOut: (['hard', 'match', 'xfade'].includes(String(b.transitionOut)) ? b.transitionOut : 'hard') as ReelBlock['transitionOut'],
      kind,
      hasGlass: Boolean(b.hasGlass),
      edit: b.edit ? plainify(String(b.edit).slice(0, 500)) : undefined,
    };
    cursor += durS;
    return out;
  });
  if (blocks.length && blocks[blocks.length - 1].kind !== 'endcard') errors.push('block cuối phải là endcard (CTA + packshot thật)');
  if (!blocks.some(b => b.hasGlass)) errors.push('cần ≥1 block hasGlass=true (continuity anchor theo hero)');
  const ids = new Set(blocks.map(b => b.id));
  if (ids.size !== blocks.length) errors.push('id block trùng nhau');

  if (errors.length) return { errors };
  return {
    errors: [],
    def: {
      id, name: String(raw.name).slice(0, 80),
      description: String(raw.description || '').slice(0, 400),
      totalS,
      blocks,
      videoTypeOrders: { default: blocks.map(b => b.id) },
      heroConcept: String(raw.heroConcept).slice(0, 400),
      sceneCanvas: String(raw.sceneCanvas || ICED_SUMMER_TEMPLATE.sceneCanvas).slice(0, 400),
      gradeVf: REEL_GRADE_VF,
      negativePrompt: NEGATIVE_PROMPT,
      qualityBlock: QUALITY_BLOCK,
      softCtas: (Array.isArray(raw.softCtas) && raw.softCtas.length ? raw.softCtas : ICED_SUMMER_TEMPLATE.softCtas).map(c => String(c).slice(0, 60)).slice(0, 6),
    },
  };
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { scope: 'ai:reel-compose', limit: 5, windowMs: 300_000 });
  if (limited) return limited;
  const brandId = getBrandId(req);
  ensureBrandLibrary(brandId);
  const body = await req.json().catch(() => ({})) as { brief?: string };
  const brief = String(body.brief || '').slice(0, 5000);
  if (!brief.trim()) return NextResponse.json({ error: 'Thiếu brief' }, { status: 400 });

  // 2 vòng: sinh → validate bằng code → nếu lỗi, đưa lỗi cho Gemini sửa 1 lần
  let lastErrors: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await generateJSON<Parameters<typeof normalizeTemplate>[0]>(
      `You are the TEMPLATE COMPOSER of an automated vertical-video production line (9:16 reels, AI-generated scenes + composited real packshot end card).
Design a REEL TEMPLATE from this BRIEF (Vietnamese possible): """${brief}"""
${attempt ? `Your previous output failed CODE VALIDATION with these errors — fix ALL of them: ${JSON.stringify(lastErrors)}` : ''}
Return ONLY JSON:
{"id":"snake_case_v01","name":"...","description":"1-2 câu tiếng Việt: template này cho loại video gì, hợp sản phẩm nào",
 "totalS":<8-30 seconds>,
 "heroConcept":"the single HERO image concept that anchors visual continuity, MUST contain the placeholder {heroSubject} for the product, English",
 "sceneCanvas":"shared environment description pasted verbatim into every scene prompt (surface, light, mood), English",
 "blocks":[{"id":"BLOCK_ID","durS":<seconds>,"concept":"what happens, English, may use {ingredient}/{garnish}/{liquidColor}/{heroSubject}","camera":"ONE camera move only","sfx":"ASMR/sound cue for this block","transitionOut":"hard|match|xfade","hasGlass":<true if the hero product vessel is visible — these scenes get edited FROM the hero image for continuity>,"edit":"IF hasGlass: instruction starting with 'Keep the EXACT same …' describing how to edit the hero image into this scene"}],
 "softCtas":["2-4 soft CTAs, no Buy now/Hurry"]}
RULES: last block = end card (kind endcard, no concept needed — real packshot composited); 4-9 blocks total; shots 1-2.5s each for sensory templates, longer allowed for how-to; ≥1 hasGlass block; camera = one move per shot; no text rendered by AI.`
    );
    const { def, errors } = normalizeTemplate(raw || {});
    if (def) {
      writeLibJson(brandId, `TEMPLATES/reel_${def.id}.json`, def);
      // Đọc lại xác nhận lưu OK (verify, không tin write mù)
      const saved = readLibJson<ReelTemplateDef>(brandId, `TEMPLATES/reel_${def.id}.json`);
      if (!saved?.blocks?.length) return NextResponse.json({ error: 'Lưu template thất bại' }, { status: 500 });
      return NextResponse.json({ ok: true, template: saved, validated: true });
    }
    lastErrors = errors;
  }
  return NextResponse.json({ error: `Template không qua validate sau 2 vòng: ${lastErrors.join('; ')}` }, { status: 422 });
}

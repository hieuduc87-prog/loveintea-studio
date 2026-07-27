/**
 * Reel director — M0 (reference → motion dictionary, chạy 1 lần/template) và
 * M1 (đề bài mỗi lần chạy → ReelPlan: prompt từng scene + text overlay + CTA).
 *
 * Luật đề bài: reference CHỈ dạy motion grammar (scene_type, shot_duration,
 * camera, motion, sound_cue, transition) — motion dictionary KHÔNG lưu mô tả
 * bố cục/nhận diện riêng của đối thủ. Prompt scene phải là LoveinTea mới 100%.
 */
import fs from 'fs';
import path from 'path';
import { generateJSON } from '../gemini';
import { analyzeReferenceVideo, ReferenceAnalysis } from './analyze-reference';
import { referencesRoot, readLibJson, writeLibJson, ensureBrandLibrary } from './brand-library';
import {
  ICED_SUMMER_BLOCKS, SKUS, NEGATIVE_PROMPT, QUALITY_BLOCK, SCENE_CANVAS,
  VIDEO_TYPE_ORDERS, SOFT_CTAS, FORBIDDEN_CLAIMS, REEL_TEMPLATE_ID, SAFE,
} from './reel-template';
import { getProductProfile, ProductProfile } from './product-profile';

export interface ReelSceneSpec {
  blockId: string;
  start: number; end: number;
  prompt: string;             // prompt i2v đầy đủ (đã ghép canvas + quality + negative)
  imagePrompt: string;        // prompt t2i frame gốc
  sfxPrompt: string;
  transitionOut: 'hard' | 'match' | 'xfade';
  kind: 'ai' | 'endcard';
  /** Kontext edit từ hero (continuity). undefined + hasGlass → dùng thẳng hero. */
  editInstruction?: string;
  hasGlass?: boolean;
}

export interface ReelPlan {
  template: string;
  /** Mã SKU legacy (LoveinTea) — plan mới dùng profile là chính. */
  sku: string;
  /** Profile sản phẩm snapshot lúc dựng plan — render KHÔNG phụ thuộc bảng SKU. */
  profile?: ProductProfile;
  videoType: string;
  userPrompt: string;
  scenes: ReelSceneSpec[];
  /** Prompt ảnh HERO — nguồn continuity duy nhất (ly + mặt bàn + ánh sáng). */
  heroPrompt?: string;
  totalS: number;
  ctaText: string;
  textOverlays: Array<{ blockId: string; text: string; role: 'hook' | 'micro' | 'cta' }>;
  captionHint: string;        // gợi ý cho caption gen lúc render xong
  versionLabel: string;
}

/** M0 — quét folder reference, phân tích từng clip, đúc motion dictionary. */
export async function analyzeReferenceLibrary(brandId: string, templateKey = REEL_TEMPLATE_ID, log?: (m: string) => void): Promise<{ clips: number; dictionary: unknown }> {
  ensureBrandLibrary(brandId);
  const dir = referencesRoot(brandId, templateKey);
  const files = (fs.existsSync(dir) ? fs.readdirSync(dir) : []).filter(f => f.endsWith('.mp4')).sort();
  if (files.length < 3) throw new Error(`Cần ≥3 video mẫu trong ${dir} (hiện có ${files.length})`);

  const analyses: Array<{ file: string; analysis: ReferenceAnalysis }> = [];
  for (const f of files) {
    log?.(`Phân tích ${f}…`);
    const a = await analyzeReferenceVideo(path.join(dir, f), 'video/mp4', f.replace(/\W/g, ''));
    if (a) analyses.push({ file: f, analysis: a });
    else log?.(`⚠ ${f}: phân tích thất bại, bỏ qua`);
  }
  if (!analyses.length) throw new Error('Không phân tích được clip nào');
  fs.writeFileSync(path.join(dir, 'reference_analysis.json'), JSON.stringify(analyses, null, 2));

  // Đúc grammar — chỉ giữ pattern trừu tượng, lọc bỏ chi tiết nhận diện đối thủ
  log?.('Đúc motion dictionary…');
  const dictionary = await generateJSON<Record<string, unknown>>(
    `You are compiling a MOTION DICTIONARY for a beverage brand's vertical reel template from ${analyses.length} competitor reference analyses.
STRICT RULES: keep ONLY abstract motion grammar (scene types, shot durations, camera moves, motion direction, cut rhythm, ASMR sound cues, transitions). DO NOT keep any brand-identifying details: no specific ingredients, no colors of their drink, no text they used, no logos, no distinctive composition descriptions.
Return ONLY JSON: {"avg_shot_s":<num>,"cut_rhythm":"...","scene_grammar":[{"type":"macro_ingredient|ice_impact|ingredient_action|pour|garnish|drink_beauty|ritual|other","typical_duration_s":<num>,"camera":"...","motion":"...","sound_cue":"..."}],"transition_stats":{"hard":0.7,"match":0.2,"fade":0.1},"asmr_timing_notes":"..."}
Reference analyses: ${JSON.stringify(analyses.map(a => a.analysis)).slice(0, 24000)}`
  );
  writeLibJson(brandId, `MOTION/${templateKey.replace(/_v\d+$/, '')}_motion_dictionary.json`, dictionary);
  return { clips: analyses.length, dictionary };
}

function loadMotionDictionary(brandId: string, templateKey = REEL_TEMPLATE_ID): Record<string, unknown> | null {
  return readLibJson<Record<string, unknown>>(brandId, `MOTION/${templateKey.replace(/_v\d+$/, '')}_motion_dictionary.json`);
}

function fillConcept(tpl: string, prof: Pick<ProductProfile, 'ingredient' | 'garnish' | 'liquidColor'>): string {
  return tpl
    .replaceAll('{ingredient}', prof.ingredient)
    .replaceAll('{garnish}', prof.garnish)
    .replaceAll('{liquidColor}', prof.liquidColor);
}

function stripClaims(text: string): string {
  let out = text;
  for (const c of FORBIDDEN_CLAIMS) out = out.replace(new RegExp(`\\b${c}\\b`, 'gi'), '').replace(/\s{2,}/g, ' ').trim();
  return out;
}

/** M1 — dựng ReelPlan. Gemini tinh chỉnh concept theo user prompt; template giữ khung cứng.
 *  KHÁI QUÁT: nhận productId của BẤT KỲ brand/sản phẩm nào (profile đúc từ DB);
 *  sku code là đường legacy LoveinTea. */
export async function buildReelPlan(opts: {
  brandId: string; sku?: string; productId?: string; videoType: string; userPrompt: string;
  versionIndex?: number; language?: string;
}): Promise<ReelPlan> {
  let profile: ProductProfile;
  if (opts.productId) {
    profile = await getProductProfile(opts.brandId, opts.productId);
  } else {
    const legacy = SKUS[String(opts.sku || '').toUpperCase()];
    if (!legacy) throw new Error(`Cần productId hoặc SKU hợp lệ (${Object.keys(SKUS).join('/')})`);
    profile = {
      productId: `prod-${legacy.productSlug}`, productName: legacy.name, productSlug: legacy.productSlug,
      ingredient: legacy.ingredient, garnish: legacy.garnish, liquidColor: legacy.liquidColor,
      moment: legacy.moment, heroSubject: `iced ${legacy.liquidColor} herbal tea`,
    };
  }
  const skuCode = Object.values(SKUS).find(s => s.productSlug === profile.productSlug)?.code
    || profile.productSlug.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 4) || 'PROD';
  const order = VIDEO_TYPE_ORDERS[opts.videoType] || VIDEO_TYPE_ORDERS.iced_summer;
  const motionDict = loadMotionDictionary(opts.brandId);
  const vIdx = opts.versionIndex ?? 0;

  // Khung block theo order của loại video, timeline scale lại về tổng 10s giữ tỉ lệ
  const chosen = order.map(id => ICED_SUMMER_BLOCKS.find(b => b.id === id)!).filter(Boolean);
  const spanTotal = chosen.reduce((a, b) => a + (b.end - b.start), 0);
  let cursor = 0;
  const blocks = chosen.map(b => {
    const dur = Math.round(((b.end - b.start) / spanTotal) * 10 * 10) / 10;
    const out = { ...b, start: Math.round(cursor * 10) / 10, end: Math.round((cursor + dur) * 10) / 10 };
    cursor += dur;
    return out;
  });

  // Gemini tinh chỉnh concept theo user prompt (bám sản phẩm + chủ đề, không đổi khung)
  let refined: Record<string, string> = {};
  let overlays: ReelPlan['textOverlays'] = [];
  let ctaText = SOFT_CTAS[vIdx % SOFT_CTAS.length];
  try {
    const aiBlocks = blocks.filter(b => b.kind === 'ai');
    const r = await generateJSON<{ scenes: Record<string, string>; overlays: Array<{ blockId: string; text: string; role: string }>; cta: string }>(
      `You are the scene director for a 10s premium vertical reel for the beverage product "${profile.productName}".
User's creative brief (Vietnamese possible): "${opts.userPrompt.slice(0, 500)}"
Video type: ${opts.videoType}. Version index: ${vIdx} (vary wording slightly per version).
Motion grammar learned from references (abstract only): ${JSON.stringify(motionDict ?? {}).slice(0, 3000)}

For each scene id, refine the base concept into ONE vivid English sentence (subject + ONE action) staying 100% true to THIS product: ingredient = ${profile.ingredient}; garnish = ${profile.garnish}; liquid color = ${profile.liquidColor}. NEVER mention any text, logo, packaging, brand names, or competitor elements. NEVER change camera or timing.
Also propose AT MOST ${SAFE.maxTexts - 1} short text overlays (≤6 words each, sentence case, English) + 1 soft CTA (no "Buy now"/"Hurry"/urgency; no health claims like ${FORBIDDEN_CLAIMS.slice(0, 6).join(', ')}).
Base concepts: ${JSON.stringify(Object.fromEntries(aiBlocks.map(b => [b.id, fillConcept(b.concept, profile)])))}
Return ONLY JSON: {"scenes":{"<blockId>":"refined sentence"},"overlays":[{"blockId":"...","text":"...","role":"hook|micro"}],"cta":"..."}`
    );
    refined = r.scenes || {};
    overlays = (r.overlays || []).slice(0, SAFE.maxTexts - 1)
      .filter(o => blocks.some(b => b.id === o.blockId))
      .map(o => ({ blockId: o.blockId, text: stripClaims(String(o.text).slice(0, 48)), role: (o.role === 'hook' ? 'hook' : 'micro') as 'hook' | 'micro' }));
    if (r.cta && !/buy now|hurry|limited/i.test(r.cta)) ctaText = stripClaims(String(r.cta).slice(0, 40));
  } catch (e) {
    console.warn('[reel-director] Gemini refine failed — dùng concept template:', String(e).slice(0, 150));
  }

  const scenes: ReelSceneSpec[] = blocks.map(b => {
    const concept = refined[b.id] || fillConcept(b.concept, profile);
    const motion = `${concept}. Camera: ${b.camera}, single continuous move.`;
    return {
      blockId: b.id,
      start: b.start, end: b.end,
      kind: b.kind,
      transitionOut: b.transitionOut,
      hasGlass: b.hasGlass,
      // Continuity: editInstruction lấy NGUYÊN VĂN template (không cho Gemini refine —
      // refine tự do là nguồn "mỗi cảnh một cái ly" đã trả giá 27/07)
      editInstruction: b.edit ? fillConcept(b.edit, profile) : undefined,
      imagePrompt: b.kind === 'ai'
        ? `${concept}. ${SCENE_CANVAS}. ${QUALITY_BLOCK}. ${NEGATIVE_PROMPT}`
        : '',
      prompt: b.kind === 'ai'
        ? `${motion} ${SCENE_CANVAS}. ${QUALITY_BLOCK}. ${NEGATIVE_PROMPT}`
        : '',
      sfxPrompt: b.sfx,
    };
  });

  return {
    template: REEL_TEMPLATE_ID,
    sku: skuCode,
    profile,
    videoType: opts.videoType,
    userPrompt: opts.userPrompt,
    scenes,
    heroPrompt: `a tall clear glass filled with ${profile.heroSubject}, realistic ice cubes, condensation drops on the glass, natural color, premium beverage beauty shot. ${SCENE_CANVAS}. ${QUALITY_BLOCK}. ${NEGATIVE_PROMPT}`,
    totalS: Math.round(cursor * 10) / 10,
    ctaText,
    textOverlays: [...overlays, { blockId: 'PRODUCT_CTA', text: ctaText, role: 'cta' }],
    captionHint: `${profile.productName} — ${profile.moment}. ${opts.userPrompt.slice(0, 200)}`,
    versionLabel: `v${vIdx + 1}`,
  };
}

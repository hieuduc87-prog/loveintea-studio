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
import { SKUS, SOFT_CTAS, FORBIDDEN_CLAIMS, REEL_TEMPLATE_ID, SAFE, PHYSICS_BLOCK } from './reel-template';
import { getProductProfile, ProductProfile } from './product-profile';
import { getReelTemplate } from './brand-library';
import type { ReelTemplateDef } from './reel-template';

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
  /** Grade ffmpeg snapshot từ template (custom template có grade riêng). */
  gradeVf?: string;
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

interface UserElement { element: string; scene: string; inDrink?: boolean }
interface UserExtraction { elements: UserElement[]; constraints: string[] }

/** Trích element user YÊU CẦU TƯỜNG MINH (túi trà, dâu, mật ong, thìa gỗ…) bằng
 *  call Gemini riêng — nhét chung vào refine bị bỏ qua (bài học card f30344e0). */
async function extractUserElements(userPrompt: string, sceneIds: string[]): Promise<UserExtraction> {
  if (userPrompt.trim().length < 20) return { elements: [], constraints: [] };
  try {
    const r = await generateJSON<{ elements: UserElement[]; constraints?: string[] }>(
      `From this user brief, list ONLY the concrete VISUAL elements/props/actions the user EXPLICITLY requires to appear in the video (ignore mood/vibe words). Brief (Vietnamese possible): """${userPrompt.slice(0, 800)}"""
Scene ids available: ${sceneIds.join(', ')}.
PHYSICALLY-GROUNDED RULE: describe every ACTION with its tool and contact point stated explicitly — e.g. 'a wooden spoon inserted INTO the glass, bowl submerged, gently muddling strawberry slices, liquid swirling around it' (NOT just 'muddling strawberries'). The cause must be visibly connected to its effect.
Also list PROHIBITIONS the user states (e.g. 'no bare hands touching the drink — use the spoon') in "constraints" as short English imperative sentences.
Return ONLY JSON {"elements":[{"element":"physically-grounded English phrase; any bag/prop plain and unmarked, no printed text","scene":"<single best scene id>","inDrink":<true if it ends up inside/on the finished drink>}],"constraints":["..."]} — max 4 elements, max 3 constraints, [] if none.`
    );
    return {
      elements: (r.elements || [])
        .filter(e => e && typeof e.element === 'string' && sceneIds.includes(String(e.scene)))
        .slice(0, 4)
        .map(e => ({ element: String(e.element).slice(0, 220), scene: String(e.scene), inDrink: Boolean(e.inDrink) })),
      constraints: (r.constraints || []).filter(c => typeof c === 'string' && c.trim()).slice(0, 3).map(c => String(c).slice(0, 120)),
    };
  } catch { return { elements: [], constraints: [] }; }
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
  templateId?: string; versionIndex?: number; language?: string;
}): Promise<ReelPlan> {
  // Template từ REGISTRY (builtin + custom JSON per-brand) — hết hardcode
  const T: ReelTemplateDef = getReelTemplate(opts.brandId, opts.templateId);
  let profile: ProductProfile;
  if (opts.productId) {
    profile = await getProductProfile(opts.brandId, opts.productId);
  } else {
    const legacy = SKUS[String(opts.sku || '').toUpperCase()];
    if (!legacy) throw new Error(`Cần productId hoặc SKU hợp lệ (${Object.keys(SKUS).join('/')})`);
    profile = {
      productId: `prod-${legacy.productSlug}`, productName: legacy.name, productSlug: legacy.productSlug,
      ingredient: legacy.ingredient, garnish: legacy.garnish, liquidColor: legacy.liquidColor,
      moment: legacy.moment, heroSubject: `${legacy.liquidColor} herbal tea`,
    };
  }
  const skuCode = Object.values(SKUS).find(s => s.productSlug === profile.productSlug)?.code
    || profile.productSlug.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 4) || 'PROD';
  const order = T.videoTypeOrders[opts.videoType] || Object.values(T.videoTypeOrders)[0] || T.blocks.map(b => b.id);
  const motionDict = loadMotionDictionary(opts.brandId);
  const vIdx = opts.versionIndex ?? 0;

  // Khung block theo order của loại video, timeline scale lại về tổng T.totalS giữ tỉ lệ
  const chosen = order.map(id => T.blocks.find(b => b.id === id)!).filter(Boolean);
  const spanTotal = chosen.reduce((a, b) => a + (b.end - b.start), 0);
  let cursor = 0;
  const blocks = chosen.map(b => {
    const dur = Math.round(((b.end - b.start) / spanTotal) * (T.totalS || 10) * 10) / 10;
    const out = { ...b, start: Math.round(cursor * 10) / 10, end: Math.round((cursor + dur) * 10) / 10 };
    cursor += dur;
    return out;
  });

  // Gemini tinh chỉnh concept theo user prompt (bám sản phẩm + chủ đề, không đổi khung)
  let refined: Record<string, string> = {};
  let refinedExtras: Record<string, string> = {};
  let overlays: ReelPlan['textOverlays'] = [];
  const ctas = T.softCtas?.length ? T.softCtas : SOFT_CTAS;
  let ctaText = ctas[vIdx % ctas.length];
  try {
    const aiBlocks = blocks.filter(b => b.kind === 'ai');
    const r = await generateJSON<{ scenes: Record<string, string>; extras?: Record<string, string>; overlays: Array<{ blockId: string; text: string; role: string }>; cta: string }>(
      `You are the scene director for a 10s premium vertical reel for the beverage product "${profile.productName}".
User's creative brief (Vietnamese possible): "${opts.userPrompt.slice(0, 500)}"
Video type: ${opts.videoType}. Version index: ${vIdx} (vary wording slightly per version).
Motion grammar learned from references (abstract only): ${JSON.stringify(motionDict ?? {}).slice(0, 3000)}

For each scene id, refine the base concept into ONE vivid English sentence (subject + ONE action) staying 100% true to THIS product: ingredient = ${profile.ingredient}; garnish = ${profile.garnish}; liquid color = ${profile.liquidColor}. NEVER mention any text, logo, brand names, or competitor elements. NEVER change camera or timing.
CRITICAL — USER-REQUESTED ELEMENTS: if the user's brief EXPLICITLY requests specific visual elements or recipe steps (e.g. a pyramid tea bag steeping, sliced strawberries, honey drizzle, muddling with a wooden spoon), you MUST include them: assign EACH requested element to the SINGLE most fitting scene id via "extras" (max 3 entries), one short English sentence each describing the element being added to that scene. Any bag/packaging/prop must be plain and unmarked with absolutely no printed text. Do NOT invent elements the user did not ask for.
Also propose AT MOST ${SAFE.maxTexts - 1} short text overlays (≤6 words each, sentence case, English) + 1 soft CTA (no "Buy now"/"Hurry"/urgency; no health claims like ${FORBIDDEN_CLAIMS.slice(0, 6).join(', ')}).
Base concepts: ${JSON.stringify(Object.fromEntries(aiBlocks.map(b => [b.id, fillConcept(b.concept, profile)])))}
Return ONLY JSON: {"scenes":{"<blockId>":"refined sentence"},"extras":{"<blockId>":"user-requested element sentence"},"overlays":[{"blockId":"...","text":"...","role":"hook|micro"}],"cta":"..."}`
    );
    refined = r.scenes || {};
    refinedExtras = r.extras || {};
    overlays = (r.overlays || []).slice(0, SAFE.maxTexts - 1)
      .filter(o => blocks.some(b => b.id === o.blockId))
      .map(o => ({ blockId: o.blockId, text: stripClaims(String(o.text).slice(0, 48)), role: (o.role === 'hook' ? 'hook' : 'micro') as 'hook' | 'micro' }));
    if (r.cta && !/buy now|hurry|limited/i.test(r.cta)) ctaText = stripClaims(String(r.cta).slice(0, 40));
  } catch (e) {
    console.warn('[reel-director] Gemini refine failed — dùng concept template:', String(e).slice(0, 150));
  }

  // Nhất quán NÓNG/LẠNH (template quyết) + cấm model tự bịa cốc ở cảnh không neo hero
  const serveNote = T.serve === 'hot'
    ? ' The drink is served HOT: gentle steam, warm tones, NO ice.'
    : T.serve === 'iced'
      ? ' The drink is served ICED: ice cubes, condensation, NO steam.'
      : '';
  const extras: Record<string, string> = {};
  try {
    for (const [k, v] of Object.entries((refinedExtras || {}) as Record<string, string>)) {
      if (blocks.some(b => b.id === k) && typeof v === 'string' && v.trim()) extras[k] = stripClaims(v).slice(0, 220);
    }
  } catch { /* extras optional */ }
  // Trích element user bằng call riêng (đáng tin hơn) — merge đè/ghép vào extras
  const extraction = await extractUserElements(opts.userPrompt, blocks.filter(b => b.kind === 'ai').map(b => b.id));
  const userEls = extraction.elements;
  const userConstraints = extraction.constraints.length ? ` USER RULES: ${extraction.constraints.join(' ')}` : '';
  for (const el of userEls) {
    extras[el.scene] = extras[el.scene] ? `${extras[el.scene]} ${el.element}.` : `${el.element}.`;
  }
  // Element nằm TRONG ly → bơm vào HERO để mọi cảnh neo hero đều có (continuity)
  const heroExtra = userEls.filter(e => e.inDrink).map(e => e.element).join('; ');
  // User chỉ định fruit → gỡ lệnh cấm fruit khỏi các prompt liên quan
  const FRUIT_BAN = 'no raspberries, no cherries, no grapes, no strawberries, no lemon slices unless specified';
  const FRUIT_OK = 'only the fruits explicitly specified, no other fruits';
  const userWantsFruit = userEls.some(e => /berr|strawberr|fruit|lemon|cherry|grape|citrus|dâu|chanh/i.test(e.element));
  const adjustNeg = (txt: string, hasExtra: boolean) => (hasExtra && userWantsFruit) ? txt.split(FRUIT_BAN).join(FRUIT_OK) : txt;
  // Canvas cho cảnh no-vessel: lột mệnh đề ly khỏi SCENE_CANVAS (canvas verbatim
  // chứa "the same tall clear glass…" đánh nhau với "No cups/glasses" — MACRO_HOOK
  // RM-HIBI-2807-5 fail 2 lần vì model vẽ ly theo canvas rồi gate bắt).
  const canvasNoVessel = T.sceneCanvas.replace(/the same[^,]*?(glass|mug|cup|vessel|tumbler)[^,]*?on\s+(a|an|the)\s+/i, 'the same ');
  const scenes: ReelSceneSpec[] = blocks.map(b => {
    const extra = extras[b.id];
    const canvas = (b.kind === 'ai' && !b.hasGlass) ? canvasNoVessel : T.sceneCanvas;
    const concept = (refined[b.id] || fillConcept(b.concept, profile)) + (extra ? ` ${extra}` : '');
    const noVessel = b.kind === 'ai' && !b.hasGlass
      ? ' No cups, mugs, glasses or any drink vessels anywhere in this shot.'
      : '';
    // serveNote CHỈ cho cảnh có cốc — cảnh không cốc mà nói "drink served HOT"
    // là mâu thuẫn với noVessel, model loạn (bài học ESTABLISH_COZY 28/07)
    const sNote = b.hasGlass ? serveNote : '';
    const motion = `${concept}.${sNote}${noVessel} Camera: ${b.camera}, single continuous move.`;
    return {
      blockId: b.id,
      start: b.start, end: b.end,
      kind: b.kind,
      transitionOut: b.transitionOut,
      hasGlass: b.hasGlass,
      // Continuity: editInstruction lấy NGUYÊN VĂN template (không cho Gemini refine —
      // refine tự do là nguồn "mỗi cảnh một cái ly" đã trả giá 27/07)
      editInstruction: b.edit
        ? fillConcept(b.edit, profile) + (extra ? ` Also add: ${extra} Keep everything else identical; any bag or prop must be plain and unmarked with no printed text.` : '')
        : undefined,
      imagePrompt: b.kind === 'ai'
        ? adjustNeg(`${concept}.${sNote}${noVessel}${userConstraints} ${canvas}. ${T.qualityBlock}. ${PHYSICS_BLOCK}. ${T.negativePrompt}`, Boolean(extra))
        : '',
      prompt: b.kind === 'ai'
        ? adjustNeg(`${motion}${userConstraints} ${canvas}. ${T.qualityBlock}. ${PHYSICS_BLOCK}. ${T.negativePrompt}`, Boolean(extra))
        : '',
      sfxPrompt: b.sfx,
    };
  });

  return {
    template: T.id,
    sku: skuCode,
    profile,
    videoType: opts.videoType,
    userPrompt: opts.userPrompt,
    scenes,
    heroPrompt: adjustNeg(`${T.heroConcept.replaceAll('{heroSubject}', profile.heroSubject)}${heroExtra ? `, with ${heroExtra} visible in the drink` : ''}.${serveNote} ${T.sceneCanvas}. ${T.qualityBlock}. ${PHYSICS_BLOCK}. ${T.negativePrompt}`, Boolean(heroExtra)),
    gradeVf: T.gradeVf,
    totalS: Math.round(cursor * 10) / 10,
    ctaText,
    textOverlays: [...overlays, { blockId: 'PRODUCT_CTA', text: ctaText, role: 'cta' }],
    captionHint: `${profile.productName} — ${profile.moment}. ${opts.userPrompt.slice(0, 200)}`,
    versionLabel: `v${vIdx + 1}`,
  };
}

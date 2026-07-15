/**
 * Recipe Batch workflow (Bazan viral recipe) — số hoá đúng quy trình sản xuất thật:
 *   SOURCES/RECIPES/<món>/  (clip từng bước pha chế + shot thành phẩm)
 *   SOURCES/PRODUCT-BREWING (clip sản phẩm/brewing dùng chung cả lô)
 *   COLOR GRADING           (bộ thông số màu cơ bản, mỗi video lệch nhẹ)
 *   FINAL VIDEO             (mỗi món nhiều version: Original 1/2 → tối ưu)
 *
 * Cấu trúc final chuẩn (từ "Video structure" + phân tích final thật):
 *   0–3.5s  HOOK      shot thành phẩm đẹp nhất, CÓ chuyển động — tên món 2 dòng
 *   ~2.5s   PRODUCT   shot sản phẩm/brewing — brand line 2 dòng (dòng 2 màu accent)
 *   3–10s   PROCESS   các bước pha chế theo thứ tự quay — caption nguyên liệu ngắn
 *   cuối    RESULT    shot thành phẩm chốt, KHÔNG text
 * Âm thanh: giữ tiếng thật của clip (ASMR đá/rót) + BGM nhẹ tuỳ chọn.
 */
import fs from 'fs';
import path from 'path';
import { getDb } from '../db';
import { generateJSON, analyzeImage } from '../gemini';
import { resolveLangName } from '../brand-lang';
import { extractFrames, TMP_DIR } from './ffmpeg';

export const PRODUCT_GROUP = '__product_brewing';

// ── Types ──────────────────────────────────────────────────────────────

export interface RecipeClipMeta {
  role: 'hook_final' | 'process' | 'product' | 'brewing' | 'ambience';
  step_label?: string;      // caption nguyên liệu/bước nếu role=process (≤4 từ, thường lowercase)
  best_start_s?: number;    // in-point đẹp nhất để cắt
  final_drink_s?: number | null; // giây nhìn thấy đồ uống HOÀN CHỈNH (null = không có) — neo hook/result
  movement?: number;        // 0-1 — hook phải có chuyển động từ frame đầu
  quality?: 'high' | 'medium' | 'low';
}

export interface RecipeSegment {
  clip_id: string;
  start_s: number;
  dur_s: number;
  role: RecipeClipMeta['role'] | 'result';
  text?: string;            // step caption (role=process)
}

/** Storyboard cho template bazan_recipe — lưu vào video_projects.script_json. */
export interface RecipeStoryboard {
  template: 'bazan_recipe';
  title: string;            // tên món đầy đủ
  dish_line1: string;       // dòng nhỏ trên (vd "Choco Chips")
  dish_line2: string;       // dòng to dưới (vd "Mocha")
  brand_line1?: string;     // vd "Vietnamese coffee"
  brand_line2?: string;     // dòng accent vd "super super bold"
  segments: RecipeSegment[];
}

export interface GradeParams {
  exposure?: number; contrast?: number; highlight?: number; shadow?: number;
  whites?: number; blacks?: number; brilliance?: number;
  temp?: number; tint?: number; saturation?: number;
  sharpen?: number; clarity?: number; vignette?: number;
}

/** Bộ màu cơ bản của Bazan (đọc từ ảnh COLOR GRADING trong lô mẫu). */
export const DEFAULT_GRADE: GradeParams = {
  exposure: 0, contrast: 0, highlight: 0, shadow: -10,
  whites: 4, blacks: -5, brilliance: 2,
  temp: 0, tint: 0, saturation: 5,
  sharpen: 12, clarity: 6, vignette: 0,
};

// ── Color grade → ffmpeg filter ────────────────────────────────────────
// Thang -100..100 kiểu app ảnh (Photos/Lightroom mobile) → filter chain ffmpeg.
// Xấp xỉ đủ dùng: eq (sat/contrast/brightness) + curves (shadow/whites/blacks/brilliance)
// + unsharp nhỏ (sharpen) + unsharp bán kính lớn (clarity = local contrast).
export function gradeFilter(g: GradeParams | null | undefined): string {
  const p = { ...DEFAULT_GRADE, ...(g ?? {}) };
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const parts: string[] = [];

  const eq: string[] = [];
  const sat = clamp(1 + (p.saturation ?? 0) / 100, 0, 3);
  const con = clamp(1 + (p.contrast ?? 0) / 200, 0.5, 2);
  const bri = clamp((p.exposure ?? 0) / 200, -0.5, 0.5);
  if (sat !== 1) eq.push(`saturation=${sat.toFixed(3)}`);
  if (con !== 1) eq.push(`contrast=${con.toFixed(3)}`);
  if (bri !== 0) eq.push(`brightness=${bri.toFixed(3)}`);
  if (p.temp) eq.push(`gamma_r=${clamp(1 + p.temp / 400, 0.7, 1.3).toFixed(3)}`, `gamma_b=${clamp(1 - p.temp / 400, 0.7, 1.3).toFixed(3)}`);
  if (eq.length) parts.push(`eq=${eq.join(':')}`);

  // curves master: blacks (0.06), shadow (0.25), brilliance (0.5), highlight (0.75), whites (0.94)
  const pt = (x: number, delta: number) => `${x}/${clamp(x + delta, 0, 1).toFixed(3)}`;
  const curve = [
    '0/0',
    pt(0.06, (p.blacks ?? 0) / 500),
    pt(0.25, (p.shadow ?? 0) / 400),
    pt(0.5, (p.brilliance ?? 0) / 500),
    pt(0.75, (p.highlight ?? 0) / 400),
    pt(0.94, (p.whites ?? 0) / 500),
    '1/1',
  ].join(' ');
  parts.push(`curves=master='${curve}'`);

  const sharpen = clamp((p.sharpen ?? 0) / 100, 0, 1.5);
  if (sharpen > 0.01) parts.push(`unsharp=5:5:${(sharpen * 1.2).toFixed(2)}:5:5:0`);
  const clarity = clamp((p.clarity ?? 0) / 100, 0, 1);
  if (clarity > 0.01) parts.push(`unsharp=13:13:${(clarity * 0.8).toFixed(2)}:13:13:0`);
  if (p.vignette && p.vignette > 0) parts.push(`vignette=PI/(5-${clamp(p.vignette / 50, 0, 2).toFixed(2)})`);

  return parts.join(',');
}

// ── Clip classifier (Gemini video understanding) ───────────────────────

const CLASSIFY_PROMPT = `You are cataloguing raw footage for an automated recipe-video editor (vertical coffee-drink Reels).
Classify this ONE clip and return ONLY JSON:
{"role":"hook_final|process|product|brewing|ambience",
 "step_label":"short ingredient/action label if role=process, lowercase, max 4 words (e.g. 'chocolate sauce','milk of choice','espresso shot','cocoa powder')",
 "best_start_s":<seconds of the best in-point to cut from — a moment with clear motion>,
 "final_drink_s":<seconds where the COMPLETELY FINISHED drink is clearly visible, or null if it never is>,
 "movement":<0..1 how much visual motion in the first second from best_start_s>,
 "quality":"high|medium|low"}
Roles (STRICT):
- hook_final: ONLY when the clip shows the COMPLETELY FINISHED drink — fully assembled with milk/cream AND topping/garnish, ready to serve (being stirred, garnished, straw in, hero shot). A plain espresso shot, glass of milk, or empty/ice-only glass is NOT hook_final.
- process: a preparation step (pouring an ingredient, adding ice, mixing, measuring, placing empty glasses)
- product: coffee bag / packaging showcase
- brewing: coffee extraction (phin, espresso machine, moka, filter, grinder)
- ambience: anything else (room, hands only, b-roll)`;

/** Phân loại 1 clip theo vai trò trong công thức. Fallback: 3 frame → Vision. */
export async function classifyRecipeClip(videoPath: string, mimeType: string, id: string): Promise<RecipeClipMeta | null> {
  const key = process.env.GEMINI_API_KEY;
  if (key) {
    try {
      const { GoogleAIFileManager, FileState } = await import('@google/generative-ai/server');
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const fm = new GoogleAIFileManager(key);
      const uploaded = await fm.uploadFile(videoPath, { mimeType, displayName: path.basename(videoPath) });
      let file = await fm.getFile(uploaded.file.name);
      const deadline = Date.now() + 90_000;
      while (file.state === FileState.PROCESSING && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 3000));
        file = await fm.getFile(uploaded.file.name);
      }
      if (file.state === FileState.ACTIVE) {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseMimeType: 'application/json' } });
        const res = await model.generateContent([{ fileData: { mimeType, fileUri: file.uri } }, CLASSIFY_PROMPT]);
        const raw = res.response.text().trim();
        try { await fm.deleteFile(uploaded.file.name); } catch { /* best effort */ }
        const m = raw.match(/\{[\s\S]*\}/);
        return JSON.parse(m ? m[0] : raw) as RecipeClipMeta;
      }
      try { await fm.deleteFile(uploaded.file.name); } catch { /* */ }
    } catch (e) {
      console.warn('[recipe-classify] video API failed, frame fallback:', String(e).slice(0, 150));
    }
  }
  try {
    const dir = path.join(TMP_DIR, `rcls_${id}`);
    const frames = await extractFrames(videoPath, dir, 3);
    const raw = await analyzeImage(fs.readFileSync(frames[1]), 'image/jpeg',
      `${CLASSIFY_PROMPT}\n(You see ONE middle frame of the clip — infer.)`);
    fs.rmSync(dir, { recursive: true, force: true });
    const m = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : raw) as RecipeClipMeta;
  } catch (e) {
    console.warn('[recipe-classify] frame fallback failed:', String(e).slice(0, 150));
    return null;
  }
}

// ── Storyboard builder ─────────────────────────────────────────────────

interface ClipRow {
  id: string; filename: string; duration_s: number; created_at: string;
  recipe_json: string | null; group_name: string | null;
}

function meta(c: ClipRow): RecipeClipMeta {
  try { return JSON.parse(c.recipe_json || '{}') as RecipeClipMeta; } catch { return { role: 'ambience' }; }
}
const qScore = (q?: string) => (q === 'high' ? 2 : q === 'medium' ? 1 : 0);

/** In-point an toàn: không vượt quá duration - dur cần lấy. */
function inPoint(c: ClipRow, m: RecipeClipMeta, durS: number): number {
  const want = Math.max(0, m.best_start_s ?? 0);
  return Math.max(0, Math.min(want, Math.max(0, c.duration_s - durS - 0.1)));
}

/**
 * Dựng storyboard 1 món theo template Bazan. Deterministic theo `version`
 * (0 = Original 1, 1 = Original 2…): xoay hook clip / product clip / bước lẻ
 * để mỗi version là một bản dựng khác thật sự.
 */
export async function buildRecipeStoryboard(opts: {
  batchId: string; brandId: string; dish: string; version: number; language?: string;
}): Promise<RecipeStoryboard> {
  const { batchId, brandId, dish, version } = opts;
  const db = getDb();

  // Bỏ clip quá ngắn (<1s) — không đủ 1 nhịp cắt (lô mẫu thật có file 0.4s)
  const dishClips = (db.prepare(
    `SELECT id, filename, duration_s, created_at, recipe_json, group_name FROM video_clips
     WHERE batch_id=? AND group_name=? AND status='ready' ORDER BY filename`
  ).all(batchId, dish) as ClipRow[]).filter(c => c.duration_s >= 1);
  if (!dishClips.length) throw new Error(`Món "${dish}" chưa có clip ready (dài ≥1s)`);

  const sharedClips = (db.prepare(
    `SELECT id, filename, duration_s, created_at, recipe_json, group_name FROM video_clips
     WHERE batch_id=? AND group_name=? AND status='ready' ORDER BY filename`
  ).all(batchId, PRODUCT_GROUP) as ClipRow[]).filter(c => c.duration_s >= 1);

  // Phân vai. Tên file IMG_xxxx tăng dần theo thời gian quay = đúng thứ tự bước pha chế.
  // Clip "thành phẩm" = role hook_final HOẶC classifier thấy đồ uống hoàn chỉnh (final_drink_s).
  const isFinal = (c: ClipRow) => { const m = meta(c); return m.role === 'hook_final' || typeof m.final_drink_s === 'number'; };
  const finals = dishClips.filter(isFinal)
    .sort((a, b) => {
      const score = (c: ClipRow) => { const m = meta(c); return (m.role === 'hook_final' ? 1 : 0) + (typeof m.final_drink_s === 'number' ? 1 : 0) + (m.movement ?? 0) + qScore(m.quality); };
      return score(b) - score(a);
    });
  const steps = dishClips.filter(c => meta(c).role === 'process' && !isFinal(c));
  const others = dishClips.filter(c => !isFinal(c) && meta(c).role !== 'process');
  // Không có shot thành phẩm rõ → dùng clip dài nhất làm hook (đoạn cuối thường là thành phẩm)
  if (!finals.length) {
    const longest = [...dishClips].sort((a, b) => b.duration_s - a.duration_s)[0];
    finals.push(longest);
  }

  const hookClip = finals[version % finals.length];
  // Result: shot thành phẩm KHÁC hook nếu có; không thì lấy cùng clip nhưng đoạn khác
  const resultClip = finals.length > 1 ? finals[(version + 1) % finals.length] : finals[0];

  const productPool = sharedClips.length ? sharedClips : others;
  const productClip = productPool.length ? productPool[version % productPool.length] : null;

  // Bước pha chế: final gốc ưu tiên bước NGUYÊN LIỆU (rót/đổ/rắc) — bước "đặt ly/xếp đồ"
  // chỉ là B-roll, giữ tối đa 1-2 cảnh. Sau khi chọn, trả về đúng thứ tự quay.
  const MAX_STEPS = 6;
  const isPlacing = (t?: string) => /^(place|placing|position|arrange|set)\b/i.test(t ?? '');
  let chosenSteps = steps;
  if (steps.length > MAX_STEPS) {
    const ranked = [...steps].sort((a, b) => {
      const pa = Number(isPlacing(meta(a).step_label)), pb = Number(isPlacing(meta(b).step_label));
      if (pa !== pb) return pa - pb; // nguyên liệu trước, "đặt/xếp" sau
      return (meta(b).movement ?? 0) - (meta(a).movement ?? 0);
    });
    // version xoay điểm bắt đầu trong nhóm đã xếp hạng → mỗi bản dựng khác nhau chút
    const offset = version % Math.max(1, ranked.length - MAX_STEPS + 1);
    const kept = new Set(ranked.slice(offset, offset + MAX_STEPS).map(c => c.id));
    chosenSteps = steps.filter(c => kept.has(c.id));
  }

  // ── Timeline (nhịp đo từ final gốc: hook ~4.8s → bước đầu thong thả →
  //    shot sản phẩm chèn GIỮA các bước → chuỗi bước CẮT NHANH ~1s → result ~3s) ──
  const segments: RecipeSegment[] = [];
  const hookDur = Math.min(5.0, Math.max(3.2, hookClip.duration_s - 0.2));
  // Neo hook vào lúc đồ uống hoàn chỉnh xuất hiện (final_drink_s) nếu classifier thấy
  const hm = meta(hookClip);
  const hookStart = typeof hm.final_drink_s === 'number'
    ? Math.max(0, Math.min(hm.final_drink_s, hookClip.duration_s - hookDur - 0.1))
    : inPoint(hookClip, hm, hookDur);
  segments.push({ clip_id: hookClip.id, start_s: round1(hookStart), dur_s: round1(hookDur), role: 'hook_final' });

  const n = chosenSteps.length;
  const baseStep = n ? Math.min(1.8, Math.max(0.9, 6.0 / n)) : 0;
  const stepSegs: RecipeSegment[] = chosenSteps.map((s, idx) => {
    const m = meta(s);
    // bước đầu dài hơn ~1.5x (nhịp gốc), các bước sau cắt nhanh
    const want = idx === 0 ? Math.min(2.6, baseStep * 1.5) : baseStep;
    const d = Math.min(want, Math.max(0.8, s.duration_s - 0.15));
    return { clip_id: s.id, start_s: inPoint(s, m, d), dur_s: round1(d), role: 'process' as const, text: m.step_label || undefined };
  });

  let productSeg: RecipeSegment | null = null;
  if (productClip) {
    const d = Math.min(2.0, Math.max(1.4, productClip.duration_s - 0.1));
    productSeg = { clip_id: productClip.id, start_s: inPoint(productClip, meta(productClip), d), dur_s: round1(d), role: meta(productClip).role === 'brewing' ? 'brewing' : 'product' };
  }

  // Chèn shot sản phẩm SAU 1-2 bước đầu (đúng vị trí trong final gốc), không phải ngay sau hook
  const insertAt = Math.min(stepSegs.length, stepSegs.length >= 3 ? 2 : 1);
  segments.push(...stepSegs.slice(0, insertAt));
  if (productSeg) segments.push(productSeg);
  segments.push(...stepSegs.slice(insertAt));

  // Result: clip thành phẩm thường CHỐT đẹp ở CUỐI (rắc topping xong, ly hoàn thiện)
  // → clip dài thì lấy đoạn cuối; nếu trùng clip hook thì càng phải tránh lặp khoảnh khắc đầu.
  const resDur = Math.min(3.4, Math.max(2.6, resultClip.duration_s - 0.2));
  let resStart = inPoint(resultClip, meta(resultClip), resDur);
  const endStart = Math.max(0, resultClip.duration_s - resDur - 0.3);
  if (resultClip.duration_s > resDur * 2 || resultClip.id === hookClip.id) resStart = endStart;
  segments.push({ clip_id: resultClip.id, start_s: round1(resStart), dur_s: round1(resDur), role: 'result' });

  // ── Text (Gemini): tách tên món 2 dòng + brand line + polish step captions ──
  const langName = resolveLangName(opts.language, brandId);
  const dna = db.prepare('SELECT * FROM brand_dna WHERE brand_id=?').get(brandId) as Record<string, string> | undefined;
  const dishName = dish.replace(/^\d+\.?\s*/, '').trim(); // bỏ số thứ tự folder ("2. CHOCO CHIPS MOCHA")
  const stepLabels = segments.filter(s => s.role === 'process').map(s => s.text ?? '');
  let text: { dish_line1?: string; dish_line2?: string; brand_line1?: string; brand_line2?: string; steps?: string[] } = {};
  try {
    text = await generateJSON(`You finalize on-screen text for a 15-20s vertical recipe video (viral coffee Reels).
Brand: "${brandId}" — tagline: ${dna?.tagline ?? ''} | voice: ${dna?.voice_traits ?? '[]'}
COMPLIANCE (neverSay/alwaysSay): ${dna?.compliance_json ?? '{}'}
Dish name: "${dishName}"
Current step captions (one per prep step, in shooting order): ${JSON.stringify(stepLabels)}
Language for ALL text: ${langName}.

Return ONLY JSON:
{"dish_line1":"short first part of dish name (smaller top line)",
 "dish_line2":"punchy main word(s) of dish name (big bottom line)",
 "brand_line1":"brand hook line 1, max 4 words (e.g. 'Vietnamese coffee')",
 "brand_line2":"brand hook line 2 accent, max 4 words (e.g. 'super super bold')",
 "steps":["polished caption per step, SAME order & count as given, lowercase, max 4 words each; keep ingredient names; empty string if the given caption is empty"]}
Rules: dish_line1+dish_line2 must together read as the dish name (split naturally, line2 = the most appetizing word). Dish lines use natural Title Case (e.g. "Choco Chips" / "Mocha") — NEVER ALL CAPS. Do NOT invent steps.`);
  } catch (e) {
    console.warn('[recipe-board] text generation failed, using fallbacks:', String(e).slice(0, 120));
  }

  // Fallback tách tên món: từ cuối làm dòng 2. Folder thường viết HOA → Title Case cho giống final gốc.
  const titleCase = (s: string) => s === s.toUpperCase()
    ? s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, c => c.toUpperCase())
    : s;
  const words = titleCase(dishName).split(/\s+/);
  const fallback1 = words.slice(0, Math.max(1, words.length - 1)).join(' ');
  const fallback2 = words.length > 1 ? words[words.length - 1] : words[0];
  const polished = Array.isArray(text.steps) ? text.steps : [];
  let pi = 0;
  let prevText = '';
  for (const s of segments) {
    if (s.role !== 'process') continue;
    const p = polished[pi++];
    if (typeof p === 'string' && p.trim()) s.text = p.trim().slice(0, 40);
    // 2 bước liên tiếp cùng caption → chỉ hiện 1 lần (final gốc không lặp chữ)
    if (s.text && s.text.toLowerCase() === prevText) s.text = undefined;
    else prevText = (s.text ?? '').toLowerCase();
  }

  return {
    template: 'bazan_recipe',
    title: titleCase(dishName),
    dish_line1: titleCase(text.dish_line1 || fallback1).slice(0, 30),
    dish_line2: titleCase(text.dish_line2 || fallback2).slice(0, 24),
    brand_line1: (text.brand_line1 || '').slice(0, 30) || undefined,
    brand_line2: (text.brand_line2 || '').slice(0, 30) || undefined,
    segments,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

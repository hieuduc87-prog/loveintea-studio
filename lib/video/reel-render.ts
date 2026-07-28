/**
 * Reel render — thực thi ReelPlan thành video 1080×1920 10s theo đề bài Iced Summer:
 *  M2 footage factory (FLUX t2i → Hailuo i2v, cache + QA từng clip)
 *  M3 assembly (hard cut 70% / match / xfade 0.3s, grade WARM_FRESH_SUMMER)
 *  M4 end card composite packshot + text overlay font brand (AI KHÔNG render chữ)
 *  M5 audio ASMR theo block + BGM, mix 2-input tuần tự, loudnorm -14
 *  M6 QA gates + guardrail + thumbnail + caption + post draft (Review & Queue)
 *
 * Resume: mọi sản phẩm trung gian đắt tiền (ảnh t2i, clip i2v, SFX) cache theo
 * hash prompt trong DATA_DIR — retry sau fail chỉ gen phần thiếu (completedSteps
 * pattern của content-factory, thực hiện bằng cache thay vì cờ).
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db';
import {
  ffmpeg, probe, probeFull, extractFrames, pixelFrameCheck, frozenCheck,
  measureLufs, maxBlackSpan, IMAGES_DIR, TMP_DIR,
} from './ffmpeg';
import { falImage, falImageToVideo, falKontext, falSfx, friendlyFalError, resetFalCostLog, getFalCostLog, recordExternalCost, videoEngine } from './fal';
import { ReelPlan, ReelSceneSpec } from './reel-director';
import { SKUS, PALETTE, REEL_GRADE_VF, SAFE } from './reel-template';
import { ensureBrandLibrary, brandLibRoot, clipCacheRoot, resolvePackshot, resolveLogo, resolveFonts } from './brand-library';
import { renderOverlayFramesHtml } from './render';
import { analyzeImage } from '../gemini';
import { logJob, progressJob } from '../jobs';

const FPS = 30;
const W = 1080, H = 1920;
const XF = 0.3;               // đề bài: cross-fade 0.3s, chỉ ở drink beauty / CTA
const CLIP_SKIP_S = 0.8;      // bỏ đoạn ramp-up đầu clip AI
const LN = 'loudnorm=I=-14:TP=-1.0:LRA=9';

const sha = (s: string) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);

function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

// ── M2: footage factory ────────────────────────────────────────────────

interface ClipQa { ok: boolean; reason?: string }

/** Gemini vision gate cho 1 frame clip AI — CODE quyết verdict theo checklist
 *  (VERIFY-GATE law: không tin verdict tổng của LLM). */
async function visionGate(framePath: string, scene: ReelSceneSpec, skuName: string): Promise<ClipQa> {
  try {
    const raw = await analyzeImage(fs.readFileSync(framePath), 'image/jpeg',
      `Inspect this AI-generated frame for a premium herbal tea reel (${skuName}). Answer ONLY JSON:
{"has_text_or_logo":bool,          // any readable letters, words, watermark, logo
 "wrong_subject":bool,             // subject clearly NOT: ${scene.prompt.slice(0, 140)}
 "unnatural":bool,                 // melted/warped glass, deformed hands, impossible liquid
 "neon_or_soda":bool,              // neon colors / soda-commercial / cocktail-party look
 "note":"short reason"}`);
    const m = raw.match(/\{[\s\S]*\}/);
    const v = JSON.parse(m ? m[0] : raw) as { has_text_or_logo?: boolean; wrong_subject?: boolean; unnatural?: boolean; neon_or_soda?: boolean; note?: string };
    if (v.has_text_or_logo) return { ok: false, reason: `chữ/logo AI trong hình (${v.note})` };
    if (v.wrong_subject) return { ok: false, reason: `sai chủ thể (${v.note})` };
    if (v.unnatural) return { ok: false, reason: `AI lỗi vật lý (${v.note})` };
    if (v.neon_or_soda) return { ok: false, reason: `neon/soda look (${v.note})` };
    return { ok: true };
  } catch (e) {
    // Gate hỏng ≠ clip hỏng — cho qua nhưng ghi log (không chặn pipeline vì Gemini chập chờn)
    console.warn('[reel] vision gate lỗi, cho qua:', String(e).slice(0, 120));
    return { ok: true, reason: 'gate-skipped' };
  }
}

/** Frozen check TINH cho clip AI: pixel-diff 64×64 gray giữa các frame — cảnh
 *  ASMR chuyển động nhỏ (garnish rơi) làm dhash 8×8 báo oan "đứng hình". */
async function reelFrozenCheck(frames: string[]): Promise<boolean> {
  if (frames.length < 2) return false;
  const sharp = (await import('sharp')).default;
  const grays: Buffer[] = [];
  for (const f of frames) {
    grays.push(await sharp(f).resize(64, 64, { fit: 'fill' }).grayscale().raw().toBuffer());
  }
  let maxDiff = 0;
  for (let i = 1; i < grays.length; i++) {
    let sum = 0;
    for (let p = 0; p < grays[i].length; p++) sum += Math.abs(grays[i][p] - grays[0][p]);
    maxDiff = Math.max(maxDiff, sum / grays[i].length);
  }
  return maxDiff < 1.5; // mọi frame gần như y hệt frame đầu = đứng hình thật
}

async function qaClip(file: string, scene: ReelSceneSpec, skuName: string, work: string): Promise<ClipQa> {
  const meta = await probe(file);
  if (meta.duration < 4.0) return { ok: false, reason: `clip ngắn ${meta.duration.toFixed(1)}s (<4s)` };
  const frames = await extractFrames(file, path.join(work, `qa_${scene.blockId}`), 3);
  const px = await pixelFrameCheck(frames);
  if (!px.ok) return { ok: false, reason: `frame hỏng: ${px.bad.map(b => b.reason).join(',')}` };
  if (await reelFrozenCheck(frames)) return { ok: false, reason: 'clip đứng hình' };
  return visionGate(frames[1], scene, skuName);
}

/** Engine ảnh: 'openai' (gpt-image-2 — bám prompt ổn định hơn, CẦN billing OpenAI
 *  còn hạn mức) | 'fal' (FLUX/Kontext, mặc định). OpenAI lỗi → tự fallback fal. */
function imageEngine(): 'openai' | 'fal' {
  return (process.env.REEL_IMAGE_ENGINE || 'fal').toLowerCase() === 'openai' ? 'openai' : 'fal';
}

function dataUrlToBuf(dataUrl: string): Buffer {
  return Buffer.from(dataUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64');
}

/** t2i theo engine. OpenAI fail (billing/quota) → log + fallback FLUX. */
async function engineT2I(prompt: string, jobId: string, label: string): Promise<Buffer> {
  if (imageEngine() === 'openai') {
    try {
      const { generateImage } = await import('../openai-image');
      const dataUrl = await generateImage({ prompt, size: '1024x1536', quality: 'medium' });
      recordExternalCost('gpt-image-2/t2i', '1024x1536 medium', 0.06);
      return dataUrlToBuf(dataUrl);
    } catch (e) {
      logJob(jobId, `${label}: OpenAI gen lỗi (${String(e).slice(0, 90)}) → fallback FLUX`);
    }
  }
  return falImage(prompt);
}

/** Edit-giữ-chủ-thể theo engine: gpt-image-2 images/edit hoặc FLUX Kontext. */
async function engineEdit(heroBuf: Buffer, instruction: string, work: string, jobId: string, label: string): Promise<Buffer> {
  if (imageEngine() === 'openai') {
    try {
      const { editProductImage } = await import('../openai-image');
      const tmp = path.join(work, `hero_for_edit.png`);
      if (!fs.existsSync(tmp)) fs.writeFileSync(tmp, heroBuf);
      const dataUrl = await editProductImage({ productImagePath: tmp, prompt: instruction, size: '1024x1536', quality: 'medium' });
      recordExternalCost('gpt-image-2/edit', '1024x1536 medium', 0.06);
      return dataUrlToBuf(dataUrl);
    } catch (e) {
      logJob(jobId, `${label}: OpenAI edit lỗi (${String(e).slice(0, 90)}) → fallback Kontext`);
    }
  }
  return falKontext(heroBuf, instruction);
}

/** Ảnh HERO của video — nguồn continuity duy nhất. Cache theo (sku, heroPrompt). */
async function getHeroImage(plan: ReelPlan, jobId: string): Promise<{ buf: Buffer; key: string }> {
  const key = sha(`hero|${imageEngine()}|${plan.sku}|${plan.heroPrompt}`);
  const cached = path.join(clipCacheRoot(), `img_hero_${key}.png`);
  if (fs.existsSync(cached)) return { buf: fs.readFileSync(cached), key };
  logJob(jobId, `HERO: tạo ảnh gốc continuity (${imageEngine()})…`);
  const buf = await engineT2I(plan.heroPrompt || '', jobId, 'HERO');
  fs.writeFileSync(cached, buf);
  return { buf, key };
}

/** Cảnh ly-là-chủ-thể (khung hình gần giống hero) → gate nghiêm: cùng ly + cùng
 *  bối cảnh. Cảnh cutaway (INGREDIENT_ACTION tay/nguyên liệu — khung tự nhiên
 *  khác) → chỉ bắt buộc đúng ly, lệch bối cảnh chỉ warn. */
const GATE_STRICT = new Set(['ICE_IMPACT', 'BREW_POUR', 'SUMMER_LIFT', 'RITUAL_PAYOFF']);

/** Consistency gate: ghép hero + frame scene cạnh nhau → Gemini trả lời CÙNG MỘT
 *  cái ly/mặt bàn/ánh sáng không. CODE quyết verdict (VERIFY-GATE law). */
async function consistencyGate(hero: Buffer, sceneFrame: Buffer, blockId: string): Promise<{ ok: boolean; note: string }> {
  try {
    const sharp = (await import('sharp')).default;
    const h = 640;
    const [a, b] = await Promise.all([
      sharp(hero).resize({ height: h }).toBuffer(),
      sharp(sceneFrame).resize({ height: h }).toBuffer(),
    ]);
    const wa = (await sharp(a).metadata()).width || 360;
    const wb = (await sharp(b).metadata()).width || 360;
    const combo = await sharp({ create: { width: wa + wb + 8, height: h, channels: 3, background: '#ffffff' } })
      .composite([{ input: a, left: 0, top: 0 }, { input: b, left: wa + 8, top: 0 }])
      .jpeg({ quality: 85 }).toBuffer();
    const raw = await analyzeImage(combo, 'image/jpeg',
      `LEFT = hero reference shot. RIGHT = another scene of the same video (${blockId} — the action/content SHOULD differ).
Judge ONLY physical continuity of the setting. Answer ONLY JSON:
{"same_glass":bool,     // same glass shape+material (fill level/contents MAY differ; if glass absent on right, true)
 "same_setting":bool,   // same surface + same lighting direction/mood
 "note":"short"}`);
    const m = raw.match(/\{[\s\S]*\}/);
    const v = JSON.parse(m ? m[0] : raw) as { same_glass?: boolean; same_setting?: boolean; note?: string };
    const strict = GATE_STRICT.has(blockId);
    const ok = strict
      ? Boolean(v.same_glass) && Boolean(v.same_setting)
      : Boolean(v.same_glass); // cutaway: khung hình được phép khác, ly phải đúng
    if (ok && strict === false && !v.same_setting) {
      console.warn(`[reel] ${blockId}: setting lệch nhẹ (cutaway, cho qua): ${v.note}`);
    }
    return { ok, note: v.note || '' };
  } catch (e) {
    console.warn('[reel] consistency gate lỗi, cho qua:', String(e).slice(0, 120));
    return { ok: true, note: 'gate-skipped' };
  }
}

/** Frame gốc cho 1 scene:
 *  - hasGlass + editInstruction → FLUX Kontext EDIT từ hero (giữ nguyên ly) + consistency gate
 *  - hasGlass, không edit (DRINK_BEAUTY) → dùng THẲNG hero
 *  - còn lại (không ly) → t2i tự do như cũ */
async function getSceneImage(scene: ReelSceneSpec, plan: ReelPlan, work: string, jobId: string, strengthen: string, forceNew: boolean): Promise<{ buf: Buffer; key: string }> {
  const cacheDir = clipCacheRoot();
  if (plan.heroPrompt && scene.hasGlass) {
    const hero = await getHeroImage(plan, jobId);
    if (!scene.editInstruction) return hero; // DRINK_BEAUTY = hero
    const strict = forceNew ? 'IMPORTANT: the glass MUST stay IDENTICAL in shape, size and material. ' : '';
    const key = sha(`edit|${imageEngine()}|${hero.key}|${scene.editInstruction}|${strict}`);
    const cached = path.join(cacheDir, `img_${key}.png`);
    if (!forceNew && fs.existsSync(cached)) return { buf: fs.readFileSync(cached), key };
    logJob(jobId, `${scene.blockId}: edit từ hero giữ nguyên ly (${imageEngine()})…`);
    const buf = await engineEdit(hero.buf, strict + scene.editInstruction, work, jobId, scene.blockId);
    const gate = await consistencyGate(hero.buf, buf, scene.blockId);
    if (!gate.ok) {
      logJob(jobId, `${scene.blockId}: ⚠ consistency FAIL (${gate.note}) — edit lại với lệnh cứng hơn`);
      const buf2 = await engineEdit(hero.buf, 'IMPORTANT: the glass MUST stay IDENTICAL in shape, size, material and position. ' + scene.editInstruction, work, jobId, scene.blockId);
      const gate2 = await consistencyGate(hero.buf, buf2, scene.blockId);
      if (!gate2.ok) throw new Error(`${scene.blockId}: 2 lần edit vẫn lệch continuity (${gate2.note}) — chạy lại video hoặc đổi prompt`);
      fs.writeFileSync(cached, buf2);
      return { buf: buf2, key };
    }
    fs.writeFileSync(cached, buf);
    return { buf, key };
  }
  // scene không có ly → t2i tự do
  const key = sha(`t2i|${imageEngine()}|${scene.imagePrompt}${strengthen}`);
  const cached = path.join(cacheDir, `img_${key}.png`);
  if (!forceNew && fs.existsSync(cached)) return { buf: fs.readFileSync(cached), key };
  logJob(jobId, `${scene.blockId}: tạo frame gốc (${imageEngine()})…`);
  const buf = await engineT2I(scene.imagePrompt + strengthen, jobId, scene.blockId);
  fs.writeFileSync(cached, buf);
  return { buf, key };
}

/** Gen 1 scene clip (cache theo hash prompt + ẢNH GỐC — đổi ảnh là clip mới). */
async function generateSceneClip(scene: ReelSceneSpec, plan: ReelPlan, work: string, jobId: string): Promise<string> {
  const cacheDir = clipCacheRoot();
  const skuName = plan.profile?.productName || SKUS[plan.sku]?.name || plan.sku;

  for (let attempt = 0; attempt < 2; attempt++) {
    const strengthen = attempt === 1 ? ' STRICTLY: no letters of any kind, natural realistic beverage, physically correct.' : '';
    const img = await getSceneImage(scene, plan, work, jobId, strengthen, attempt === 1);
    const ve = videoEngine();
    const key = sha(`i2v|${ve}|${img.key}|${scene.prompt}`);
    const cached = path.join(cacheDir, `clip_${key}.mp4`);
    if (attempt === 0 && fs.existsSync(cached) && fs.statSync(cached).size > 100_000) {
      logJob(jobId, `${scene.blockId}: dùng cache ${key}`);
      return cached;
    }
    logJob(jobId, `${scene.blockId}: image→video (${ve})${attempt ? ' — retry' : ''}…`);
    let video: Buffer;
    try {
      // Ép motion rõ — i2v từ ảnh tĩnh đẹp dễ ra clip gần như đứng hình
      video = await falImageToVideo(img.buf, scene.prompt + strengthen + ' Clear continuous visible motion throughout the whole clip, never a static freeze-frame.');
    } catch (e) {
      logJob(jobId, `${scene.blockId}: fal lỗi — ${friendlyFalError(e)}`);
      if (attempt === 1) throw e;
      continue; // transient (timeout/queue) → thử lại vòng 2
    }
    const tmp = path.join(work, `gen_${scene.blockId}_${attempt}.mp4`);
    fs.writeFileSync(tmp, video);
    const qa = await qaClip(tmp, scene, skuName, work);
    if (qa.ok) {
      fs.copyFileSync(tmp, cached);
      logJob(jobId, `${scene.blockId}: QA pass${qa.reason === 'gate-skipped' ? ' (vision gate offline)' : ''}`);
      return cached;
    }
    logJob(jobId, `${scene.blockId}: QA FAIL — ${qa.reason}`);
    if (attempt === 1) throw new Error(`${scene.blockId}: clip AI fail QA 2 lần (${qa.reason})`);
  }
  throw new Error('unreachable');
}

// ── M3: encode + assembly ──────────────────────────────────────────────

/** Cắt đoạn đẹp từ clip 6s + encode uniform 1080×1920@30 với grade template. */
async function encodeSceneSegment(src: string, scene: ReelSceneSpec, out: string, gradeVf?: string): Promise<number> {
  const need = Math.round(((scene.end - scene.start) + (scene.transitionOut === 'xfade' ? XF : 0)) * 10) / 10;
  const meta = await probe(src);
  const start = Math.min(CLIP_SKIP_S, Math.max(0, meta.duration - need - 0.1));
  await ffmpeg([
    '-ss', start.toFixed(2), '-t', need.toFixed(3), '-i', src,
    '-vf', `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},${gradeVf || REEL_GRADE_VF}`,
    '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', out,
  ]);
  return need;
}

/** End card 1.2s: packshot alpha + logo + CTA trên Cotton Cream, zoom 1.0→1.04.
 *  Chữ render bằng font brand THẬT qua Chromium — đúng luật "AI không vẽ chữ". */
async function buildEndCard(brandId: string, plan: ReelPlan, ctaText: string, durS: number, work: string, out: string): Promise<void> {
  const slug = plan.profile?.productSlug || SKUS[plan.sku]?.productSlug || '';
  const pack = resolvePackshot(brandId, plan.sku, slug);
  const logo = resolveLogo(brandId);
  const fonts = resolveFonts(brandId);
  const fontFace = (name: string, file: string | null) => file
    ? `@font-face{font-family:'${name}';src:url(data:font/${file.endsWith('.otf') ? 'otf' : 'ttf'};base64,${fs.readFileSync(file).toString('base64')});}`
    : '';
  const packB64 = pack ? `data:image/png;base64,${fs.readFileSync(pack).toString('base64')}` : '';
  const logoB64 = logo ? `data:image/png;base64,${fs.readFileSync(logo).toString('base64')}` : '';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  ${fontFace('BrandHead', fonts.headline)} ${fontFace('BrandSub', fonts.sub)}
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:540px;height:960px;background:${PALETTE.cream};overflow:hidden;
    font-family:'BrandSub','Noto Sans',sans-serif}
  .logo{position:absolute;top:120px;left:50%;transform:translateX(-50%);width:110px}
  .pack{position:absolute;top:230px;left:50%;transform:translateX(-50%);width:330px;
    filter:drop-shadow(0 14px 28px rgba(45,45,45,.18))}
  .cta{position:absolute;bottom:290px;left:45px;right:45px;text-align:center;
    font-family:'BrandHead','Noto Sans',sans-serif;font-weight:700;font-size:37px;
    line-height:1.25;color:${PALETTE.green}}
  .sub{position:absolute;bottom:245px;left:45px;right:45px;text-align:center;
    font-size:17px;color:${PALETTE.earth};opacity:.85}
  </style></head><body>
  ${logoB64 ? `<img class="logo" src="${logoB64}">` : ''}
  ${packB64 ? `<img class="pack" src="${packB64}">` : ''}
  <div class="cta">${esc(ctaText)}</div>
  <div class="sub">with LoveinTea</div>
  <script>window.SEEK=function(){};</script></body></html>`;

  // 1 frame PNG là đủ — chuyển động tạo bằng zoompan
  const frameDir = path.join(work, 'endcard');
  fs.mkdirSync(frameDir, { recursive: true });
  const { default: puppeteer } = await import('puppeteer-core');
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 540, height: 960, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await page.screenshot({ path: path.join(frameDir, 'card.png') });
  } finally { await browser.close(); }

  const frames = Math.round(durS * FPS);
  await ffmpeg([
    '-i', path.join(frameDir, 'card.png'),
    '-vf', `scale=${W * 2}:${H * 2},zoompan=z='1+0.04*on/${frames}':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS}`,
    '-frames:v', String(frames), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', out,
  ]);
}

/** Ghép segments trong MỘT filter graph (1 lần encode duy nhất — không generation
 *  loss): trong nhóm hard/match cut = concat; giữa các nhóm = xfade 0.3s. */
async function assemble(segs: Array<{ file: string; dur: number; transitionOut: string }>, work: string, out: string): Promise<number> {
  const groups: number[][] = [[0]];
  for (let i = 1; i < segs.length; i++) {
    if (segs[i - 1].transitionOut === 'xfade') groups.push([i]);
    else groups[groups.length - 1].push(i);
  }
  const inputs: string[] = [];
  segs.forEach(s => inputs.push('-i', s.file));
  const parts: string[] = [];
  const groupLabels: string[] = [];
  const groupDurs: number[] = [];
  groups.forEach((g, gi) => {
    const lbl = `[g${gi}]`;
    // settb=AVTB: xfade BẮT BUỘC 2 input cùng timebase (end card từ PNG ra
    // tb 1/1000000, clip h264 1/15360 — không ép là fail).
    if (g.length === 1) parts.push(`[${g[0]}:v]settb=AVTB,fps=${FPS}${lbl}`);
    else parts.push(g.map(i => `[${i}:v]`).join('') + `concat=n=${g.length}:v=1:a=0,settb=AVTB,fps=${FPS}${lbl}`);
    groupLabels.push(lbl);
    groupDurs.push(g.reduce((a, i) => a + segs[i].dur, 0));
  });
  let prev = groupLabels[0];
  let acc = groupDurs[0];
  for (let gi = 1; gi < groups.length; gi++) {
    const last = gi === groups.length - 1;
    const label = last ? '[v]' : `[x${gi}]`;
    parts.push(`${prev}${groupLabels[gi]}xfade=transition=fade:duration=${XF}:offset=${Math.max(0, acc - XF).toFixed(3)}${last ? '' : ',settb=AVTB,fps=' + FPS}${label}`);
    acc = acc + groupDurs[gi] - XF;
    prev = label;
  }
  await ffmpeg([
    ...inputs, '-filter_complex', parts.join(';'),
    '-map', groups.length === 1 ? groupLabels[0] : '[v]',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', out,
  ]);
  return acc;
}

// ── M4: text overlay (max 3, font brand, safe zone) ────────────────────

function reelOverlayHtml(plan: ReelPlan, durationMs: number, fonts: { headline: string | null; sub: string | null }): string {
  const fontFace = (name: string, file: string | null) => file
    ? `@font-face{font-family:'${name}';src:url(data:font/${file.endsWith('.otf') ? 'otf' : 'ttf'};base64,${fs.readFileSync(file).toString('base64')});}`
    : '';
  // CTA nằm trên end card rồi — overlay chỉ hook + micro (≤2), trong text zone y=160-690 (540-space)
  const texts = plan.textOverlays.filter(t => t.role !== 'cta').slice(0, SAFE.maxTexts - 1).map(t => {
    const scene = plan.scenes.find(s => s.blockId === t.blockId);
    return scene ? {
      text: t.text, role: t.role,
      startMs: scene.start * 1000 + 200,
      endMs: scene.end * 1000 - 100,
    } : null;
  }).filter(Boolean) as Array<{ text: string; role: string; startMs: number; endMs: number }>;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  ${fontFace('BrandHead', fonts.headline)} ${fontFace('BrandSub', fonts.sub)}
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:540px;height:960px;background:transparent;overflow:hidden}
  .t{position:absolute;left:45px;right:45px;text-align:center;opacity:0}
  .hook{top:190px;font-family:'BrandHead','Noto Sans',sans-serif;font-weight:700;
    font-size:37px;line-height:1.22;color:#fff;
    text-shadow:0 2px 10px rgba(45,45,45,.35)}
  .micro{top:600px;font-family:'BrandSub','Noto Sans',sans-serif;font-weight:700;font-size:20px;line-height:1.4}
  .micro span{background:rgba(255,248,240,.86);color:${PALETTE.earth};padding:7px 16px;
    border-radius:20px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
  </style></head><body>
  ${texts.map((t, i) => `<div class="t ${t.role === 'hook' ? 'hook' : 'micro'}" id="tx${i}">${t.role === 'hook' ? esc(t.text) : `<span>${esc(t.text)}</span>`}</div>`).join('')}
  <script>
  const T=${JSON.stringify(texts.map(t => ({ s: t.startMs, e: t.endMs })))};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const ease=t=>1-Math.pow(1-t,3);
  window.SEEK=function(ms){
    for(let i=0;i<T.length;i++){
      const el=document.getElementById('tx'+i); const t=T[i];
      let o=0,y=0;
      if(ms>=t.s&&ms<t.e){
        const ti=ease(clamp((ms-t.s)/260,0,1));
        const to=1-clamp((ms-(t.e-220))/220,0,1);
        o=Math.min(ti,to); y=(1-ti)*14;
      }
      el.style.opacity=o; el.style.transform='translateY('+y+'px)';
    }
  };
  </script></body></html>`;
}

// ── M5: audio ──────────────────────────────────────────────────────────

async function resolveSfx(brandId: string, prompt: string, durS: number, jobId: string): Promise<string | null> {
  const dir = path.join(brandLibRoot(brandId), 'AUDIO', 'SFX', 'AI_ASMR');
  const f = path.join(dir, `sfx_${sha(prompt)}.mp3`);
  if (fs.existsSync(f)) return f;
  try {
    logJob(jobId, `SFX gen: ${prompt.slice(0, 50)}…`);
    fs.writeFileSync(f, await falSfx(prompt, durS));
    return f;
  } catch (e) {
    logJob(jobId, `⚠ SFX fail (bỏ qua block này): ${friendlyFalError(e)}`);
    return null;
  }
}

async function resolveBgm(brandId: string, jobId: string): Promise<string | null> {
  const db = getDb();
  const track = db.prepare(
    `SELECT id, filename FROM bgm_tracks WHERE brand_id=? AND status='ready' ORDER BY use_count ASC, RANDOM() LIMIT 1`
  ).get(brandId) as { id: string; filename: string } | undefined;
  if (track?.filename) {
    const f = path.join(IMAGES_DIR, track.filename);
    if (fs.existsSync(f)) {
      db.prepare('UPDATE bgm_tracks SET use_count=use_count+1 WHERE id=?').run(track.id);
      return f;
    }
  }
  // Kho trống → gen 1 lần BGM pool (Phiếu D: soft summer chill, không vocal)
  const dir = path.join(brandLibRoot(brandId), 'AUDIO', 'BGM');
  const pooled = path.join(dir, 'generated_soft_summer_01.mp3');
  if (fs.existsSync(pooled)) return pooled;
  try {
    logJob(jobId, 'BGM kho trống — gen soft summer chill (1 lần, tái dùng)…');
    fs.writeFileSync(pooled, await falSfx('soft summer chill background music, light acoustic guitar and warm minimal beat, airy botanical mood, gentle loop, no vocals', 14));
    return pooled;
  } catch (e) {
    logJob(jobId, `⚠ BGM gen fail (video chỉ còn SFX): ${friendlyFalError(e)}`);
    return null;
  }
}

/** Mix audio: BGM nền + SFX từng block (adelay), amix 2-input TUẦN TỰ, loudnorm -14. */
async function mixAudio(videoIn: string, durS: number, sfxList: Array<{ file: string; startS: number; lenS: number }>, bgm: string | null, out: string): Promise<void> {
  const D = durS.toFixed(2);
  const inputs: string[] = ['-i', videoIn];
  const chains: string[] = [];
  let idx = 1;

  // base: BGM (volume thấp để ASMR nổi — Phiếu D) hoặc silence
  let base: string;
  if (bgm) {
    inputs.push('-stream_loop', '-1', '-i', bgm);
    chains.push(`[${idx}:a]volume=0.28,atrim=0:${D},afade=t=in:st=0:d=0.4,afade=t=out:st=${Math.max(0, durS - 0.6).toFixed(2)}:d=0.6[base]`);
    base = '[base]';
    idx++;
  } else {
    chains.push(`anullsrc=channel_layout=stereo:sample_rate=44100,atrim=0:${D}[base]`);
    base = '[base]';
  }

  let cur = base;
  sfxList.forEach((s, i) => {
    inputs.push('-i', s.file);
    const delay = Math.round(s.startS * 1000);
    const lbl = `[sx${i}]`, mixed = `[m${i}]`;
    chains.push(`[${idx}:a]volume=0.9,atrim=0:${(s.lenS + 0.4).toFixed(2)},afade=t=out:st=${s.lenS.toFixed(2)}:d=0.35,adelay=${delay}|${delay}${lbl}`);
    chains.push(`${cur}${lbl}amix=inputs=2:duration=first:normalize=0${mixed}`);
    cur = mixed;
    idx++;
  });
  chains.push(`${cur}${LN}[a]`);

  await ffmpeg([
    ...inputs, '-filter_complex', chains.join(';'),
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-t', D, out,
  ]);
}

// ── M6: orchestrator ───────────────────────────────────────────────────

export async function renderReelProject(projectId: string): Promise<void> {
  const db = getDb();
  const logs: string[] = [];
  const log = (m: string) => { logs.push(`[${new Date().toISOString().slice(11, 19)}] ${m}`); console.log('[reel]', m); };
  const project = db.prepare('SELECT * FROM video_projects WHERE id=?').get(projectId) as Record<string, string | number | null> | undefined;
  if (!project) throw new Error('project not found');
  const brandId = String(project.brand_id || 'loveintea');
  const jobId = String(project.batch_id || '');   // batch_id giữ job id của Job Queue

  const saveLog = (status: string, extra: Record<string, string | null> = {}) => {
    db.prepare(`UPDATE video_projects SET status=?, render_log=?, output_url=COALESCE(?, output_url), error=?, updated_at=datetime('now') WHERE id=?`)
      .run(status, logs.join('\n'), extra.output_url ?? null, extra.error ?? null, projectId);
  };

  const work = path.join(TMP_DIR, `reel_${projectId}`);
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });

  try {
    ensureBrandLibrary(brandId);
    resetFalCostLog(); // chi phí THỰC: đếm từng call fal của run này
    const plan = JSON.parse(String(project.script_json || '{}')) as ReelPlan;
    if (!plan.scenes?.length) throw new Error('ReelPlan trống — tạo lại từ API /api/video/reel');
    const prodName = plan.profile?.productName || SKUS[plan.sku]?.name || plan.sku;
    const prodSlug = plan.profile?.productSlug || SKUS[plan.sku]?.productSlug || 'video';
    log(`ReelPlan ${plan.template} ${prodName} SKU=${plan.sku} type=${plan.videoType} ${plan.scenes.length} scene ${plan.versionLabel}`);

    // M2 — gen clip AI (tuần tự — server 2 vCPU, tránh RAM spike; cache làm version 2-3 gần free)
    const aiScenes = plan.scenes.filter(s => s.kind === 'ai');
    const segs: Array<{ file: string; dur: number; transitionOut: string }> = [];
    let done = 0;
    for (const scene of plan.scenes) {
      const segOut = path.join(work, `seg_${scene.blockId}.mp4`);
      if (scene.kind === 'endcard') {
        await buildEndCard(brandId, plan, plan.ctaText, scene.end - scene.start, work, segOut);
        segs.push({ file: segOut, dur: scene.end - scene.start, transitionOut: scene.transitionOut });
        log(`${scene.blockId}: end card composite (packshot thật)`);
      } else {
        let src: string;
        try {
          src = await generateSceneClip(scene, plan, work, jobId);
        } catch (e) {
          throw new Error(`${scene.blockId}: ${friendlyFalError(e)}`);
        }
        const dur = await encodeSceneSegment(src, scene, segOut, plan.gradeVf);
        segs.push({ file: segOut, dur, transitionOut: scene.transitionOut });
        log(`${scene.blockId}: clip ok (${dur}s)`);
      }
      done++;
      progressJob(jobId, Math.round((done / plan.scenes.length) * 55));
    }

    // M3 — assembly
    const bg = path.join(work, 'assembled.mp4');
    const durS = await assemble(segs, work, bg);
    log(`assembly: ${durS.toFixed(2)}s (${aiScenes.length} AI + end card)`);
    progressJob(jobId, 62);

    // M4 — text overlay bằng font brand (nếu có text)
    const fonts = resolveFonts(brandId);
    let composited = bg;
    const overlayTexts = plan.textOverlays.filter(t => t.role !== 'cta');
    if (overlayTexts.length) {
      const totalFrames = Math.round(durS * FPS);
      log(`overlay: ${overlayTexts.length} text (font ${fonts.headline ? 'brand' : 'fallback'}), ${totalFrames} frames…`);
      await renderOverlayFramesHtml(reelOverlayHtml(plan, durS * 1000, fonts), path.join(work, 'ovframes'), totalFrames);
      composited = path.join(work, 'composited.mp4');
      await ffmpeg([
        '-i', bg, '-framerate', String(FPS), '-i', path.join(work, 'ovframes', 'f_%05d.png'),
        '-filter_complex', '[0:v][1:v]overlay=0:0:format=auto[v]',
        '-map', '[v]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', composited,
      ]);
    }
    progressJob(jobId, 72);

    // M5 — audio: SFX theo block + BGM
    const sfxList: Array<{ file: string; startS: number; lenS: number }> = [];
    for (const scene of plan.scenes) {
      const f = await resolveSfx(brandId, scene.sfxPrompt, (scene.end - scene.start) + 0.4, jobId);
      if (f) sfxList.push({ file: f, startS: scene.start, lenS: scene.end - scene.start });
    }
    const bgm = await resolveBgm(brandId, jobId);
    const final = path.join(work, 'final.mp4');
    await mixAudio(composited, durS, sfxList, bgm, final);
    log(`audio: ${sfxList.length} SFX + BGM=${bgm ? path.basename(bgm) : 'none'} → loudnorm -14`);
    progressJob(jobId, 84);

    // M6 — QA gates (đề bài + chuẩn render.ts)
    const qaFrames = await extractFrames(final, path.join(work, 'qa_final'), 8);
    const px = await pixelFrameCheck(qaFrames);
    if (!px.ok) throw new Error(`QA blank frames: ${px.bad.map(b => b.reason).join(', ')}`);
    if (await frozenCheck(qaFrames)) throw new Error('QA frozen video');
    const fMeta = await probeFull(final);
    if (fMeta.width !== W || fMeta.height !== H) throw new Error(`QA resolution ${fMeta.width}x${fMeta.height}`);
    if (fMeta.duration < 8 || fMeta.duration > 12.5) throw new Error(`QA duration ${fMeta.duration.toFixed(1)}s ngoài 8-12s (đề bài)`);
    if (fMeta.bitrateKbps && fMeta.bitrateKbps < 600) throw new Error(`QA bitrate ${fMeta.bitrateKbps}kbps`);
    if (!fMeta.hasAudio) throw new Error('QA: thiếu audio stream');
    const blackSpan = await maxBlackSpan(final);
    if (blackSpan > 0.5) throw new Error(`QA màn đen ${blackSpan.toFixed(1)}s (đề bài cấm >0.2s)`);
    if (blackSpan > 0.2) log(`⚠ black span ${blackSpan.toFixed(2)}s hơi quá 0.2s`);
    const lufs = await measureLufs(final);
    log(`QA pass: ${fMeta.duration.toFixed(1)}s ${fMeta.bitrateKbps}kbps${lufs != null ? ` ${lufs.toFixed(1)} LUFS` : ''} black=${blackSpan.toFixed(2)}s`);
    progressJob(jobId, 90);

    // Thumbnail: frame đẹp nhất từ DRINK_BEAUTY (giữa block) — Phiếu A yêu cầu kèm thumbnail
    const beauty = plan.scenes.find(s => s.blockId === 'DRINK_BEAUTY') || plan.scenes[plan.scenes.length - 2];
    const thumbT = beauty ? (beauty.start + beauty.end) / 2 : durS * 0.7;
    const thumbName = `reelthumb_${projectId}_${crypto.randomBytes(4).toString('hex')}.jpg`;
    await ffmpeg(['-ss', thumbT.toFixed(2), '-i', final, '-vframes', '1', '-q:v', '2', path.join(IMAGES_DIR, thumbName)]);
    const thumbUrl = `/api/images/${thumbName}`;

    // Publish: video vào assets + post draft ở Review & Queue (Phiếu A: hàng chờ duyệt)
    const outName = `reel_${projectId}_${crypto.randomBytes(4).toString('hex')}.mp4`;
    fs.copyFileSync(final, path.join(IMAGES_DIR, outName));
    const outputUrl = `/api/images/${outName}`;
    db.prepare(`INSERT OR IGNORE INTO assets (id, brand_id, url, filename, file_type, status, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'video', 'unused', 'generated', datetime('now'), datetime('now'))`)
      .run(uuid(), brandId, outputUrl, outName);

    const caption = await buildReelCaption(brandId, plan);
    const dna = db.prepare('SELECT hashtags FROM brand_dna WHERE brand_id=?').get(brandId) as { hashtags: string } | undefined;
    let hashtags = '';
    try { hashtags = (JSON.parse(dna?.hashtags || '[]') as string[]).slice(0, 8).join(' '); } catch { /* */ }
    db.prepare(`INSERT INTO posts
      (id, sku_id, caption, hashtags, platforms, status, brand_id, video_url, image_url, notes, review_status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(uuid(), prodSlug, caption, hashtags, 'facebook,instagram',
        'draft', brandId, outputUrl, thumbUrl,
        `🧊 Reel AI ${plan.versionLabel} — ${plan.template} SKU ${plan.sku} — project ${projectId}`, 'pending');
    // Chi phí THỰC của run này: từng call fal × đơn giá verified (cache hit = $0)
    const cost = getFalCostLog();
    const byModel = cost.items.reduce<Record<string, { n: number; usd: number }>>((a, c) => {
      a[c.model] = { n: (a[c.model]?.n ?? 0) + 1, usd: Math.round(((a[c.model]?.usd ?? 0) + c.usd) * 10000) / 10000 };
      return a;
    }, {});
    log(`💰 CHI PHÍ THỰC run này: $${cost.totalUsd} — ${Object.entries(byModel).map(([m, v]) => `${m}×${v.n}=$${v.usd}`).join(', ') || 'cache 100% ($0)'}`);
    try {
      db.prepare(`UPDATE jobs SET result_json=? WHERE id=?`).run(
        JSON.stringify({ output_url: outputUrl, cost_usd: cost.totalUsd, cost_breakdown: byModel }), jobId);
      db.prepare(`UPDATE video_projects SET grade_json=? WHERE id=?`).run(
        JSON.stringify({ cost_usd: cost.totalUsd, cost_items: cost.items }), projectId);
    } catch { /* cost tracking là phụ trợ */ }
    log(`published: ${outputUrl} + thumbnail + post draft (Review & Queue)`);
    saveLog('done', { output_url: outputUrl });
    progressJob(jobId, 100);
  } catch (e) {
    const cost = getFalCostLog();
    log(`💰 CHI PHÍ THỰC đã tiêu trước khi fail: $${cost.totalUsd} (${cost.items.length} call fal — clip đã cache sẽ tái dùng khi retry)`);
    log(`FAILED: ${e}`);
    saveLog('failed', { error: String(e).slice(0, 500) });
    throw e;
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

/** Caption theo brand language + claim-safe (Phiếu D: tone modern peer, không salesy). */
async function buildReelCaption(brandId: string, plan: ReelPlan): Promise<string> {
  const prof = plan.profile || (SKUS[plan.sku] ? {
    productName: SKUS[plan.sku].name, moment: SKUS[plan.sku].moment,
  } : { productName: plan.sku, moment: '' });
  try {
    const { generateJSON } = await import('../gemini');
    const { resolveLangName } = await import('../brand-lang');
    const lang = resolveLangName(undefined, brandId);
    const r = await generateJSON<{ caption: string }>(
      `Write ONE Instagram Reel caption in ${lang} for the beverage product "${prof.productName}" (${prof.moment}).
Brief: ${plan.captionHint.slice(0, 250)}
Tone: modern peer, warm, premium, NOT salesy, no urgency words, NO health claims (no cure/detox/weight-loss).
2-3 short lines + soft ending "${plan.ctaText}". Return ONLY JSON {"caption":"..."}`
    );
    if (r.caption) return String(r.caption).slice(0, 900);
  } catch { /* fallback */ }
  return `${prof.productName} iced. ${plan.ctaText} 🍃`;
}

/**
 * Renderer cho template bazan_recipe — khác renderer chuẩn ở 3 điểm cốt lõi
 * (bám đúng final thật của Bazan):
 *  1. HARD CUT (không crossfade) + GIỮ TIẾNG THẬT của clip (ASMR đá/rót/khuấy)
 *  2. Color grade theo bộ thông số của lô (grade_json — thang app ảnh -100..100)
 *  3. Overlay kiểu Bazan: tên món 2 dòng ở hook, brand line ở shot sản phẩm,
 *     caption nguyên liệu ở bước pha chế, KHÔNG text ở result.
 */
import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db';
import { ffmpeg, probeFull, probe, extractFrames, pixelFrameCheck, frozenCheck, measureLufs, maxBlackSpan, IMAGES_DIR, TMP_DIR } from './ffmpeg';
import { RecipeStoryboard, gradeFilter, GradeParams } from './recipe-workflow';
import { recipeOverlayHtml } from './overlay-recipe';
import { renderOverlayFramesHtml } from './render';

const FPS = 30;
const W = 1080, H = 1920;
const LN = 'loudnorm=I=-14:TP=-1.0:LRA=9';

function log(lines: string[], msg: string) {
  lines.push(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
  console.log('[recipe-render]', msg);
}

export async function renderRecipeProject(projectId: string): Promise<void> {
  const db = getDb();
  const logs: string[] = [];
  const project = db.prepare('SELECT * FROM video_projects WHERE id=?').get(projectId) as Record<string, string | number | null> | undefined;
  if (!project) throw new Error('project not found');

  const saveLog = (status: string, extra: Record<string, string | null> = {}) => {
    db.prepare(`UPDATE video_projects SET status=?, render_log=?, output_url=COALESCE(?, output_url), error=?, updated_at=datetime('now') WHERE id=?`)
      .run(status, logs.join('\n'), extra.output_url ?? null, extra.error ?? null, projectId);
  };

  const work = path.join(TMP_DIR, projectId);
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });

  try {
    const board = JSON.parse(String(project.script_json || '{}')) as RecipeStoryboard;
    if (!board.segments?.length) throw new Error('Recipe storyboard empty');
    const brandId = String(project.brand_id || 'loveintea');

    let grade: GradeParams | null = null;
    try { grade = JSON.parse(String(project.grade_json || 'null')) as GradeParams | null; } catch { /* default */ }
    const gradeVf = gradeFilter(grade);
    log(logs, `grade: ${gradeVf.slice(0, 120)}…`);

    // ── S2/S4: encode từng segment (giữ audio thật) rồi concat hard-cut ──
    const listFile = path.join(work, 'concat.txt');
    const listLines: string[] = [];
    for (let i = 0; i < board.segments.length; i++) {
      const seg = board.segments[i];
      const clip = db.prepare('SELECT filename, duration_s FROM video_clips WHERE id=?').get(seg.clip_id) as { filename: string; duration_s: number } | undefined;
      if (!clip) throw new Error(`seg${i}: clip ${seg.clip_id} không tồn tại`);
      const input = path.join(IMAGES_DIR, clip.filename);
      if (!fs.existsSync(input)) throw new Error(`seg${i}: file ${clip.filename} không còn trên đĩa`);
      // Kẹp lại lần cuối theo duration thật (storyboard có thể được sửa tay)
      const dur = Math.max(0.8, Math.min(seg.dur_s, clip.duration_s - 0.05));
      const start = Math.max(0, Math.min(seg.start_s || 0, Math.max(0, clip.duration_s - dur - 0.05)));
      const out = path.join(work, `seg_${i}.mp4`);

      const meta = await probeFull(input);
      const vf = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS}` + (gradeVf ? `,${gradeVf}` : '');
      if (meta.hasAudio) {
        await ffmpeg([
          '-ss', start.toFixed(3), '-i', input, '-t', dur.toFixed(3),
          '-vf', vf, '-af', 'apad,aresample=44100', '-ac', '2',
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p',
          '-c:a', 'aac', '-b:a', '160k', out,
        ]);
      } else {
        // clip câm → lót silence để concat đồng nhất stream layout
        await ffmpeg([
          '-ss', start.toFixed(3), '-i', input, '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
          '-t', dur.toFixed(3), '-map', '0:v:0', '-map', '1:a:0', '-vf', vf, '-ac', '2',
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p',
          '-c:a', 'aac', '-b:a', '160k', out,
        ]);
      }
      listLines.push(`file '${out.replace(/'/g, "'\\''")}'`);
      log(logs, `seg${i}: ${seg.role} ${dur.toFixed(1)}s (in ${start.toFixed(1)}s, audio=${meta.hasAudio})`);
    }
    fs.writeFileSync(listFile, listLines.join('\n'));
    const bg = path.join(work, 'bg.mp4');
    await ffmpeg(['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', bg]);
    const durS = (await probe(bg)).duration;
    log(logs, `bg track: ${durS.toFixed(2)}s (${board.segments.length} hard cuts, natural audio)`);

    // ── S5: overlay windows theo timeline thật ──
    const dna = db.prepare('SELECT colors_json FROM brand_dna WHERE brand_id=?').get(brandId) as { colors_json: string } | undefined;
    let accent = '#FFE14D'; // vàng kiểu Bazan mặc định
    try {
      const c = JSON.parse(dna?.colors_json || '{}') as Record<string, string>;
      const vals = Object.values(c);
      if (vals.length >= 2) accent = vals[1];
    } catch { /* default */ }

    let cursor = 0;
    const windows: Array<{ startMs: number; endMs: number; kind: 'dish' | 'brand' | 'step' | 'none'; text?: string }> = [];
    for (const seg of board.segments) {
      const startMs = cursor * 1000, endMs = (cursor + seg.dur_s) * 1000;
      cursor += seg.dur_s;
      if (seg.role === 'hook_final') windows.push({ startMs, endMs, kind: 'dish' });
      else if ((seg.role === 'product' || seg.role === 'brewing') && (board.brand_line1 || board.brand_line2))
        windows.push({ startMs, endMs, kind: 'brand' });
      else if (seg.role === 'process' && seg.text) windows.push({ startMs, endMs, kind: 'step', text: seg.text });
    }
    const totalFrames = Math.round(durS * FPS);
    log(logs, `overlay: ${windows.length} text windows, ${totalFrames} frames…`);
    await renderOverlayFramesHtml(
      recipeOverlayHtml({
        durationMs: durS * 1000,
        dishLine1: board.dish_line1, dishLine2: board.dish_line2,
        brandLine1: board.brand_line1, brandLine2: board.brand_line2,
        accent, windows,
      }),
      path.join(work, 'frames'), totalFrames
    );

    // ── S6: composite overlay + mix tiếng thật (+ BGM nhẹ nếu chọn) ──
    const final = path.join(work, 'final.mp4');
    const overlayInput = path.join(work, 'frames', 'f_%05d.png');
    const D = durS.toFixed(2);
    const fadeStart = Math.max(0, durS - 1).toFixed(2);
    const bgmFile = project.bgm_url
      ? path.join(IMAGES_DIR, String(project.bgm_url).replace('/api/images/', ''))
      : null;
    const hasBgm = Boolean(bgmFile && fs.existsSync(bgmFile));
    const vOverlay = '[0:v][1:v]overlay=0:0:format=auto[v]';
    const baseInputs = ['-i', bg, '-framerate', String(FPS), '-i', overlayInput];

    if (hasBgm) {
      // BGM lót dưới tiếng thật: volume thấp, không ducking phức tạp (ASMR là chính)
      await ffmpeg([
        ...baseInputs, '-i', bgmFile!,
        '-filter_complex',
        `${vOverlay};[2:a]volume=0.22,atrim=0:${D},afade=t=out:st=${fadeStart}:d=1[bgm];` +
        `[0:a][bgm]amix=inputs=2:duration=first:normalize=0[mx];[mx]${LN}[a]`,
        '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19',
        '-pix_fmt', 'yuv420p', '-r', String(FPS), '-c:a', 'aac', '-b:a', '160k', '-t', D, final,
      ]);
    } else {
      await ffmpeg([
        ...baseInputs,
        '-filter_complex', `${vOverlay};[0:a]${LN}[a]`,
        '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19',
        '-pix_fmt', 'yuv420p', '-r', String(FPS), '-c:a', 'aac', '-b:a', '160k', '-t', D, final,
      ]);
    }
    log(logs, `composite done (bgm=${hasBgm}, natural audio)`);

    // ── S7: QA gates (như renderer chuẩn) ──
    const qaFrames = await extractFrames(final, path.join(work, 'qa'), 6);
    const px = await pixelFrameCheck(qaFrames);
    if (!px.ok) throw new Error(`QA blank frames: ${px.bad.map(b => b.reason).join(', ')}`);
    if (await frozenCheck(qaFrames)) throw new Error('QA frozen: sampled frames identical');
    const fMeta = await probeFull(final);
    if (fMeta.width !== W || fMeta.height !== H) throw new Error(`QA resolution: ${fMeta.width}x${fMeta.height}`);
    if (Math.abs(fMeta.duration - durS) > Math.max(2, durS * 0.1)) throw new Error(`QA duration drift: ${fMeta.duration.toFixed(1)}s vs ${durS.toFixed(1)}s`);
    if (fMeta.bitrateKbps && fMeta.bitrateKbps < 600) throw new Error(`QA bitrate too low: ${fMeta.bitrateKbps}kbps`);
    if (!fMeta.hasAudio) throw new Error('QA: no audio stream (recipe video phải có tiếng thật)');
    const blackSpan = await maxBlackSpan(final);
    if (blackSpan > 2) throw new Error(`QA black span ${blackSpan.toFixed(1)}s`);
    const lufs = await measureLufs(final);
    log(logs, `QA pass: ${fMeta.duration.toFixed(1)}s ${fMeta.width}x${fMeta.height} ${fMeta.bitrateKbps}kbps${lufs != null ? ` ${lufs.toFixed(1)} LUFS` : ''}`);

    // ── S8: publish ──
    const outName = `vid_${projectId}.mp4`;
    fs.copyFileSync(final, path.join(IMAGES_DIR, outName));
    const outputUrl = `/api/images/${outName}`;
    db.prepare(`INSERT OR IGNORE INTO assets (id, brand_id, url, filename, file_type, status, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'video', 'unused', 'generated', datetime('now'), datetime('now'))`)
      .run(uuid(), brandId, outputUrl, outName);
    log(logs, `saved ${outputUrl}`);
    saveLog('done', { output_url: outputUrl });
  } catch (e) {
    log(logs, `FAILED: ${e}`);
    saveLog('failed', { error: String(e).slice(0, 500) });
    throw e;
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

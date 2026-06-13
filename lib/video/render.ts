/**
 * Video render orchestrator — stages S2..S8 (see docs/video-studio-architecture.md).
 * 2-layer compositing (DLS pattern): FFmpeg background track + Puppeteer
 * transparent overlay, then composite + BGM loudnorm.
 */
import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db';
import { ffmpeg, probe, extractFrames, blackFrameCheck, detectBeats, IMAGES_DIR, TMP_DIR } from './ffmpeg';
import { Storyboard, Segment } from './director';
import { overlayHtml, OverlayProject } from './overlay-template';

const FPS = 30;
const W = 1080, H = 1920;

function log(lines: string[], msg: string) {
  lines.push(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
  console.log('[video-render]', msg);
}

/** Map an app URL (/api/images/x, /brand/...) to a readable local file path. */
function localPath(url: string): string {
  if (url.startsWith('/api/images/')) return path.join(IMAGES_DIR, url.replace('/api/images/', ''));
  if (url.startsWith('/')) return path.join(process.cwd(), 'public', url);
  return url;
}

async function resolveSegmentInput(seg: Segment, db: ReturnType<typeof getDb>, work: string, idx: number, logs: string[]): Promise<{ file: string; isVideo: boolean }> {
  if (seg.source === 'clip' && seg.clip_id) {
    const clip = db.prepare('SELECT filename, duration_s FROM video_clips WHERE id=?').get(seg.clip_id) as { filename: string; duration_s: number } | undefined;
    if (clip) {
      const f = path.join(IMAGES_DIR, clip.filename);
      if (fs.existsSync(f)) {
        if (seg.dur_s > clip.duration_s) seg.dur_s = Math.max(1, Math.floor(clip.duration_s * 10) / 10);
        return { file: f, isVideo: true };
      }
    }
    log(logs, `seg${idx}: clip ${seg.clip_id} missing — fallback ai_image`);
    seg.source = 'ai_image';
  }
  if (seg.source === 'image' && seg.image_url) {
    const f = localPath(seg.image_url);
    if (fs.existsSync(f)) return { file: f, isVideo: false };
    log(logs, `seg${idx}: image ${seg.image_url} missing — fallback ai_image`);
    seg.source = 'ai_image';
  }
  // ai_image
  const prompt = seg.image_prompt || 'Cozy herbal tea scene, warm natural light, ceramic cup with gentle steam on wooden table, soft bokeh, cinematic 35mm photo, vertical composition, no text';
  log(logs, `seg${idx}: generating AI image…`);
  const { generateImage } = await import('../openai-image');
  const dataUrl = await generateImage({ prompt, size: '1024x1536', quality: 'low' });
  const f = path.join(work, `ai_${idx}.png`);
  fs.writeFileSync(f, Buffer.from(dataUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
  return { file: f, isVideo: false };
}

/** Encode one uniform segment (1080x1920@30, h264, no audio). Stills get Ken Burns. */
async function encodeSegment(input: string, isVideo: boolean, durS: number, out: string, idx: number) {
  if (isVideo) {
    await ffmpeg([
      '-ss', '0', '-t', durS.toFixed(3), '-i', input,
      '-vf', `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS}`,
      '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', out,
    ]);
  } else {
    const frames = Math.round(durS * FPS);
    // Alternate zoom direction per segment for variety (deterministic by index)
    const zExpr = idx % 2 === 0 ? `1+0.10*on/${frames}` : `1.10-0.10*on/${frames}`;
    await ffmpeg([
      '-i', input,
      '-vf', `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},` +
        `zoompan=z='${zExpr}':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS}`,
      '-frames:v', String(frames),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', out,
    ]);
  }
}

async function renderOverlayFrames(project: OverlayProject, framesDir: string, totalFrames: number) {
  fs.mkdirSync(framesDir, { recursive: true });
  const { default: puppeteer } = await import('puppeteer-core');
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 540, height: 960, deviceScaleFactor: 2 }); // = 1080x1920 px
    await page.setContent(overlayHtml(project), { waitUntil: 'domcontentloaded' });
    for (let i = 0; i < totalFrames; i++) {
      const ms = (i * 1000) / FPS;
      await page.evaluate(m => (window as unknown as { SEEK: (n: number) => void }).SEEK(m), ms);
      await page.screenshot({
        path: path.join(framesDir, `f_${String(i).padStart(5, '0')}.png`),
        omitBackground: true,
      });
    }
  } finally {
    await browser.close();
  }
}

export async function renderProject(projectId: string): Promise<void> {
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
    const board = JSON.parse(String(project.script_json || '{}')) as Storyboard;
    if (!board.segments?.length) throw new Error('Storyboard empty — generate it first');
    const brandId = String(project.brand_id || 'loveintea');

    // S3 — beat info (already snapped by director if bpm known; re-detect if missing)
    let bpm = project.bpm ? Number(project.bpm) : null;
    const bgmFile = project.bgm_url ? localPath(String(project.bgm_url)) : null;
    if (bgmFile && fs.existsSync(bgmFile) && !bpm) {
      try { bpm = (await detectBeats(bgmFile)).bpm; log(logs, `BPM detected: ${bpm?.toFixed(1)}`); } catch (e) { log(logs, `BPM detect failed: ${e}`); }
    }

    // S2 + S4 — resolve inputs and encode uniform segments
    const segFiles: string[] = [];
    for (let i = 0; i < board.segments.length; i++) {
      const seg = board.segments[i];
      const { file, isVideo } = await resolveSegmentInput(seg, db, work, i, logs);
      const out = path.join(work, `seg_${i}.mp4`);
      await encodeSegment(file, isVideo, seg.dur_s, out, i);
      segFiles.push(out);
      log(logs, `seg${i}: ${seg.source} ${seg.dur_s}s encoded`);
    }
    const concatList = path.join(work, 'list.txt');
    fs.writeFileSync(concatList, segFiles.map(f => `file '${f}'`).join('\n'));
    const bg = path.join(work, 'bg.mp4');
    await ffmpeg(['-f', 'concat', '-safe', '0', '-i', concatList, '-c', 'copy', bg]);
    const bgMeta = await probe(bg);
    const durS = bgMeta.duration;
    log(logs, `bg track: ${durS.toFixed(2)}s`);

    // S5 — overlay frames (deterministic HTML)
    const dna = db.prepare('SELECT colors_json FROM brand_dna WHERE brand_id=?').get(brandId) as { colors_json: string } | undefined;
    let colors = { primary: '#1A5632', accent: '#E04854', cream: '#FFF8F0' };
    try {
      const c = JSON.parse(dna?.colors_json || '{}') as Record<string, string>;
      const vals = Object.values(c);
      if (vals.length >= 2) colors = { primary: vals[0], accent: vals[1], cream: vals[2] ?? '#FFF8F0' };
    } catch { /* defaults */ }
    const brandName = (db.prepare('SELECT name FROM brands WHERE id=?').get(brandId) as { name: string } | undefined)?.name ?? brandId;

    let cursor = 0;
    const overlaySegs = board.segments.map(s => {
      const startMs = cursor * 1000; cursor += s.dur_s;
      return { startMs, endMs: cursor * 1000, text: s.text, anim: s.text_anim };
    });
    const totalFrames = Math.round(durS * FPS);
    log(logs, `overlay: rendering ${totalFrames} frames…`);
    await renderOverlayFrames(
      { durationMs: durS * 1000, hook: board.hook ?? '', ctaText: board.cta_text ?? '', brandName, colors, segments: overlaySegs },
      path.join(work, 'frames'), totalFrames
    );

    // S5.5 — voiceover TTS (optional). Mixed under the video with BGM ducking.
    let voFile: string | null = null;
    const voScript = String(project.vo_script || '').trim();
    if (Number(project.use_voiceover) === 1 && voScript) {
      try {
        const { synthesizeVoice } = await import('./tts');
        const voice = (String(project.vo_voice || 'nova')) as 'nova';
        const buf = await synthesizeVoice(voScript, voice);
        voFile = path.join(work, 'vo.mp3');
        fs.writeFileSync(voFile, buf);
        log(logs, `voiceover synthesized (${voScript.length} chars, voice=${voice})`);
      } catch (e) { log(logs, `voiceover TTS failed (continuing without): ${e}`); voFile = null; }
    }

    // S6 — composite video + audio mix
    const final = path.join(work, 'final.mp4');
    const overlayInput = path.join(work, 'frames', 'f_%05d.png');
    const D = durS.toFixed(2);
    const fadeStart = Math.max(0, durS - 1).toFixed(2);
    const hasBgm = Boolean(bgmFile && fs.existsSync(bgmFile));
    const baseInputs = ['-i', bg, '-framerate', String(FPS), '-i', overlayInput];
    const vOverlay = '[0:v][1:v]overlay=0:0:format=auto[v]';
    const LN = 'loudnorm=I=-16:TP=-1.5:LRA=11';

    if (hasBgm && voFile) {
      // VO + BGM with sidechain ducking (BGM dips when narration speaks) — hubframe audio rule
      await ffmpeg([
        ...baseInputs, '-i', bgmFile!, '-i', voFile,
        '-filter_complex',
        `${vOverlay};` +
        `[3:a]asplit=2[voa][vob];` +
        `[2:a]volume=0.8,atrim=0:${D},afade=t=out:st=${fadeStart}:d=1[bgmt];` +
        `[bgmt][voa]sidechaincompress=threshold=0.03:ratio=8:attack=5:release=300[duck];` +
        `[duck][vob]amix=inputs=2:duration=first:normalize=0[mx];[mx]${LN}[a]`,
        '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
        '-pix_fmt', 'yuv420p', '-r', String(FPS), '-c:a', 'aac', '-b:a', '160k', '-t', D, final,
      ]);
    } else if (voFile) {
      // VO only — pad to full video length
      await ffmpeg([
        ...baseInputs, '-i', voFile,
        '-filter_complex', `${vOverlay};[2:a]apad,atrim=0:${D},${LN}[a]`,
        '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
        '-pix_fmt', 'yuv420p', '-r', String(FPS), '-c:a', 'aac', '-b:a', '160k', '-t', D, final,
      ]);
    } else if (hasBgm) {
      await ffmpeg([
        ...baseInputs, '-i', bgmFile!,
        '-filter_complex', `${vOverlay};[2:a]atrim=0:${D},afade=t=out:st=${fadeStart}:d=1,${LN}[a]`,
        '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
        '-pix_fmt', 'yuv420p', '-r', String(FPS), '-c:a', 'aac', '-b:a', '160k', '-t', D, final,
      ]);
    } else {
      await ffmpeg([
        ...baseInputs, '-filter_complex', vOverlay,
        '-map', '[v]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
        '-pix_fmt', 'yuv420p', '-r', String(FPS), final,
      ]);
    }
    log(logs, `composite done (bgm=${hasBgm}, vo=${Boolean(voFile)})`);

    // S7 — QA (exit 0 ≠ video đúng)
    const qaFrames = await extractFrames(final, path.join(work, 'qa'), 6);
    const qa = blackFrameCheck(qaFrames);
    if (!qa.ok) throw new Error(`QA failed: ${qa.bad.length}/6 black frames`);
    const fMeta = await probe(final);
    if (Math.abs(fMeta.duration - durS) > durS * 0.08) throw new Error(`QA duration drift: ${fMeta.duration.toFixed(1)}s vs ${durS.toFixed(1)}s`);
    log(logs, `QA pass: ${fMeta.duration.toFixed(1)}s ${fMeta.width}x${fMeta.height}`);

    // S8 — publish to library
    const outName = `vid_${projectId}.mp4`;
    fs.copyFileSync(final, path.join(IMAGES_DIR, outName));
    const outputUrl = `/api/images/${outName}`;
    db.prepare(`INSERT OR IGNORE INTO assets (id, brand_id, url, filename, file_type, status, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'video', 'unused', 'generated', datetime('now'), datetime('now'))`)
      .run(uuid(), brandId, outputUrl, outName);
    if (bpm) db.prepare('UPDATE video_projects SET bpm=? WHERE id=?').run(bpm, projectId);
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

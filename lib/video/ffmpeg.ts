/**
 * FFmpeg/ffprobe helpers — child_process wrappers.
 * Lessons baked in (video-composition skill): no hard timeout on full renders,
 * always re-encode segments to uniform format before concat.
 */
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
export const IMAGES_DIR = path.join(DATA_DIR, 'images');
export const TMP_DIR = path.join(DATA_DIR, 'video-tmp');

export function run(bin: string, args: string[], timeoutMs = 0): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: timeoutMs || undefined, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${bin} failed: ${stderr?.slice(-800) || err.message}`));
      else resolve(stdout.toString());
    });
  });
}

export const ffmpeg = (args: string[]) => run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args]);

/** Run ffmpeg capturing stderr (where ffmpeg logs ebur128/blackdetect). Never rejects on analysis filters. */
function ffmpegStderr(args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile('ffmpeg', ['-hide_banner', ...args], { maxBuffer: 64 * 1024 * 1024 }, (_err, _stdout, stderr) => {
      resolve(stderr?.toString() ?? '');
    });
  });
}

export interface MediaMeta { duration: number; width: number; height: number }

export async function probe(file: string): Promise<MediaMeta> {
  const out = await run('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height:format=duration',
    '-of', 'json', file,
  ], 30_000);
  const d = JSON.parse(out) as { streams?: Array<{ width?: number; height?: number }>; format?: { duration?: string } };
  return {
    duration: parseFloat(d.format?.duration ?? '0') || 0,
    width: d.streams?.[0]?.width ?? 0,
    height: d.streams?.[0]?.height ?? 0,
  };
}

/** Extract n evenly-spaced JPEG frames; returns file paths. */
export async function extractFrames(video: string, outDir: string, n = 6): Promise<string[]> {
  fs.mkdirSync(outDir, { recursive: true });
  const { duration } = await probe(video);
  const files: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = Math.max(0.1, (duration * (i + 0.5)) / n);
    const f = path.join(outDir, `qa_${i}.jpg`);
    await ffmpeg(['-ss', t.toFixed(2), '-i', video, '-vframes', '1', '-q:v', '3', f]);
    files.push(f);
  }
  return files;
}

/** QA rule from quizzlee/DLS: frame < 15KB = black/broken. */
export function blackFrameCheck(frames: string[]): { ok: boolean; bad: string[] } {
  const bad = frames.filter(f => { try { return fs.statSync(f).size < 15 * 1024; } catch { return true; } });
  return { ok: bad.length === 0, bad };
}

// ── QA: read REAL pixels (quizzlee: exit 0 ≠ video đúng) ──────────────
/**
 * Pixel-level QA: downscale each frame to 160×90 raw and compute mean + std-dev.
 * blank (đặc 1 màu) if stdDev < 30; washed/trắng if mean > 250. Far stronger than
 * the KB heuristic — catches solid-colour frames that are >15KB.
 */
export async function pixelFrameCheck(frames: string[]): Promise<{ ok: boolean; bad: Array<{ f: string; reason: string }> }> {
  const sharp = (await import('sharp')).default;
  const bad: Array<{ f: string; reason: string }> = [];
  for (const f of frames) {
    try {
      const { data } = await sharp(f).resize(160, 90, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      let sum = 0; for (let i = 0; i < data.length; i++) sum += data[i];
      const mean = sum / data.length;
      let v = 0; for (let i = 0; i < data.length; i++) { const d = data[i] - mean; v += d * d; }
      const std = Math.sqrt(v / data.length);
      if (std < 30) bad.push({ f, reason: `flat (std=${std.toFixed(1)})` });
      else if (mean > 250) bad.push({ f, reason: `white (mean=${mean.toFixed(0)})` });
    } catch (e) { bad.push({ f, reason: `unreadable: ${String(e).slice(0, 60)}` }); }
  }
  return { ok: bad.length === 0, bad };
}

/** Frozen-frame check (quizzlee): if sampled frames hash-match each other the video is stuck. */
export async function frozenCheck(frames: string[]): Promise<boolean> {
  if (frames.length < 3) return false;
  const sharp = (await import('sharp')).default;
  const hashes: string[] = [];
  for (const f of frames) {
    try {
      const { data } = await sharp(f).resize(8, 8, { fit: 'fill' }).grayscale().raw().toBuffer({ resolveWithObject: true });
      let sum = 0; for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / data.length;
      hashes.push(Array.from(data).map(b => (b > avg ? '1' : '0')).join(''));
    } catch { hashes.push(''); }
  }
  let dup = 0;
  for (let i = 1; i < hashes.length; i++) if (hashes[i] && hashes[i] === hashes[0]) dup++;
  return dup >= hashes.length - 1; // every sample identical to the first = frozen
}

/** Measure integrated loudness (LUFS) via ebur128. Returns null if unparseable. */
export async function measureLufs(file: string): Promise<number | null> {
  const err = await ffmpegStderr(['-i', file, '-af', 'ebur128', '-f', 'null', '-']);
  const m = err.match(/I:\s*(-?[\d.]+)\s*LUFS/g);
  if (!m?.length) return null;
  const last = m[m.length - 1].match(/(-?[\d.]+)/);
  return last ? parseFloat(last[1]) : null;
}

/** Longest continuous black segment (seconds) via blackdetect. 0 if none. */
export async function maxBlackSpan(file: string): Promise<number> {
  const err = await ffmpegStderr(['-i', file, '-vf', 'blackdetect=d=0.1:pix_th=0.10', '-an', '-f', 'null', '-']);
  const spans = [...err.matchAll(/black_duration:\s*([\d.]+)/g)].map(x => parseFloat(x[1]));
  return spans.length ? Math.max(...spans) : 0;
}

export interface FullMeta { duration: number; width: number; height: number; bitrateKbps: number; hasAudio: boolean }

/** Extended probe: dimensions + duration + bitrate + whether an audio stream exists. */
export async function probeFull(file: string): Promise<FullMeta> {
  const out = await run('ffprobe', [
    '-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration,bit_rate',
    '-of', 'json', file,
  ], 30_000);
  const d = JSON.parse(out) as { streams?: Array<{ codec_type?: string; width?: number; height?: number }>; format?: { duration?: string; bit_rate?: string } };
  const v = d.streams?.find(s => s.codec_type === 'video');
  return {
    duration: parseFloat(d.format?.duration ?? '0') || 0,
    width: v?.width ?? 0,
    height: v?.height ?? 0,
    bitrateKbps: Math.round((parseInt(d.format?.bit_rate ?? '0', 10) || 0) / 1000),
    hasAudio: Boolean(d.streams?.some(s => s.codec_type === 'audio')),
  };
}

/** Detect BPM + beat grid from an audio file (first 60s, mono 22.05kHz PCM). */
export async function detectBeats(audioFile: string): Promise<{ bpm: number; beats: number[] }> {
  const pcmFile = path.join(TMP_DIR, `bpm_${Date.now()}.f32`);
  fs.mkdirSync(TMP_DIR, { recursive: true });
  try {
    await ffmpeg(['-i', audioFile, '-t', '60', '-ac', '1', '-ar', '22050', '-f', 'f32le', pcmFile]);
    const buf = fs.readFileSync(pcmFile);
    const audio = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
    const { default: MusicTempo } = await import('music-tempo');
    const mt = new MusicTempo(audio);
    return { bpm: mt.tempo, beats: mt.beats };
  } finally {
    try { fs.unlinkSync(pcmFile); } catch { /* tmp */ }
  }
}

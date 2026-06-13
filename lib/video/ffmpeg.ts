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

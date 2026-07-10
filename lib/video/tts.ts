/**
 * Voiceover TTS — edge-tts (Microsoft neural, FREE, giọng nữ mặc định) là engine chính;
 * OpenAI tts-1 chỉ còn là fallback khi edge-tts lỗi/thiếu. edge-tts còn trả SRT
 * word boundary → karaoke caption sync theo timestamps THẬT thay vì ước lượng.
 */
import OpenAI from 'openai';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export type TtsVoice = 'nova' | 'shimmer' | 'alloy' | 'echo' | 'fable' | 'onyx';

// Map voice cũ (OpenAI id lưu trong DB/UI) → giọng Edge neural. Nữ là mặc định.
const EDGE_VOICES: Record<string, string> = {
  nova: 'en-US-JennyNeural',      // nữ Mỹ ấm (default)
  shimmer: 'en-US-AriaNeural',    // nữ Mỹ nhẹ
  alloy: 'en-US-MichelleNeural',  // nữ Mỹ trung tính
  fable: 'en-GB-SoniaNeural',     // nữ Anh
  echo: 'en-US-EricNeural',       // nam Mỹ
  onyx: 'en-US-GuyNeural',        // nam Mỹ trầm
};
const looksVietnamese = (t: string) => /[ăâđêơôưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(t);

/** Parse SRT của edge-tts → VoWord[]. Cue 1 từ (bản mới --words-in-cue 1) dùng thẳng;
 *  cue nhiều từ (bản cũ, theo câu) → chia từ trong cue theo tỉ trọng độ dài. */
function parseSrtToWords(srt: string): VoWord[] {
  const out: VoWord[] = [];
  const toMs = (h: string, m: string, s: string, ms: string) =>
    Number(h) * 3600_000 + Number(m) * 60_000 + Number(s) * 1000 + Number(ms);
  const blocks = srt.split(/\n\s*\n/);
  for (const b of blocks) {
    const tm = b.match(/(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)/);
    if (!tm) continue;
    const s = toMs(tm[1], tm[2], tm[3], tm[4]);
    const e = toMs(tm[5], tm[6], tm[7], tm[8]);
    const text = b.slice(b.indexOf(tm[0]) + tm[0].length).replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const words = text.split(' ').filter(Boolean);
    if (words.length === 1) { out.push({ t: words[0], s, e }); continue; }
    const inner = buildWordTimings(text, e - s);
    for (const w of inner) out.push({ t: w.t, s: s + w.s, e: s + w.e });
  }
  return out;
}

/** Gọi edge-tts CLI. Thử --words-in-cue 1 (bản mới, timestamp từng từ); bản cũ không có
 *  flag → chạy lại không flag (SRT theo câu, chia từ trong cue). */
async function edgeSynthesize(text: string, edgeVoice: string): Promise<{ audio: Buffer; words: VoWord[] | null }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edgetts-'));
  const mp3 = path.join(dir, 'vo.mp3');
  const srt = path.join(dir, 'vo.srt');
  const run = (extra: string[]) => new Promise<void>((resolve, reject) => {
    const proc = spawn('edge-tts', ['--voice', edgeVoice, '--text', text.slice(0, 4000),
      '--write-media', mp3, '--write-subtitles', srt, ...extra], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', d => { stderr += String(d); });
    const timer = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error('edge-tts timeout 90s')); }, 90_000);
    proc.on('error', e => { clearTimeout(timer); reject(e); });
    proc.on('close', code => {
      clearTimeout(timer);
      if (code === 0 && fs.existsSync(mp3)) resolve();
      else reject(new Error(`edge-tts exit ${code}: ${stderr.slice(-200)}`));
    });
  });
  try {
    try { await run(['--words-in-cue', '1']); } catch { await run([]); }
    const audio = fs.readFileSync(mp3);
    if (!audio.length) throw new Error('edge-tts produced empty audio');
    let words: VoWord[] | null = null;
    try { words = parseSrtToWords(fs.readFileSync(srt, 'utf8')); if (!words.length) words = null; } catch { words = null; }
    return { audio, words };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Engine chính: edge-tts (free, nữ default, word timestamps). Fallback: OpenAI tts-1. */
export async function synthesizeVoiceWithTimings(text: string, voice: TtsVoice = 'nova'):
  Promise<{ audio: Buffer; words: VoWord[] | null; engine: 'edge' | 'openai' }> {
  const edgeVoice = looksVietnamese(text)
    ? (voice === 'onyx' || voice === 'echo' ? 'vi-VN-NamMinhNeural' : 'vi-VN-HoaiMyNeural')
    : (EDGE_VOICES[voice] ?? 'en-US-JennyNeural');
  try {
    const r = await edgeSynthesize(text, edgeVoice);
    return { ...r, engine: 'edge' };
  } catch (e) {
    console.warn('[tts] edge-tts failed, falling back to OpenAI:', String(e).slice(0, 150));
    return { audio: await synthesizeVoice(text, voice), words: null, engine: 'openai' };
  }
}

export interface VoWord { t: string; s: number; e: number } // từ + start/end ms

/** Word timings XẤP XỈ theo tỉ trọng độ dài từ (karaoke caption).
 *  OpenAI TTS không trả timestamps — chia thời lượng audio đo được theo trọng số
 *  (ký tự + khoảng thở + pause sau dấu câu). Sai số nhỏ với VO 15-40s, đủ cho
 *  hiệu ứng karaoke; khi nào có TTS trả word boundary (Azure/11L) thì thay tại đây. */
export function buildWordTimings(text: string, durationMs: number): VoWord[] {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length || durationMs <= 0) return [];
  const weights = words.map(w => w.length + 0.6 + (/[,.!?;:…]$/.test(w) ? 0.9 : 0));
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  return words.map((t, i) => {
    const s = (acc / total) * durationMs;
    acc += weights[i];
    return { t, s: Math.round(s), e: Math.round((acc / total) * durationMs) };
  });
}

function isQuota(e: unknown): boolean {
  const m = String(e).toLowerCase();
  return ['insufficient_quota', 'billing', 'exceeded', '429', 'rate limit'].some(s => m.includes(s));
}

export async function synthesizeVoice(text: string, voice: TtsVoice = 'nova'): Promise<Buffer> {
  const primary = process.env.OPENAI_API_KEY;
  if (!primary) throw new Error('OPENAI_API_KEY not set — voiceover unavailable');

  const speak = async (key: string) => {
    const client = new OpenAI({ apiKey: key });
    const res = await client.audio.speech.create({
      model: 'tts-1', voice, input: text.slice(0, 4000), response_format: 'mp3', speed: 1.0,
    });
    return Buffer.from(await res.arrayBuffer());
  };

  try {
    return await speak(primary);
  } catch (e) {
    const backup = process.env.OPENAI_API_KEY_BACKUP;
    if (backup && isQuota(e)) {
      console.warn('[tts] primary quota exhausted — using backup key');
      return await speak(backup);
    }
    throw e;
  }
}

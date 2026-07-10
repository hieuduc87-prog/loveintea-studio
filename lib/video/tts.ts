/**
 * Voiceover TTS — OpenAI tts-1. Reuses the OPENAI_API_KEY already required for
 * image generation (with the backup-key fallback pattern). Returns mp3 bytes.
 */
import OpenAI from 'openai';

export type TtsVoice = 'nova' | 'shimmer' | 'alloy' | 'echo' | 'fable' | 'onyx';

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

/**
 * Voiceover TTS — OpenAI tts-1. Reuses the OPENAI_API_KEY already required for
 * image generation (with the backup-key fallback pattern). Returns mp3 bytes.
 */
import OpenAI from 'openai';

export type TtsVoice = 'nova' | 'shimmer' | 'alloy' | 'echo' | 'fable' | 'onyx';

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

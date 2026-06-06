import { GoogleGenerativeAI } from '@google/generative-ai';

let _client: GoogleGenerativeAI | null = null;

function getClient() {
  if (!_client) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY not set');
    _client = new GoogleGenerativeAI(key);
  }
  return _client;
}

const MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash'];

async function tryGenerate(prompt: string, jsonMode: boolean): Promise<string> {
  let lastError: unknown;
  for (const modelName of MODELS) {
    try {
      const client = getClient();
      const model = client.getGenerativeModel({
        model: modelName,
        ...(jsonMode ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
      });
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (e) {
      lastError = e;
      // 503 = model overloaded, try next
      const msg = String(e);
      if (!msg.includes('503') && !msg.includes('unavailable') && !msg.includes('overloaded')) throw e;
    }
  }
  throw lastError;
}

export async function generateCaption(prompt: string): Promise<string> {
  return tryGenerate(prompt, false);
}

export async function generateJSON<T>(prompt: string): Promise<T> {
  const text = await tryGenerate(prompt, true);
  return JSON.parse(text) as T;
}

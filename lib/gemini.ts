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

// Stable GA models only — preview models get retired without notice
// (gemini-2.0-flash deprecation already broke production once, commit 6e80b52)
const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

/** Retryable = transient (503/429) OR model gone (404/deprecated) — fall through to next model */
function isRetryable(e: unknown): boolean {
  const msg = String(e).toLowerCase();
  return ['503', 'unavailable', 'overloaded', '429', 'quota', 'rate limit',
    '404', 'not found', 'deprecated', 'no longer available'].some(s => msg.includes(s));
}

/**
 * Last-resort backup: when EVERY Gemini model fails (quota exhausted, outage,
 * all models deprecated), fall back to OpenAI text — the OPENAI_API_KEY is
 * already required for image generation, so it's always available.
 * Records the fallback in settings so the Dashboard can surface it.
 */
async function openAiFallback(prompt: string, jsonMode: boolean): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Gemini failed and no OPENAI_API_KEY for fallback');

  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: key });
  const res = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    ...(jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
  });
  const text = res.choices[0]?.message?.content?.trim();
  if (!text) throw new Error('OpenAI fallback returned empty response');

  try {
    const { getDb } = await import('./db');
    getDb().prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('ai_text_fallback_at', ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
      .run(new Date().toISOString());
  } catch { /* telemetry only */ }
  console.warn('[gemini] all models failed — served by OpenAI gpt-4o-mini fallback');
  return text;
}

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
      if (!isRetryable(e)) throw e;
    }
  }
  // All Gemini models failed — try the OpenAI backup before giving up
  try {
    return await openAiFallback(prompt, jsonMode);
  } catch {
    throw lastError;
  }
}

export async function generateCaption(prompt: string): Promise<string> {
  return tryGenerate(prompt, false);
}

export async function generateJSON<T>(prompt: string): Promise<T> {
  const text = await tryGenerate(prompt, true);
  return JSON.parse(text) as T;
}

// ─── Vision: analyze image with text prompt ─────────────────
export async function analyzeImage(imageBuffer: Buffer, mimeType: string, prompt: string): Promise<string> {
  let lastError: unknown;
  for (const modelName of MODELS) {
    try {
      const client = getClient();
      const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: 'application/json' },
      });
      const result = await model.generateContent([
        { inlineData: { data: imageBuffer.toString('base64'), mimeType } },
        prompt,
      ]);
      return result.response.text().trim();
    } catch (e) {
      lastError = e;
      if (!isRetryable(e)) throw e;
    }
  }
  throw lastError;
}

// ─── Template Layout Analysis ───────────────────────────────
export interface TemplateAnalysis {
  layout: {
    type: string;           // e.g. "centered", "split", "grid", "hero-product", "text-heavy"
    columns: number;
    rows: number;
    description: string;
  };
  zones: Array<{
    zone_id: string;        // e.g. "header", "hero", "product_area", "cta", "footer"
    type: 'text' | 'image' | 'product' | 'logo' | 'background' | 'decoration';
    position: string;       // e.g. "top-center", "middle-left", "bottom-right"
    size: string;           // e.g. "large", "medium", "small", "full-width"
    description: string;
  }>;
  typography: {
    headline_style: string;   // e.g. "bold serif", "handwritten", "modern sans"
    body_style: string;
    text_hierarchy: string;   // e.g. "headline > subhead > body > CTA"
    estimated_word_count: { headline: number; body: number };
  };
  colors: {
    palette: string[];        // hex colors detected
    mood: string;             // e.g. "warm", "cool", "vibrant", "muted"
    contrast: string;         // e.g. "high", "medium", "low"
  };
  product_placement: {
    has_product: boolean;
    position: string;
    size: string;
    style: string;            // e.g. "flat-lay", "lifestyle", "cutout", "illustration"
  };
  style_keywords: string[];   // e.g. ["minimal", "organic", "luxury", "playful"]
  best_for: string[];         // e.g. ["new launch", "promo", "educational", "seasonal"]
  content_direction: string;  // 1-2 sentence description of how to use this template
}

export async function analyzeTemplateLayout(imageBuffer: Buffer, mimeType: string): Promise<TemplateAnalysis> {
  const prompt = `You are a professional graphic designer analyzing a content template image for a beverage brand (tea/herbal drinks).

Analyze this template image in detail and return structured JSON describing:

1. **layout**: Overall layout structure (type, grid columns/rows, description)
2. **zones**: Every distinct zone/block in the layout — what it contains (text, image, product, logo, background, decoration), where it's positioned, how large it is
3. **typography**: Headline style, body text style, text hierarchy, estimated word counts
4. **colors**: Detected color palette (hex), mood, contrast level
5. **product_placement**: Whether there's a product spot, its position/size/style
6. **style_keywords**: 5-10 keywords describing the visual style
7. **best_for**: What content purposes this template works best for
8. **content_direction**: 1-2 sentences on how the AI should use this template to generate matching content

Return JSON matching this exact schema:
{
  "layout": { "type": "string", "columns": 1, "rows": 3, "description": "..." },
  "zones": [{ "zone_id": "header", "type": "text", "position": "top-center", "size": "small", "description": "..." }],
  "typography": { "headline_style": "...", "body_style": "...", "text_hierarchy": "...", "estimated_word_count": { "headline": 5, "body": 20 } },
  "colors": { "palette": ["#hex1","#hex2"], "mood": "...", "contrast": "..." },
  "product_placement": { "has_product": true, "position": "center", "size": "large", "style": "..." },
  "style_keywords": ["minimal", "organic"],
  "best_for": ["new launch", "promo"],
  "content_direction": "..."
}`;

  const raw = await analyzeImage(imageBuffer, mimeType, prompt);
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : raw) as TemplateAnalysis;
  } catch {
    throw new Error('Gemini returned unparseable template analysis');
  }
}

// ─── Collection Template Analysis (multi-image: số lượng, step, nội dung từng ảnh) ───
export interface CollectionAnalysis {
  slide_count: number;
  slides: Array<{
    index: number;          // 1-based order
    role: string;           // hook | product | benefit | ingredient | how_to | proof | cta | other
    content: string;        // mô tả nội dung ảnh này
    text_on_image: string;  // chữ overlay (nếu có)
    visual: string;         // bố cục/visual của ảnh
  }>;
  structure: string;        // luồng tổng thể (vd: hook → sản phẩm → lợi ích → CTA)
  skeleton: string;         // KHUNG SƯỜN tái sử dụng: tả từng slide làm gì để dựng lại cho sản phẩm khác
  style_keywords: string[];
  best_for: string[];
}

/** Analyze ALL images of a collection template → structure + reusable skeleton. */
export async function analyzeTemplateCollection(images: Array<{ data: Buffer; mimeType: string }>): Promise<CollectionAnalysis> {
  const prompt = `Bạn là giám đốc sáng tạo. Đây là MỘT template content gồm ${images.length} ảnh THEO THỨ TỰ (ảnh 1 → ${images.length}).
Phân tích CHI TIẾT để hiểu cấu trúc template và rút ra KHUNG SƯỜN tái sử dụng được cho sản phẩm khác.

Trả ONLY JSON đúng schema:
{
 "slide_count": ${images.length},
 "slides": [{"index":1,"role":"hook|product|benefit|ingredient|how_to|proof|cta|other","content":"ảnh này thể hiện gì","text_on_image":"chữ overlay nếu có","visual":"bố cục/màu/khung hình"}],
 "structure": "luồng tổng thể của template (vd: hook gây tò mò → giới thiệu sản phẩm → 3 lợi ích → CTA)",
 "skeleton": "KHUNG SƯỜN: mô tả từng slide cần làm gì (vai trò + loại nội dung + bố cục) để có thể DỰNG LẠI template tương đương cho 1 sản phẩm KHÁC — viết như công thức từng bước",
 "style_keywords": ["..."],
 "best_for": ["promo","educate","launch",...]
}`;

  const parts: Array<{ inlineData: { data: string; mimeType: string } } | string> = images.map(img => ({
    inlineData: { data: img.data.toString('base64'), mimeType: img.mimeType },
  }));
  parts.push(prompt);

  let lastError: unknown;
  for (const modelName of MODELS) {
    try {
      const client = getClient();
      const model = client.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: 'application/json' } });
      const result = await model.generateContent(parts as Parameters<typeof model.generateContent>[0]);
      const raw = result.response.text().trim();
      const m = raw.match(/\{[\s\S]*\}/);
      return JSON.parse(m ? m[0] : raw) as CollectionAnalysis;
    } catch (e) {
      lastError = e;
      if (!isRetryable(e)) throw e;
    }
  }
  throw lastError;
}

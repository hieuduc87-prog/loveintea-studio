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

const MODELS = ['gemini-2.5-flash-preview-05-20', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];

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
      const msg = String(e);
      if (!msg.includes('503') && !msg.includes('unavailable') && !msg.includes('overloaded')) throw e;
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

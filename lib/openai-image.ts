/**
 * OpenAI Image Generation — LoveinTea Studio
 *
 * RULE: All content images MUST use gpt-image-2 edit mode with the product
 * image as reference to keep the packaging/product shape 100% intact.
 *
 * Cost strategy: quality='low' (half-price) + Lanczos 4x upscale = same
 * visual result for posting, ~50% cheaper than quality='medium'/'high'.
 *
 * Only use generate (no reference) for backgrounds/scenes with no product.
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { upscaleImage } from './upscale';

let _client: OpenAI | null = null;
let _backupClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY not set');
    _client = new OpenAI({ apiKey: key });
  }
  return _client;
}

function isQuotaError(e: unknown): boolean {
  const msg = String(e).toLowerCase();
  return ['insufficient_quota', 'billing', 'exceeded your current quota', '429', 'rate limit']
    .some(s => msg.includes(s));
}

/**
 * Run an OpenAI call; on quota/billing exhaustion retry once with
 * OPENAI_API_KEY_BACKUP (optional second account) so image generation
 * keeps working when the primary key runs dry.
 */
async function withQuotaFallback<T>(fn: (client: OpenAI) => Promise<T>): Promise<T> {
  try {
    return await fn(getClient());
  } catch (e) {
    const backupKey = process.env.OPENAI_API_KEY_BACKUP;
    if (!backupKey || !isQuotaError(e)) throw e;
    console.warn('[openai-image] primary key quota exhausted — retrying with OPENAI_API_KEY_BACKUP');
    if (!_backupClient) _backupClient = new OpenAI({ apiKey: backupKey });
    return await fn(_backupClient);
  }
}

export type ImageSize = '1024x1024' | '1024x1536' | '1536x1024';
export type ImageQuality = 'low' | 'medium' | 'high';

/**
 * PRIMARY method — edit product image into lifestyle scene.
 * Product packaging stays 100% intact.
 * Uses gpt-image-1 (GPT-image-2 edit API).
 */
export async function editProductImage(opts: {
  productImagePath: string;
  prompt: string;
  size?: ImageSize;
  quality?: ImageQuality;
}): Promise<string> {
  const { productImagePath, prompt, size = '1024x1536', quality = 'low' } = opts;

  if (!fs.existsSync(productImagePath)) {
    throw new Error(`Product image not found: ${productImagePath}`);
  }

  const imageBuffer = fs.readFileSync(productImagePath);
  // MIME đúng theo đuôi file (template slides có thể là .webp/.jpg, không phải png)
  const ext = path.extname(productImagePath).toLowerCase();
  const mime = ext === '.webp' ? 'image/webp'
    : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
    : 'image/png';
  const imageFile = new File(
    [imageBuffer],
    path.basename(productImagePath),
    { type: mime }
  );

  const response = await withQuotaFallback(client => client.images.edit({
    model: 'gpt-image-2',
    image: imageFile,
    prompt,
    size,
    quality,
    n: 1,
  } as Parameters<typeof client.images.edit>[0]));

  const imageData = response.data?.[0];
  if (!imageData) throw new Error('No image returned from OpenAI');

  if (imageData.b64_json) {
    return `data:image/png;base64,${imageData.b64_json}`;
  }
  return imageData.url ?? '';
}

/**
 * Fallback — generate scene WITHOUT product reference.
 * Use only for pure lifestyle/atmospheric shots (no product needed).
 */
export async function generateImage(opts: {
  prompt: string;
  size?: ImageSize;
  quality?: ImageQuality;
}): Promise<string> {
  const { prompt, size = '1024x1536', quality = 'low' } = opts;

  const response = await withQuotaFallback(client => client.images.generate({
    model: 'gpt-image-2',
    prompt,
    size,
    quality,
    n: 1,
  } as Parameters<typeof client.images.generate>[0]));

  const imageData = response.data?.[0];
  if (!imageData) throw new Error('No image returned from OpenAI');

  if (imageData.b64_json) {
    return `data:image/png;base64,${imageData.b64_json}`;
  }
  return imageData.url ?? '';
}

/**
 * Save base64 image to local file in data/images/
 * Returns the public URL path.
 */
export async function saveImageToFile(
  base64DataUrl: string,
  filename: string
): Promise<string> {
  // Save to DATA_DIR/images/ — persists across next build
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  const imagesDir = path.join(dataDir, 'images');
  fs.mkdirSync(imagesDir, { recursive: true });

  const base64 = base64DataUrl.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');
  const filePath = path.join(imagesDir, filename);
  fs.writeFileSync(filePath, buffer);

  // Upscale 4x with Lanczos (1024×1536 → 4096×6144) — ~1-2s on Apple Silicon
  try {
    const upscaledPath = await upscaleImage(filePath, 4);
    const upscaledFilename = path.basename(upscaledPath);
    return `/api/images/${upscaledFilename}`;
  } catch {
    // Fallback to original if upscale fails
    return `/api/images/${filename}`;
  }
}

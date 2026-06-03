import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

let _client: OpenAI | null = null;

function getClient() {
  if (!_client) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY not set');
    _client = new OpenAI({ apiKey: key });
  }
  return _client;
}

export type ImageSize = '1024x1024' | '1024x1536' | '1536x1024';

/**
 * Edit an existing product image to create lifestyle scene.
 * Uses gpt-image-1 (GPT-image-2) edit mode with the product as reference.
 * Keeps product visible and intact.
 */
export async function editProductImage(opts: {
  productImagePath: string;  // absolute path to product PNG
  prompt: string;
  size?: ImageSize;
}): Promise<string> {
  const client = getClient();
  const { productImagePath, prompt, size = '1024x1536' } = opts;

  const imageBuffer = fs.readFileSync(productImagePath);
  const imageFile = new File([imageBuffer], path.basename(productImagePath), { type: 'image/png' });

  const response = await client.images.edit({
    model: 'gpt-image-1',
    image: imageFile,
    prompt,
    size,
    n: 1,
  });

  const imageData = response.data?.[0];
  if (!imageData) throw new Error('No image returned from OpenAI');

  // Return base64 data URL or URL
  if (imageData.b64_json) {
    return `data:image/png;base64,${imageData.b64_json}`;
  }
  return imageData.url ?? '';
}

/**
 * Generate a new image from scratch using gpt-image-1.
 * Used when no product reference is available.
 */
export async function generateImage(opts: {
  prompt: string;
  size?: ImageSize;
}): Promise<string> {
  const client = getClient();
  const { prompt, size = '1024x1536' } = opts;

  const response = await client.images.generate({
    model: 'gpt-image-1',
    prompt,
    size,
    n: 1,
  });

  const imageData = response.data?.[0];
  if (!imageData) throw new Error('No image returned from OpenAI');

  if (imageData.b64_json) {
    return `data:image/png;base64,${imageData.b64_json}`;
  }
  return imageData.url ?? '';
}

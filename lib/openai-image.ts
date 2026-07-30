/**
 * OpenAI Image Generation — LoveinTea Studio
 *
 * RULE: All content images MUST use gpt-image-2 edit mode with the product
 * image as reference to keep the packaging/product shape 100% intact.
 *
 * Quality: default quality='medium' — [lệnh founder 30/07] KHÔNG dùng 'high' ở bất kỳ đâu
 * trong mọi dự án ('high' đắt ~10x 'low'). 'medium' là mức được phép cho ảnh quảng cáo
 * photoreal như ở đây (skin/materials còn thật, không nhựa). Every prompt is enriched with
 * withPhotoreal() (real-camera direction + anti-"AI look" negatives). Video frames still pass
 * quality='low' explicitly to stay cheap. NO upscale (upscaling only softens + bloats;
 * /api/images ?w= resizes per platform).
 *
 * Only use generate (no reference) for backgrounds/scenes with no product.
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { withPhotoreal } from './photoreal';
import { falRembg } from './video/fal';
import { getModelLook } from './brand-lang';

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
  return ['insufficient_quota', 'billing', 'exceeded your current quota', '429', 'rate limit', 'hard limit']
    .some(s => msg.includes(s));
}

/** Dịch lỗi OpenAI kỹ thuật (tiếng Anh) → thông báo tiếng Việt rõ ràng cho nhân viên,
 *  phân biệt rõ "cần founder nạp tiền/tăng hạn mức" với "quá tải tạm thời, thử lại". */
function friendlyImageError(e: unknown): Error {
  const msg = String((e as { message?: string })?.message ?? e).toLowerCase();
  if (msg.includes('hard limit') || msg.includes('billing')) {
    return new Error('Tài khoản OpenAI đã chạm HẠN MỨC CHI TIÊU tháng — không tạo được ảnh AI. Báo quản trị viên vào platform.openai.com → Settings → Limits để tăng "monthly budget" hoặc nạp thêm credit. (Ảnh đã tạo trước đó vẫn dùng bình thường.)');
  }
  if (msg.includes('insufficient_quota') || msg.includes('exceeded your current quota')) {
    return new Error('Tài khoản OpenAI đã HẾT credit — báo quản trị viên nạp thêm tại platform.openai.com → Billing.');
  }
  if (msg.includes('429') || msg.includes('rate limit')) {
    return new Error('OpenAI đang quá tải yêu cầu (rate limit) — chờ ~30 giây rồi thử tạo lại.');
  }
  return e instanceof Error ? e : new Error(String(e));
}

/**
 * Run an OpenAI call; on quota/billing exhaustion retry once with
 * OPENAI_API_KEY_BACKUP (optional second account) so image generation
 * keeps working when the primary key runs dry. Khi hết đường lùi → ném
 * lỗi tiếng Việt dễ hiểu thay vì raw English của OpenAI.
 */
async function withQuotaFallback<T>(fn: (client: OpenAI) => Promise<T>): Promise<T> {
  try {
    return await fn(getClient());
  } catch (e) {
    const backupKey = process.env.OPENAI_API_KEY_BACKUP;
    if (!backupKey || !isQuotaError(e)) throw friendlyImageError(e);
    console.warn('[openai-image] primary key quota exhausted — retrying with OPENAI_API_KEY_BACKUP');
    if (!_backupClient) _backupClient = new OpenAI({ apiKey: backupKey });
    try {
      return await fn(_backupClient);
    } catch (e2) {
      throw friendlyImageError(e2);
    }
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
  brandId?: string;
  /** Ảnh tham chiếu THÊM (card 7554fa71): gpt-image-2 edit nhận NHIỀU ảnh.
   *  Một ảnh + văn xuôi thua ngữ nghĩa bố cục (hộp bị biến thành túi trà qua 3
   *  vòng verify-gate) — gửi ảnh bố cục + ảnh sản phẩm là cách duy nhất giữ FORM. */
  extraImagePaths?: string[];
}): Promise<string> {
  const { productImagePath, prompt: rawPrompt, size = '1024x1536', quality = 'medium', brandId } = opts;
  const prompt = withPhotoreal(rawPrompt, getModelLook(brandId));

  if (!fs.existsSync(productImagePath)) {
    throw new Error(`Product image not found: ${productImagePath}`);
  }

  const toFile = (p: string): File => {
    const buf = fs.readFileSync(p);
    // MIME đúng theo đuôi file (template slides có thể là .webp/.jpg, không phải png)
    const ext = path.extname(p).toLowerCase();
    const mime = ext === '.webp' ? 'image/webp'
      : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
      : 'image/png';
    return new File([buf], path.basename(p), { type: mime });
  };
  const files = [productImagePath, ...(opts.extraImagePaths ?? []).filter(p => p && fs.existsSync(p))]
    .map(toFile);

  const response = await withQuotaFallback(client => client.images.edit({
    model: 'gpt-image-2',
    image: files.length > 1 ? files : files[0],
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
  brandId?: string;
}): Promise<string> {
  const { prompt: rawPrompt, size = '1024x1536', quality = 'medium', brandId } = opts;
  const prompt = withPhotoreal(rawPrompt, getModelLook(brandId));

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

  // CHUẨN 4:5 (1080×1350) — hợp cả Instagram feed lẫn Facebook. gpt-image xuất 2:3 (cao hơn)
  // → center-crop về 4:5 trước khi upscale. Lỗi sharp thì giữ ảnh gốc.
  let outBuf: Uint8Array = buffer;
  try {
    const sharp = (await import('sharp')).default;
    const meta = await sharp(buffer).metadata();
    const w = meta.width ?? 0, h = meta.height ?? 0;
    if (w && h) {
      const target = 4 / 5;
      let cw = w, ch = h;
      if (w / h > target) cw = Math.round(h * target); else ch = Math.round(w / target);
      if (cw !== w || ch !== h) {
        outBuf = await sharp(buffer).extract({ left: Math.round((w - cw) / 2), top: Math.round((h - ch) / 2), width: cw, height: ch }).toBuffer();
      }
    }
  } catch { /* giữ ảnh gốc nếu crop lỗi */ }
  fs.writeFileSync(filePath, outBuf);

  // NO upscale: quality='medium' output is already crisp at native res — upscaling
  // only softens + bloats the file. The /api/images ?w= endpoint resizes per platform.
  return `/api/images/${filename}`;
}

/**
 * MASK-LOCK (học từ amz-pipeline/openai-engine.generateWithGptImageLocked):
 * sản phẩm là PIXEL GỐC dán lên canvas, mask bảo gpt-image-2 "vùng sản phẩm
 * CẤM ĐỘNG — chỉ vẽ nền xung quanh". Chữ/artwork không thể sai vì KHÔNG được
 * vẽ lại. Quy ước mask OpenAI: alpha=0 → model VẼ; alpha=255 → GIỮ pixel gốc.
 *
 * Dùng cho slide sản phẩm KHÔNG cần người cầm (hero/packshot/bối cảnh mặt bàn).
 * Cảnh người cầm sản phẩm vẫn phải đi đường restage 2 ảnh + fidelity gate
 * (tay đè lên sản phẩm thì không khoá pixel được).
 */
export async function editWithProductLock(opts: {
  productImagePath: string;      // ảnh sản phẩm (nền gì cũng được — tự tách nền)
  prompt: string;                // mô tả BỐI CẢNH cần vẽ quanh sản phẩm
  size?: ImageSize;
  quality?: ImageQuality;
  productScale?: number;         // 0-1, phần canvas sản phẩm chiếm (mặc định 0.62)
  productGravity?: string;       // sharp gravity (mặc định 'center')
  brandId?: string;
}): Promise<string> {
  const { productImagePath, size = '1024x1536', quality = 'medium',
          productScale = 0.62, productGravity = 'center' } = opts;
  if (!fs.existsSync(productImagePath)) throw new Error(`Product image not found: ${productImagePath}`);

  // 1. Cutout trong suốt — cache theo hash file (rembg tốn tiền + thời gian)
  const srcBuf = fs.readFileSync(productImagePath);
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  const cutDir = path.join(dataDir, 'cutouts');
  fs.mkdirSync(cutDir, { recursive: true });
  const hash = crypto.createHash('sha1').update(srcBuf).digest('hex').slice(0, 16);
  const cutPath = path.join(cutDir, `${hash}.png`);
  let cutout: Buffer;
  if (fs.existsSync(cutPath)) cutout = fs.readFileSync(cutPath);
  else {
    cutout = await falRembg(await sharp(srcBuf).png().toBuffer());
    fs.writeFileSync(cutPath, cutout);
  }

  // 2. Canvas + mask (port từ amz-pipeline)
  const [cw, ch] = size.split('x').map(Number);
  const resized = await sharp(cutout)
    .resize(Math.round(cw * productScale), Math.round(ch * productScale),
            { fit: 'inside', withoutEnlargement: false })
    .png().toBuffer();
  const canvas = await sharp({ create: { width: cw, height: ch, channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 255 } } })
    .composite([{ input: resized, gravity: productGravity }])
    .png().toBuffer();
  const mask = await sharp({ create: { width: cw, height: ch, channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, gravity: productGravity }])
    .png().toBuffer();

  const prompt = withPhotoreal(
    `${opts.prompt} The product is ALREADY PLACED in the image and its pixels are locked — paint a photorealistic scene around it with natural shadows, reflections and lighting that match the scene; never draw over or alter the product.`,
    getModelLook(opts.brandId),
  );

  const imageFile = new File([new Uint8Array(canvas)], 'image.png', { type: 'image/png' });
  const maskFile = new File([new Uint8Array(mask)], 'mask.png', { type: 'image/png' });
  const response = await withQuotaFallback(client => client.images.edit({
    model: 'gpt-image-2',
    image: imageFile,
    mask: maskFile,
    prompt,
    size,
    quality,
    n: 1,
  } as Parameters<typeof client.images.edit>[0]));
  const imageData = response.data?.[0];
  if (!imageData?.b64_json) throw new Error('No image returned from OpenAI (mask edit)');
  return `data:image/png;base64,${imageData.b64_json}`;
}

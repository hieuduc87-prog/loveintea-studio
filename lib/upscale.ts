/**
 * Image upscaling — Sharp Lanczos (2x, free, ~instant on Apple Silicon)
 * Applied after every gpt-image-2 generation: 1024×1536 → 2048×3072
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

export async function upscaleImage(
  inputPath: string,
  scale: 2 | 3 | 4 = 4
): Promise<string> {
  if (!fs.existsSync(inputPath)) throw new Error(`File not found: ${inputPath}`);

  const meta = await sharp(inputPath).metadata();
  const w = (meta.width  ?? 1024) * scale;
  const h = (meta.height ?? 1536) * scale;

  // Save as _2x.png alongside the original
  const ext = path.extname(inputPath);
  const base = inputPath.replace(ext, '');
  const outPath = `${base}_${scale}x${ext}`;

  await sharp(inputPath)
    .resize(w, h, { kernel: sharp.kernel.lanczos3, fit: 'fill' })
    .png({ compressionLevel: 6, adaptiveFiltering: true })
    .toFile(outPath);

  return outPath;
}

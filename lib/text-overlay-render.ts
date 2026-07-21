import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { getDb } from '@/lib/db';
import { overlayImageHtml, DEFAULT_COLORS, OverlayColors, OverlayLayout, OverlayFields, OverlayFonts } from '@/lib/text-overlay';

// Server-only render helper cho "Chữ lên ảnh" — dùng chung giữa route render tay
// và route auto (tự động từ ảnh mẫu). Puppeteer + fs, KHÔNG import ở client.

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');

/** Resolve a base image reference into a data: URI (embedded — no network in Puppeteer).
 *  Ảnh lớn (bản _4x ~10MB) được sharp thu về ≤1080px trước khi nhúng — data URI
 *  khổng lồ làm Chromium trong container chết "Target closed" (card 80981061). */
export async function toDataUri(baseImageUrl: string): Promise<string> {
  if (baseImageUrl.startsWith('data:')) return baseImageUrl;
  if (baseImageUrl.includes('/api/images/')) {
    const file = baseImageUrl.split('/api/images/')[1].split('?')[0];
    const fp = path.join(IMAGES_DIR, file);
    if (fs.existsSync(fp)) {
      try {
        const { default: sharp } = await import('sharp');
        const buf = await sharp(fp).resize({ width: 1080, withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
        return `data:image/jpeg;base64,${buf.toString('base64')}`;
      } catch {
        const ext = path.extname(fp).slice(1).toLowerCase();
        const mime = ext === 'jpg' ? 'jpeg' : ext;
        return `data:image/${mime};base64,${fs.readFileSync(fp).toString('base64')}`;
      }
    }
  }
  throw new Error('Không tìm thấy ảnh nền');
}

/** Read an /api/images/ ref (or data URI) into a Buffer + mime — for Gemini vision. */
export function imageRefToBuffer(ref: string): { buffer: Buffer; mimeType: string } {
  if (ref.startsWith('data:')) {
    const [head, b64] = ref.split(',');
    const mimeType = head.slice(5).split(';')[0] || 'image/png';
    return { buffer: Buffer.from(b64, 'base64'), mimeType };
  }
  const file = ref.split('/api/images/')[1]?.split('?')[0];
  const fp = file ? path.join(IMAGES_DIR, file) : '';
  if (!fp || !fs.existsSync(fp)) throw new Error('Không tìm thấy ảnh mẫu');
  const ext = path.extname(fp).slice(1).toLowerCase();
  return { buffer: fs.readFileSync(fp), mimeType: `image/${ext === 'jpg' ? 'jpeg' : ext}` };
}

export function brandColors(brandId: string): OverlayColors {
  try {
    const row = getDb().prepare('SELECT colors_json FROM brand_dna WHERE brand_id=?').get(brandId) as { colors_json: string } | undefined;
    const j = row?.colors_json ? JSON.parse(row.colors_json) as Record<string, string> : {};
    const vals = Object.values(j);
    return {
      primary: j.heritageGreen || j.primary || vals[0] || DEFAULT_COLORS.primary,
      accent:  j.loveCoral || j.accent || vals[1] || DEFAULT_COLORS.accent,
      cream:   j.cottonCream || j.cream || DEFAULT_COLORS.cream,
      dark:    j.deepEarth || j.dark || DEFAULT_COLORS.dark,
    };
  } catch { return DEFAULT_COLORS; }
}

/** Font brand đã upload (card ce0d8091) → data: URI cho @font-face trong Puppeteer. */
export function brandFonts(brandId: string): OverlayFonts {
  const FORMAT: Record<string, string> = { ttf: 'truetype', otf: 'opentype', woff: 'woff', woff2: 'woff2' };
  const fonts: OverlayFonts = {};
  try {
    const rows = getDb().prepare('SELECT role, filename FROM brand_fonts WHERE brand_id=?')
      .all(brandId) as Array<{ role: string; filename: string }>;
    for (const r of rows) {
      const fp = path.join(DATA_DIR, 'fonts', brandId.replace(/[^a-z0-9_-]/gi, ''), r.filename);
      if (!fs.existsSync(fp)) continue;
      const ext = path.extname(fp).slice(1).toLowerCase();
      const format = FORMAT[ext];
      if (!format) continue;
      const dataUri = `data:font/${ext};base64,${fs.readFileSync(fp).toString('base64')}`;
      if (r.role === 'headline') fonts.headline = { dataUri, format };
      if (r.role === 'sub') fonts.sub = { dataUri, format };
    }
  } catch { /* fonts best-effort — thiếu bảng/file thì dùng font mặc định */ }
  return fonts;
}

async function renderHtmlToPng(html: string): Promise<Buffer> {
  const { default: puppeteer } = await import('puppeteer-core');
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 540, height: 675, deviceScaleFactor: 2 }); // → 1080x1350 (4:5)
    await page.setContent(html, { waitUntil: 'load' });
    try { await page.evaluate(() => (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready); } catch { /* fonts best-effort */ }
    const buf = await page.screenshot({ type: 'png' });
    return Buffer.from(buf);
  } finally {
    await browser.close();
  }
}

/** Render text onto a base image and persist it; returns the /api/images/ URL. */
export async function renderOverlayToUrl(opts: {
  baseImageUrl: string; layout: OverlayLayout; fields: OverlayFields; brandId: string; brandName?: string;
}): Promise<string> {
  const imageSrc = await toDataUri(opts.baseImageUrl);
  const html = overlayImageHtml({
    imageSrc, layout: opts.layout, fields: opts.fields,
    colors: brandColors(opts.brandId), brandName: opts.brandName,
    fonts: brandFonts(opts.brandId),
  });
  const png = await renderHtmlToPng(html);
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  // Suffix ngẫu nhiên: /api/images là PUBLIC (FB/IG fetch) — tên chỉ theo
  // timestamp thì đoán/enumerate được ảnh của brand khác.
  const filename = `textovl_${Date.now()}_${randomBytes(6).toString('hex')}.png`;
  fs.writeFileSync(path.join(IMAGES_DIR, filename), png);
  return `/api/images/${filename}`;
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';
import { overlayImageHtml, DEFAULT_COLORS, OverlayColors, OverlayLayout, OverlayFields } from '@/lib/text-overlay';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');

/** Resolve a base image reference into a data: URI (embedded — no network in Puppeteer). */
function toDataUri(baseImageUrl: string): string {
  if (baseImageUrl.startsWith('data:')) return baseImageUrl;
  if (baseImageUrl.includes('/api/images/')) {
    const file = baseImageUrl.split('/api/images/')[1].split('?')[0];
    const fp = path.join(IMAGES_DIR, file);
    if (fs.existsSync(fp)) {
      const ext = path.extname(fp).slice(1).toLowerCase();
      const mime = ext === 'jpg' ? 'jpeg' : ext;
      return `data:image/${mime};base64,${fs.readFileSync(fp).toString('base64')}`;
    }
  }
  throw new Error('Không tìm thấy ảnh nền');
}

function brandColors(brandId: string): OverlayColors {
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      baseImageUrl?: string; layout?: OverlayLayout;
      headline?: string; sub?: string; cta?: string; badge?: string;
      brandName?: string;
    };
    if (!body.baseImageUrl) return NextResponse.json({ error: 'Thiếu ảnh nền' }, { status: 400 });

    const brandId = getBrandId(req) || 'loveintea';
    const imageSrc = toDataUri(body.baseImageUrl);
    const fields: OverlayFields = { headline: body.headline, sub: body.sub, cta: body.cta, badge: body.badge };
    const html = overlayImageHtml({
      imageSrc, layout: body.layout || 'bottom-headline', fields,
      colors: brandColors(brandId), brandName: body.brandName,
    });

    const png = await renderHtmlToPng(html);
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
    const filename = `textovl_${Date.now()}.png`;
    fs.writeFileSync(path.join(IMAGES_DIR, filename), png);
    return NextResponse.json({ ok: true, url: `/api/images/${filename}` });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Render lỗi' }, { status: 500 });
  }
}

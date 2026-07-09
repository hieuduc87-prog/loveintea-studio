export const dynamic = 'force-dynamic';
export const maxDuration = 120;
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { analyzeTemplateLayout, analyzeTemplateCollection } from '@/lib/gemini';
import { assertResourceBrand } from '@/lib/brand-guard';
import fs from 'fs';
import path from 'path';

const IMAGES_DIR = path.join(process.env.DATA_DIR || path.join(process.cwd(), 'data'), 'images');

function readImg(url: string): { data: Buffer; mimeType: string } | null {
  const filename = url.replace('/api/images/', '');
  const fp = path.join(IMAGES_DIR, filename);
  if (!fs.existsSync(fp)) return null;
  const ext = path.extname(filename).toLowerCase();
  const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
  return { data: fs.readFileSync(fp), mimeType };
}

// POST /api/content-templates/[id]/analyze — Gemini analysis of the WHOLE template
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const db = getDb();
    const tpl = db.prepare('SELECT brand_id, image_url, slides_json FROM content_templates WHERE id = ?').get(id) as { brand_id: string; image_url?: string; slides_json?: string } | undefined;
    if (!tpl) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const denied = assertResourceBrand(req, tpl.brand_id);
    if (denied) return denied;
    if (!tpl.image_url) return NextResponse.json({ error: 'Template chưa có ảnh để phân tích' }, { status: 400 });

    let slides: Array<{ url: string }> = [];
    try { slides = JSON.parse(tpl.slides_json || '[]'); } catch { /* */ }
    if (!slides.length) slides = [{ url: tpl.image_url }];

    if (slides.length > 1) {
      // Collection → analyze ALL images → structure + reusable skeleton
      const imgs = slides.map(s => readImg(s.url)).filter(Boolean) as Array<{ data: Buffer; mimeType: string }>;
      if (!imgs.length) return NextResponse.json({ error: 'Không đọc được ảnh template' }, { status: 404 });
      const analysis = await analyzeTemplateCollection(imgs.slice(0, 12));
      db.prepare('UPDATE content_templates SET analysis = ? WHERE id = ?').run(JSON.stringify(analysis), id);
      return NextResponse.json({ ok: true, analysis });
    }

    // Single image → layout analysis
    const img = readImg(slides[0].url);
    if (!img) return NextResponse.json({ error: 'Image file not found' }, { status: 404 });
    const analysis = await analyzeTemplateLayout(img.data, img.mimeType);
    db.prepare('UPDATE content_templates SET analysis = ? WHERE id = ?').run(JSON.stringify(analysis), id);
    return NextResponse.json({ ok: true, analysis });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { analyzeTemplateLayout } from '@/lib/gemini';
import fs from 'fs';
import path from 'path';

// POST /api/content-templates/[id]/analyze — re-run Gemini vision analysis
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const db = getDb();
    const tpl = db.prepare('SELECT image_url FROM content_templates WHERE id = ?').get(id) as { image_url?: string } | undefined;

    if (!tpl?.image_url) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Read image file from disk
    const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
    const filename = tpl.image_url.replace('/api/images/', '');
    const filePath = path.join(dataDir, 'images', filename);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Image file not found' }, { status: 404 });
    }

    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filename).toLowerCase();
    const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
      : ext === '.webp' ? 'image/webp'
      : 'image/png';

    const analysis = await analyzeTemplateLayout(buffer, mimeType);
    const analysisJson = JSON.stringify(analysis);

    db.prepare('UPDATE content_templates SET analysis = ? WHERE id = ?').run(analysisJson, id);

    return NextResponse.json({ ok: true, analysis });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

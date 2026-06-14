export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get('brand_voice') as { value: string } | undefined;
  return NextResponse.json({ content: row?.value ?? '' });
}

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData();
    const file = fd.get('file') as File | null;
    const text = fd.get('text') as string | null;

    let content = '';

    if (file) {
      const name = file.name.toLowerCase();
      if (name.endsWith('.docx')) {
        // Extract text from docx (zip > word/document.xml)
        const { default: JSZip } = await import('jszip');
        const buf = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(buf);
        const xml = await zip.file('word/document.xml')?.async('string');
        if (xml) {
          content = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        }
      } else {
        // txt, md — read as text
        content = await file.text();
      }
    } else if (text) {
      content = text;
    }

    if (!content) return NextResponse.json({ error: 'No content found in file' }, { status: 400 });

    const db = getDb();
    db.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES ('brand_voice', ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
    `).run(content);

    return NextResponse.json({ ok: true, length: content.length });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

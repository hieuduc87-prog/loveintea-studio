export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb();
    const body = await req.json();
    const { id } = params;

    const fields: string[] = [];
    const values: (string | number)[] = [];

    for (const key of ['name', 'category', 'purpose', 'format', 'aspect_ratio', 'tags', 'color_palette', 'notes'] as const) {
      if (body[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(body[key]);
      }
    }
    if (body.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(body.is_active ? 1 : 0);
    }
    if (body.increment_usage) {
      fields.push('usage_count = usage_count + 1');
    }

    if (fields.length === 0) return NextResponse.json({ error: 'No fields' }, { status: 400 });

    values.push(id);
    db.prepare(`UPDATE content_templates SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb();
    const { id } = params;
    const row = db.prepare('SELECT image_url, thumbnail_url FROM content_templates WHERE id = ?').get(id) as { image_url?: string; thumbnail_url?: string } | undefined;

    db.prepare('DELETE FROM content_templates WHERE id = ?').run(id);

    // Clean up files
    const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
    for (const url of [row?.image_url, row?.thumbnail_url]) {
      if (url?.startsWith('/api/images/')) {
        const filename = url.replace('/api/images/', '');
        const filePath = path.join(dataDir, 'images', filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

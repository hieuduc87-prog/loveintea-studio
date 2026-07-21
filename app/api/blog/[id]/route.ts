export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const db   = getDb();
  // TENANT ISOLATION: chỉ đọc blog post của brand mình.
  const post = db.prepare('SELECT * FROM blog_posts WHERE id = ? AND brand_id = ?')
    .get(params.id, getBrandId(req) || 'loveintea') as Record<string, unknown> | undefined;
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(post);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const r = db.prepare('DELETE FROM blog_posts WHERE id = ? AND brand_id = ?')
    .run(params.id, getBrandId(req) || 'loveintea');
  if (r.changes === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

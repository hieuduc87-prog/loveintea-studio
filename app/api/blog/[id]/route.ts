export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db   = getDb();
  const post = db.prepare('SELECT * FROM blog_posts WHERE id = ?').get(params.id) as Record<string, unknown> | undefined;
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(post);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  db.prepare('DELETE FROM blog_posts WHERE id = ?').run(params.id);
  return NextResponse.json({ ok: true });
}

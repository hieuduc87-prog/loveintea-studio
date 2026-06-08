export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// GET /api/knowledge/[id] — return full doc content
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const db = getDb();
    const doc = db
      .prepare('SELECT * FROM knowledge_docs WHERE id = ?')
      .get(params.id) as Record<string, unknown> | undefined;

    if (!doc) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ doc });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

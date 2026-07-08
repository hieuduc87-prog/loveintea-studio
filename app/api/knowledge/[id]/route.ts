export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { assertResourceBrand } from '@/lib/brand-guard';

// GET /api/knowledge/[id] — return full doc content
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb();
    const doc = db
      .prepare('SELECT * FROM knowledge_docs WHERE id = ?')
      .get(params.id) as Record<string, unknown> | undefined;

    if (!doc) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const denied = assertResourceBrand(req, doc.brand_id as string | undefined);
    if (denied) return denied;

    return NextResponse.json({ doc });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';
import { getBrandId, assertResourceBrand } from '@/lib/brand-guard';

// Reading order: playbook → guideline → research → workflow → flowmap → everything else
const TYPE_ORDER: Record<string, number> = {
  playbook: 0,
  guideline: 1,
  research: 2,
  workflow: 3,
  flowmap: 4,
  communication_direction: 5,
  social_strategy: 6,
};

function typeRank(type: string): number {
  return TYPE_ORDER[type] ?? 99;
}

// ─── GET /api/knowledge?brandId=loveintea ─────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brandId');

    if (!brandId) {
      return NextResponse.json({ error: 'brandId is required' }, { status: 400 });
    }

    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, brand_id, type, title, content, file_url, uploaded_at
         FROM knowledge_docs
         WHERE brand_id = ?`
      )
      .all(brandId) as Array<{
        id: string;
        brand_id: string;
        type: string;
        title: string;
        content: string | null;
        file_url: string | null;
        uploaded_at: string | null;
      }>;

    const docs = rows
      .sort((a, b) => {
        const rankDiff = typeRank(a.type) - typeRank(b.type);
        if (rankDiff !== 0) return rankDiff;
        // Secondary sort: oldest first within same type
        return (a.uploaded_at ?? '').localeCompare(b.uploaded_at ?? '');
      })
      .map((row) => ({
        id: row.id,
        brand_id: row.brand_id,
        type: row.type,
        title: row.title,
        content: row.content ?? '',
        file_url: row.file_url,
        uploaded_at: row.uploaded_at,
        content_preview: row.content ? row.content.slice(0, 200) : '',
        content_size: row.content ? row.content.length : 0,
      }));

    return NextResponse.json({ docs });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

// ─── POST /api/knowledge ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, title, content, fileUrl } = body as {
      type?: string;
      title?: string;
      content?: string;
      fileUrl?: string;
    };
    // Brand from the trusted header — never body.brandId. Knowledge docs feed
    // every caption prompt, so a cross-tenant insert = stored prompt injection.
    const brandId = getBrandId(req);
    const denied = assertResourceBrand(req, brandId);
    if (denied) return denied;

    if (!type || !title) {
      return NextResponse.json(
        { error: 'type and title are required' },
        { status: 400 }
      );
    }

    const id = uuid();
    const db = getDb();

    db.prepare(
      `INSERT INTO knowledge_docs (id, brand_id, type, title, content, file_url, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(id, brandId, type, title, content ?? null, fileUrl ?? null);

    // Audit log for the knowledge that feeds the production loop
    try {
      db.prepare(`INSERT INTO knowledge_log (id, brand_id, doc_id, action, type, title) VALUES (?,?,?, 'add', ?, ?)`)
        .run(uuid(), brandId, id, type, title);
    } catch { /* log best-effort */ }

    const created = db
      .prepare('SELECT * FROM knowledge_docs WHERE id = ?')
      .get(id) as Record<string, unknown>;

    return NextResponse.json({ ok: true, doc: created }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

// ─── DELETE /api/knowledge?id=xxx ─────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const db = getDb();
    const existing = db
      .prepare('SELECT brand_id FROM knowledge_docs WHERE id = ?')
      .get(id) as { brand_id: string } | undefined;

    if (!existing) {
      return NextResponse.json({ error: 'Doc not found' }, { status: 404 });
    }
    const denied = assertResourceBrand(req, existing.brand_id);
    if (denied) return denied;

    db.prepare('DELETE FROM knowledge_docs WHERE id = ?').run(id);

    return NextResponse.json({ ok: true, deleted: id });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

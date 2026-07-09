export const dynamic = 'force-dynamic';
/**
 * POST /api/posts/bulk — bulk operations on posts.
 * body: { ids: string[], action: 'approve'|'reject'|'schedule'|'set_status'|'delete',
 *         scheduledAt?: ISO, status?: string }
 *
 * SAFETY: published posts are LOCKED — their schedule/status are never changed
 * (returns them in `locked`). Approve/reject (review_status) is always allowed.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isAllBrands, userBrands } from '@/lib/brand-guard';

export async function POST(req: NextRequest) {
  try {
    const { ids, action, scheduledAt, status } = await req.json() as {
      ids?: string[]; action?: string; scheduledAt?: string; status?: string;
    };
    if (!ids?.length || !action) return NextResponse.json({ error: 'ids and action required' }, { status: 400 });
    const db = getDb();

    // TENANT ISOLATION: only touch posts the caller may access (by brand).
    const allBrands = isAllBrands(req);
    const allowed = new Set(userBrands(req));
    const rows = db.prepare(`SELECT id, status, brand_id FROM posts WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids) as Array<{ id: string; status: string; brand_id: string }>;
    const locked: string[] = [];
    let changed = 0;

    const tx = db.transaction(() => {
      for (const r of rows) {
        if (!allBrands && !allowed.has(r.brand_id)) continue; // skip cross-tenant posts
        const isPublished = r.status === 'published';
        switch (action) {
          case 'approve':
            db.prepare(`UPDATE posts SET review_status='approved', updated_at=datetime('now') WHERE id=?`).run(r.id); changed++; break;
          case 'reject':
            db.prepare(`UPDATE posts SET review_status='rejected', updated_at=datetime('now') WHERE id=?`).run(r.id); changed++; break;
          case 'schedule':
            if (isPublished) { locked.push(r.id); break; }
            if (!scheduledAt) break;
            db.prepare(`UPDATE posts SET scheduled_at=?, status='scheduled', updated_at=datetime('now') WHERE id=?`).run(scheduledAt, r.id); changed++; break;
          case 'set_status':
            if (isPublished) { locked.push(r.id); break; }
            if (!status) break;
            db.prepare(`UPDATE posts SET status=?, updated_at=datetime('now') WHERE id=?`).run(status, r.id); changed++; break;
          case 'delete':
            if (isPublished) { locked.push(r.id); break; }
            db.prepare('DELETE FROM posts WHERE id=?').run(r.id); changed++; break;
        }
      }
    });
    tx();

    return NextResponse.json({ ok: true, changed, locked });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

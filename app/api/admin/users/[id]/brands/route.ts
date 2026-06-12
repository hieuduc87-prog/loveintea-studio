export const dynamic = 'force-dynamic';
/**
 * Brand membership for a user (admin only — gated by middleware).
 * GET  → { brandIds: string[] }  (empty = user sees all brands, legacy)
 * PUT  → body { brandIds: string[] } — replaces the user's memberships
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const rows = db.prepare('SELECT brand_id FROM brand_members WHERE user_id = ?').all(params.id) as Array<{ brand_id: string }>;
  return NextResponse.json({ brandIds: rows.map(r => r.brand_id) });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const { brandIds } = await req.json() as { brandIds?: string[] };
  if (!Array.isArray(brandIds)) {
    return NextResponse.json({ error: 'brandIds array required' }, { status: 400 });
  }

  const user = db.prepare('SELECT id FROM auth_users WHERE id = ?').get(params.id);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const replace = db.transaction((ids: string[]) => {
    db.prepare('DELETE FROM brand_members WHERE user_id = ?').run(params.id);
    const ins = db.prepare('INSERT OR IGNORE INTO brand_members (user_id, brand_id) VALUES (?, ?)');
    for (const bid of ids) ins.run(params.id, bid);
  });
  replace(brandIds);

  return NextResponse.json({ ok: true, brandIds });
}

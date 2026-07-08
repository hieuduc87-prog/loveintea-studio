export const dynamic = 'force-dynamic';
/**
 * GET  /api/hub/assets/folder?brand=x → list folders + counts (+ ungrouped count)
 * POST /api/hub/assets/folder { ids:[], folder } → move many assets into a folder
 *      (folder '' = remove from folder / ungroup). Drag-to-group multiple at once.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';

export async function GET(req: NextRequest) {
  const brandId = getBrandId(req);
  const db = getDb();
  const rows = db.prepare(
    `SELECT COALESCE(folder,'') AS folder, COUNT(*) AS n FROM assets WHERE brand_id=? GROUP BY COALESCE(folder,'')`
  ).all(brandId) as Array<{ folder: string; n: number }>;
  const folders = rows.filter(r => r.folder !== '').sort((a, b) => a.folder.localeCompare(b.folder));
  const ungrouped = rows.find(r => r.folder === '')?.n ?? 0;
  const total = rows.reduce((s, r) => s + r.n, 0);
  return NextResponse.json({ folders, ungrouped, total });
}

export async function POST(req: NextRequest) {
  const { ids, folder } = await req.json() as { ids?: string[]; folder?: string };
  if (!ids?.length) return NextResponse.json({ error: 'ids required' }, { status: 400 });
  const db = getDb();
  const f = (folder ?? '').slice(0, 80);
  const stmt = db.prepare("UPDATE assets SET folder = ?, updated_at = datetime('now') WHERE id = ?");
  const tx = db.transaction(() => { for (const id of ids) stmt.run(f, id); });
  tx();
  return NextResponse.json({ ok: true, moved: ids.length, folder: f });
}

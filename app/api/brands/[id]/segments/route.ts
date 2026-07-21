export const dynamic = 'force-dynamic';
/** GET /api/brands/[id]/segments — danh sách đối tượng (audiences DB, fallback SEGMENTS cho loveintea). */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { SEGMENTS } from '@/lib/brand-dna';
import { canAccessBrand } from '@/lib/brand-guard';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: brandId } = await params;
  // TENANT ISOLATION: chặn đọc audiences/đối tượng của brand khác qua PATH.
  if (!canAccessBrand(req, brandId)) {
    return NextResponse.json({ error: 'Forbidden — resource thuộc store khác.' }, { status: 403 });
  }
  const db = getDb();
  const aud = db.prepare('SELECT name, tension FROM audiences WHERE brand_id=?').all(brandId) as Array<{ name: string; tension: string }>;
  const segs = aud.length
    ? aud
    : (brandId === 'loveintea' ? SEGMENTS.map(s => ({ name: s.name, tension: s.tension })) : []);
  return NextResponse.json({ segments: segs });
}

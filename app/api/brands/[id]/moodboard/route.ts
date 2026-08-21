export const dynamic = 'force-dynamic';
/**
 * MOODBOARD API — reference ảnh tone/mood cho image generation.
 *
 * FIX HỆ THỐNG (card hoa-lang-thang "Không thể thêm moodboard vào Brand DNA"):
 * Trước brand_dna KHÔNG có cột lưu ảnh moodboard → khách không thể upload
 * reference tone/mood. Add cột `moodboard_json` + endpoint upload/list/delete.
 *
 * POST   multipart/form-data với `files` — upload nhiều ảnh, resize + lưu data/images/
 *        rồi append URL vào `brand_dna.moodboard_json`.
 * GET    trả `{ moodboard: [{url, note?}] }` cho UI hiển thị.
 * DELETE với body `{url}` — xoá 1 ảnh khỏi moodboard (không xoá file trên disk để share qua time).
 *
 * Áp cho MỌI brand — Image gen pipeline sẽ đọc moodboard_json để bơm vào prompt
 * ("Match tone/mood/palette of reference: <thumbnails>").
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';
import { canAccessBrand } from '@/lib/brand-guard';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const IMG_DIR = path.join(DATA_DIR, 'images');

interface MoodItem { url: string; note?: string; addedAt?: string }

function readMoodboard(brandId: string): MoodItem[] {
  const row = getDb().prepare('SELECT moodboard_json FROM brand_dna WHERE brand_id=?')
    .get(brandId) as { moodboard_json?: string } | undefined;
  try { return JSON.parse(row?.moodboard_json || '[]'); } catch { return []; }
}

function writeMoodboard(brandId: string, items: MoodItem[]) {
  const db = getDb();
  const exists = db.prepare('SELECT 1 FROM brand_dna WHERE brand_id=?').get(brandId);
  if (exists) {
    db.prepare('UPDATE brand_dna SET moodboard_json=?, updated_at=datetime(\'now\') WHERE brand_id=?')
      .run(JSON.stringify(items), brandId);
  } else {
    db.prepare('INSERT INTO brand_dna (id, brand_id, moodboard_json) VALUES (?, ?, ?)')
      .run(`dna-${brandId}`, brandId, JSON.stringify(items));
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!canAccessBrand(req, id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ moodboard: readMoodboard(id) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!canAccessBrand(req, id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const fd = await req.formData();
    const files = fd.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) return NextResponse.json({ error: 'Chưa có file' }, { status: 400 });

    fs.mkdirSync(IMG_DIR, { recursive: true });
    const items = readMoodboard(id);

    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      const ext = f.type.split('/')[1]?.split('+')[0] || 'jpg';
      const filename = `mood-${id}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
      const filePath = path.join(IMG_DIR, filename);
      const buf = Buffer.from(await f.arrayBuffer());

      // Resize về max 1600x1600 để tiết kiệm disk (moodboard chỉ cần preview)
      try {
        const sharp = (await import('sharp')).default;
        const resized = await sharp(buf).resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
        fs.writeFileSync(filePath, resized);
      } catch { fs.writeFileSync(filePath, buf); /* fallback lưu nguyên bản */ }

      items.push({ url: `/api/images/${filename}`, addedAt: new Date().toISOString() });
    }

    // Cap 24 ảnh — moodboard không phải kho hàng, quá nhiều = mất tính focus
    const capped = items.slice(-24);
    writeMoodboard(id, capped);
    return NextResponse.json({ moodboard: capped });
  } catch (e) {
    console.error('[api] moodboard POST', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!canAccessBrand(req, id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { url } = await req.json() as { url?: string };
    if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

    const items = readMoodboard(id).filter(m => m.url !== url);
    writeMoodboard(id, items);
    return NextResponse.json({ ok: true, moodboard: items });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

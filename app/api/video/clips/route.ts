export const dynamic = 'force-dynamic';
/**
 * GET  /api/video/clips?brandId=x — list brand clip library
 * POST /api/video/clips — multipart upload:
 *   - video/* → save + ffprobe + Gemini autotag-lite → video_clips row
 *   - audio/* → save only, returns {url} (BGM for projects)
 */
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';
import { probe, IMAGES_DIR } from '@/lib/video/ffmpeg';
import { analyzeClip } from '@/lib/video/analyze';
import { getBrandId } from '@/lib/brand-guard';

export async function GET(req: NextRequest) {
  const brandId = getBrandId(req);
  const productId = req.nextUrl.searchParams.get('productId');
  const db = getDb();
  const clips = productId
    ? db.prepare(`SELECT * FROM video_clips WHERE brand_id=? AND (product_id=? OR product_id IS NULL)
                  ORDER BY (product_id=?) DESC, created_at DESC LIMIT 200`).all(brandId, productId, productId)
    : db.prepare('SELECT * FROM video_clips WHERE brand_id=? ORDER BY created_at DESC LIMIT 200').all(brandId);
  return NextResponse.json({ clips });
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const brandId = getBrandId(req) || (form.get('brandId') as string);
    const productId = (form.get('productId') as string) || null;
    if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });

    const id = uuid();
    const isAudio = file.type.startsWith('audio/') || /\.(mp3|m4a|wav|aac)$/i.test(file.name);
    const ext = path.extname(file.name).toLowerCase() || (isAudio ? '.mp3' : '.mp4');
    const filename = `${isAudio ? 'bgm' : 'vidclip'}_${id}${ext}`;
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
    fs.writeFileSync(path.join(IMAGES_DIR, filename), Buffer.from(await file.arrayBuffer()));
    const url = `/api/images/${filename}`;

    if (isAudio) return NextResponse.json({ ok: true, url, kind: 'audio' });

    const full = path.join(IMAGES_DIR, filename);
    const meta = await probe(full);
    const db = getDb();
    db.prepare(`INSERT INTO video_clips (id, brand_id, product_id, url, filename, duration_s, width, height, status)
      VALUES (?,?,?,?,?,?,?,?, 'tagging')`)
      .run(id, brandId, productId, url, filename, meta.duration, meta.width, meta.height);

    // Async clip analysis (Gemini video understanding → tags + scenes) — don't block
    const mime = ext === '.mov' ? 'video/quicktime' : ext === '.webm' ? 'video/webm' : 'video/mp4';
    void analyzeClip(full, mime, id).then(a => {
      if (a) db.prepare(`UPDATE video_clips SET tags_json=?, analysis_json=?, status='ready' WHERE id=?`)
        .run(JSON.stringify(a), JSON.stringify(a.scenes ?? []), id);
      else db.prepare(`UPDATE video_clips SET status='ready' WHERE id=?`).run(id);
    }).catch(() => db.prepare(`UPDATE video_clips SET status='ready' WHERE id=?`).run(id));

    return NextResponse.json({ ok: true, id, url, duration_s: meta.duration, kind: 'video', status: 'tagging' });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const db = getDb();
  const row = db.prepare('SELECT filename FROM video_clips WHERE id=?').get(id) as { filename: string } | undefined;
  if (row) { try { fs.unlinkSync(path.join(IMAGES_DIR, row.filename)); } catch { /* gone */ } }
  db.prepare('DELETE FROM video_clips WHERE id=?').run(id);
  return NextResponse.json({ ok: true });
}

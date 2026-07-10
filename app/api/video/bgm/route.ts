export const dynamic = 'force-dynamic';
/**
 * Kho nhạc nền (BGM library) per-brand.
 * GET    /api/video/bgm
 * POST   — multipart (mp3/audio HOẶC video → bóc nhạc) | JSON { url } (link reel/video
 *          công khai → yt-dlp chỉ lấy audio, chạy nền)
 * DELETE /api/video/bgm?id=x
 */
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';
import { probe, detectBeats, IMAGES_DIR } from '@/lib/video/ffmpeg';
import { extractAudioFromVideo } from '@/lib/video/ingest';
import { downloadSourceAudio, isAllowedSourceUrl } from '@/lib/inspiration/download';

export async function GET(req: NextRequest) {
  const brandId = getBrandId(req);
  const tracks = getDb().prepare(
    'SELECT * FROM bgm_tracks WHERE brand_id=? ORDER BY created_at DESC LIMIT 200'
  ).all(brandId);
  return NextResponse.json({ tracks });
}

/** probe duration + detect BPM rồi đánh dấu ready. Nuốt lỗi BPM (không bắt buộc). */
async function finalizeTrack(id: string, filename: string) {
  const db = getDb();
  const full = path.join(IMAGES_DIR, filename);
  let dur = 0; let bpm: number | null = null;
  try { dur = (await probe(full)).duration; } catch { /* vẫn dùng được */ }
  try { bpm = (await detectBeats(full)).bpm; } catch { /* beat-sync optional */ }
  db.prepare(`UPDATE bgm_tracks SET duration_s=?, bpm=?, status='ready', error=NULL WHERE id=?`)
    .run(dur, bpm, id);
}

export async function POST(req: NextRequest) {
  try {
    const brandId = getBrandId(req);
    const db = getDb();
    const id = uuid();
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file') as File | null;
      if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });
      const isAudio = file.type.startsWith('audio/') || /\.(mp3|m4a|wav|aac|ogg)$/i.test(file.name);
      const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(file.name);
      if (!isAudio && !isVideo) return NextResponse.json({ error: 'Chỉ nhận file nhạc (mp3/m4a/wav) hoặc video (tự bóc nhạc)' }, { status: 400 });

      fs.mkdirSync(IMAGES_DIR, { recursive: true });
      let filename: string;
      if (isAudio) {
        filename = `bgm_${id}${path.extname(file.name).toLowerCase() || '.mp3'}`;
        fs.writeFileSync(path.join(IMAGES_DIR, filename), Buffer.from(await file.arrayBuffer()));
      } else {
        // video → lưu tạm rồi bóc audio track
        const tmpVideo = `bgmsrc_${id}${path.extname(file.name).toLowerCase() || '.mp4'}`;
        fs.writeFileSync(path.join(IMAGES_DIR, tmpVideo), Buffer.from(await file.arrayBuffer()));
        try {
          const { url } = await extractAudioFromVideo(tmpVideo);
          filename = url.replace('/api/images/', '');
        } finally {
          try { fs.unlinkSync(path.join(IMAGES_DIR, tmpVideo)); } catch { /* gone */ }
        }
      }
      const name = (form.get('name') as string)?.trim() || file.name.replace(/\.[^.]+$/, '');
      db.prepare(`INSERT INTO bgm_tracks (id, brand_id, name, url, filename, source, status)
        VALUES (?,?,?,?,?,?, 'processing')`)
        .run(id, brandId, name, `/api/images/${filename}`, filename, isAudio ? 'upload' : 'video_extract');
      await finalizeTrack(id, filename);
      const track = db.prepare('SELECT * FROM bgm_tracks WHERE id=?').get(id);
      return NextResponse.json({ ok: true, track });
    }

    // JSON { url, name } — link reel/video → chỉ lấy audio (chạy nền, UI poll)
    const body = await req.json() as { url?: string; name?: string };
    const url = body.url?.trim();
    if (!url) return NextResponse.json({ error: 'Cần link video/reel hoặc upload file' }, { status: 400 });
    if (!isAllowedSourceUrl(url)) {
      return NextResponse.json({ error: 'Chỉ nhận link https công khai của Instagram / Facebook / TikTok / YouTube' }, { status: 400 });
    }
    db.prepare(`INSERT INTO bgm_tracks (id, brand_id, name, url, filename, source, source_url, status)
      VALUES (?,?,?,?,?, 'link', ?, 'processing')`)
      .run(id, brandId, body.name?.trim() || url.slice(0, 60), `/api/images/bgm_${id}.mp3`, `bgm_${id}.mp3`, url);
    void (async () => {
      try {
        const filename = await downloadSourceAudio(url, id);
        await finalizeTrack(id, filename);
      } catch (e) {
        getDb().prepare(`UPDATE bgm_tracks SET status='failed', error=? WHERE id=?`)
          .run(String(e instanceof Error ? e.message : e).slice(0, 400), id);
      }
    })();
    return NextResponse.json({ ok: true, id, status: 'processing' });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const brandId = getBrandId(req);
  const db = getDb();
  const row = db.prepare('SELECT filename FROM bgm_tracks WHERE id=? AND brand_id=?').get(id, brandId) as { filename: string } | undefined;
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try { fs.unlinkSync(path.join(IMAGES_DIR, row.filename)); } catch { /* gone */ }
  db.prepare('DELETE FROM bgm_tracks WHERE id=? AND brand_id=?').run(id, brandId);
  return NextResponse.json({ ok: true });
}

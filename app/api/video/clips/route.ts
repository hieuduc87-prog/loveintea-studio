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
import { probe, extractFrames, IMAGES_DIR, TMP_DIR } from '@/lib/video/ffmpeg';
import { analyzeImage } from '@/lib/gemini';

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get('brandId') || 'loveintea';
  const clips = getDb().prepare(
    'SELECT * FROM video_clips WHERE brand_id=? ORDER BY created_at DESC LIMIT 200'
  ).all(brandId);
  return NextResponse.json({ clips });
}

const TAG_PROMPT = `Tag this video frame for a brand footage library. Return ONLY JSON:
{"subject":"main subject, 2-5 words","scene":"location/setting","mood":"calm|energetic|cozy|fresh|dramatic|joyful",
"motion":"static|slow|medium|fast","colors":["dominant","colors"],"has_product":true/false,
"has_text":true/false,"quality":"high|medium|low","time_of_day":"morning|afternoon|evening|night|studio","shot":"close-up|medium|wide"}`;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const brandId = (form.get('brandId') as string) || 'loveintea';
    if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });

    const id = uuid();
    const isAudio = file.type.startsWith('audio/') || /\.(mp3|m4a|wav|aac)$/i.test(file.name);
    const ext = path.extname(file.name).toLowerCase() || (isAudio ? '.mp3' : '.mp4');
    const filename = `${isAudio ? 'bgm' : 'vidclip'}_${id}${ext}`;
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
    fs.writeFileSync(path.join(IMAGES_DIR, filename), Buffer.from(await file.arrayBuffer()));
    const url = `/api/images/${filename}`;

    if (isAudio) return NextResponse.json({ ok: true, url, kind: 'audio' });

    const meta = await probe(path.join(IMAGES_DIR, filename));
    const db = getDb();
    db.prepare(`INSERT INTO video_clips (id, brand_id, url, filename, duration_s, width, height, status)
      VALUES (?,?,?,?,?,?,?, 'tagging')`)
      .run(id, brandId, url, filename, meta.duration, meta.width, meta.height);

    // Autotag from middle frame (lite version of bigai 47-field tagger)
    let tags: Record<string, unknown> = {};
    try {
      const qaDir = path.join(TMP_DIR, `tag_${id}`);
      const frames = await extractFrames(path.join(IMAGES_DIR, filename), qaDir, 3);
      const raw = await analyzeImage(fs.readFileSync(frames[1]), 'image/jpeg', TAG_PROMPT);
      const m = raw.match(/\{[\s\S]*\}/);
      tags = JSON.parse(m ? m[0] : raw);
      fs.rmSync(qaDir, { recursive: true, force: true });
    } catch (e) { console.warn('[clips] autotag failed:', e); }
    db.prepare(`UPDATE video_clips SET tags_json=?, status='ready' WHERE id=?`).run(JSON.stringify(tags), id);

    return NextResponse.json({ ok: true, id, url, duration_s: meta.duration, tags, kind: 'video' });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
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

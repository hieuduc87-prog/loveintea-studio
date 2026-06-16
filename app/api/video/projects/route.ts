export const dynamic = 'force-dynamic';
/**
 * GET  /api/video/projects?brandId=x
 * POST /api/video/projects — create project: detect BPM (if BGM) → director
 *      builds the storyboard → saved as draft for review.
 */
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';
import { buildStoryboard } from '@/lib/video/director';
import { detectBeats, IMAGES_DIR } from '@/lib/video/ffmpeg';

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get('brandId') || 'loveintea';
  const projects = getDb().prepare(
    'SELECT * FROM video_projects WHERE brand_id=? ORDER BY created_at DESC LIMIT 100'
  ).all(brandId);
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      brandId?: string; title?: string; purpose?: string; productId?: string;
      targetDurationS?: number; bgmUrl?: string; notes?: string;
      useVoiceover?: boolean; voVoice?: string; language?: string;
    };
    const brandId = body.brandId || 'loveintea';
    const purpose = body.purpose || 'promo';
    const targetDurationS = Math.min(60, Math.max(10, body.targetDurationS || 20));

    // BPM from BGM (beat-synced cuts)
    let bpm: number | null = null;
    if (body.bgmUrl) {
      const f = path.join(IMAGES_DIR, body.bgmUrl.replace('/api/images/', ''));
      if (fs.existsSync(f)) {
        try { bpm = (await detectBeats(f)).bpm; } catch (e) { console.warn('[video] BPM detect failed:', e); }
      }
    }

    const board = await buildStoryboard({
      brandId, purpose, productId: body.productId,
      targetDurationS, bpm, notes: body.notes, language: body.language,
    });

    const id = uuid();
    const voVoice = ['nova', 'shimmer', 'alloy', 'echo', 'fable', 'onyx'].includes(body.voVoice || '') ? body.voVoice : 'nova';
    getDb().prepare(`INSERT INTO video_projects
      (id, brand_id, title, purpose, product_id, target_duration_s, bgm_url, bpm, script_json, status,
       use_voiceover, vo_script, vo_voice)
      VALUES (?,?,?,?,?,?,?,?,?, 'draft', ?,?,?)`)
      .run(id, brandId, body.title || board.title, purpose, body.productId ?? null,
        targetDurationS, body.bgmUrl ?? null, bpm, JSON.stringify(board),
        body.useVoiceover ? 1 : 0, board.voiceover ?? '', voVoice);

    return NextResponse.json({ ok: true, id, bpm, storyboard: board });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

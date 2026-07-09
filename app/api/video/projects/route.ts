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
import { buildStoryboard, VideoRecipe } from '@/lib/video/director';
import { enforceRateLimit } from '@/lib/rate-limit';
import { analyzeReferenceVideo, analysisToRecipe } from '@/lib/video/analyze-reference';
import { detectBeats, IMAGES_DIR } from '@/lib/video/ffmpeg';
import { getBrandId } from '@/lib/brand-guard';

export async function GET(req: NextRequest) {
  const brandId = getBrandId(req);
  const projects = getDb().prepare(
    'SELECT * FROM video_projects WHERE brand_id=? ORDER BY created_at DESC LIMIT 100'
  ).all(brandId);
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { scope: 'ai:video', limit: 10, windowMs: 60_000 });
  if (limited) return limited;
  try {
    const body = await req.json() as {
      brandId?: string; title?: string; purpose?: string; productId?: string;
      targetDurationS?: number; bgmUrl?: string; notes?: string;
      useVoiceover?: boolean; voVoice?: string; language?: string; referenceClipId?: string;
    };
    const brandId = getBrandId(req) || body.brandId || '';
    const purpose = body.purpose || 'promo';
    const targetDurationS = Math.min(60, Math.max(10, body.targetDurationS || 20));
    const db = getDb();

    // BPM from BGM (beat-synced cuts)
    let bpm: number | null = null;
    if (body.bgmUrl) {
      const f = path.join(IMAGES_DIR, body.bgmUrl.replace('/api/images/', ''));
      if (fs.existsSync(f)) {
        try { bpm = (await detectBeats(f)).bpm; } catch (e) { console.warn('[video] BPM detect failed:', e); }
      }
    }

    // Reference video → recipe (reverse-engineer a proven viral structure to follow)
    let recipe: VideoRecipe | null = null;
    if (body.referenceClipId) {
      const clip = db.prepare('SELECT filename FROM video_clips WHERE id=? AND brand_id=?').get(body.referenceClipId, brandId) as { filename: string } | undefined;
      if (clip) {
        const f = path.join(IMAGES_DIR, clip.filename);
        if (fs.existsSync(f)) {
          const mime = f.endsWith('.mov') ? 'video/quicktime' : f.endsWith('.webm') ? 'video/webm' : 'video/mp4';
          try {
            const analysis = await analyzeReferenceVideo(f, mime, body.referenceClipId);
            if (analysis) recipe = analysisToRecipe(analysis);
          } catch (e) { console.warn('[video] reference analysis failed:', e); }
        }
      }
    }

    const board = await buildStoryboard({
      brandId, purpose, productId: body.productId,
      targetDurationS, bpm, notes: body.notes, language: body.language, recipe,
    });

    const id = uuid();
    const voVoice = ['nova', 'shimmer', 'alloy', 'echo', 'fable', 'onyx'].includes(body.voVoice || '') ? body.voVoice : 'nova';
    db.prepare(`INSERT INTO video_projects
      (id, brand_id, title, purpose, product_id, target_duration_s, bgm_url, bpm, script_json, status,
       use_voiceover, vo_script, vo_voice, reference_recipe_json)
      VALUES (?,?,?,?,?,?,?,?,?, 'draft', ?,?,?,?)`)
      .run(id, brandId, body.title || board.title, purpose, body.productId ?? null,
        targetDurationS, body.bgmUrl ?? null, bpm, JSON.stringify(board),
        body.useVoiceover ? 1 : 0, board.voiceover ?? '', voVoice, recipe ? JSON.stringify(recipe) : null);

    return NextResponse.json({ ok: true, id, bpm, storyboard: board, recipe: recipe ? { scenes: recipe.scenes?.length ?? 0, structure: recipe.structure } : null });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

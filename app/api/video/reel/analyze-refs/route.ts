export const dynamic = 'force-dynamic';
export const maxDuration = 300;
/**
 * M0 — phân tích kho video mẫu (data/references/<brand>/iced_summer_reels/) thành
 * motion dictionary. Chạy 1 lần/template (nặng Gemini File API ~1-2 phút cho 5 clip).
 * Reference chỉ dạy GRAMMAR — không giữ nhận diện đối thủ (luật đề bài Phiếu B).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getBrandId } from '@/lib/brand-guard';
import { enforceRateLimit } from '@/lib/rate-limit';
import { createJob, logJob, finishJob, failJob } from '@/lib/jobs';
import { analyzeReferenceLibrary } from '@/lib/video/reel-director';

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { scope: 'ai:reel-refs', limit: 2, windowMs: 300_000 });
  if (limited) return limited;
  const brandId = getBrandId(req);
  const jobId = createJob({ brandId, kind: 'reference', source: 'ReelMachine', title: '📚 Phân tích video mẫu → motion dictionary' });
  try {
    const result = await analyzeReferenceLibrary(brandId, undefined, m => logJob(jobId, m));
    finishJob(jobId, { clips: result.clips });
    return NextResponse.json({ ok: true, jobId, clips: result.clips });
  } catch (e) {
    failJob(jobId, e);
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e).slice(0, 400) }, { status: 500 });
  }
}

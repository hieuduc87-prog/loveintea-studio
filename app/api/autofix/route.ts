export const dynamic = 'force-dynamic';
/**
 * AUTOFIX AGENT API — cổng duy nhất cho cloud routine kanban auto-fix (không SSH).
 * Auth: header `x-agent-token` so timing-safe với env AGENT_KANBAN_TOKEN.
 * Middleware đã exclude /api/autofix khỏi NextAuth — route TỰ gác bằng token.
 *
 * GET  /api/autofix                 → { cards: [card mở], rendering: [...], deployedRev }
 * GET  /api/autofix?id=<cardId>     → { card } đầy đủ
 * GET  /api/autofix?video=<RM-...>  → { video } (plan + render_log + cost) để dò lỗi theo mã
 * PATCH { id, status?, fixResult? } → cập nhật card
 * PATCH { requeueVideo: "RM-..." }  → video failed → queued (render lại)
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';
import { runWithBrand } from '@/lib/tenant-context';
import { enforceRateLimit } from '@/lib/rate-limit';

/** P3: video_projects nằm trong DB từng brand — quét mọi brand (tool nội bộ). */
function eachBrand<T>(fn: () => T): T[] {
  const brands = (getDb().prepare('SELECT id FROM brands').all() as Array<{ id: string }>).map(b => b.id);
  const out: T[] = [];
  for (const b of brands) { try { out.push(runWithBrand(b, fn)); } catch { /* brand chưa có DB */ } }
  return out;
}
import { DATA_DIR } from '@/lib/video/ffmpeg';

const KANBAN_DIR = path.join(DATA_DIR, 'kanban');

function authorized(req: NextRequest): boolean {
  const want = process.env.AGENT_KANBAN_TOKEN || '';
  const got = req.headers.get('x-agent-token') || '';
  if (!want || want.length < 24) return false; // env chưa cấu hình = đóng cửa
  const a = Buffer.from(want), b = Buffer.from(got);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function readCard(id: string): Record<string, unknown> | null {
  // id là uuid do app sinh — chặn traversal bằng whitelist ký tự
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(id)) return null;
  try { return JSON.parse(fs.readFileSync(path.join(KANBAN_DIR, id, 'card.json'), 'utf8')); }
  catch { return null; }
}

function deployedRev(): string {
  try { return fs.readFileSync(path.join(DATA_DIR, 'deployed_rev.txt'), 'utf8').trim(); }
  catch { return ''; }
}

export async function GET(req: NextRequest) {
  // Middleware exclude route này (agent gọi bằng token riêng, không có session)
  // → không có phanh nào khác: AGENT_KANBAN_TOKEN sẽ bị dò không giới hạn.
  const limited = enforceRateLimit(req, { scope: 'autofix', limit: 60, windowMs: 60_000 });
  if (limited) return limited;
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id');
  const video = req.nextUrl.searchParams.get('video');

  if (id) {
    const card = readCard(id);
    return card ? NextResponse.json({ card }) : NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  if (video) {
    const code = video.replace(/[^A-Za-z0-9-]/g, '').slice(0, 40);
    const row = eachBrand(() => getDb().prepare(
      `SELECT id, video_code, title, status, error, output_url, script_json, render_log, grade_json, created_at, updated_at
       FROM video_projects WHERE video_code=?`
    ).get(code)).find(Boolean);
    return row ? NextResponse.json({ video: row }) : NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const cards: Array<Record<string, unknown>> = [];
  try {
    for (const d of fs.readdirSync(KANBAN_DIR)) {
      const c = readCard(d);
      if (c && ['todo', 'fix_failed', 'doing'].includes(String(c.status || 'todo'))) cards.push(c);
    }
  } catch { /* chưa có kanban dir */ }
  const rendering = eachBrand(() => getDb().prepare(
    `SELECT id, video_code, status FROM video_projects WHERE status IN ('queued','rendering')`
  ).all()).flat();
  return NextResponse.json({ cards, rendering, deployedRev: deployedRev() });
}

export async function PATCH(req: NextRequest) {
  const limited = enforceRateLimit(req, { scope: 'autofix', limit: 60, windowMs: 60_000 });
  if (limited) return limited;
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({})) as {
    id?: string; status?: string; fixResult?: string; requeueVideo?: string;
  };

  if (body.requeueVideo) {
    const code = String(body.requeueVideo).replace(/[^A-Za-z0-9-]/g, '').slice(0, 40);
    const requeued = eachBrand(() => getDb().prepare(
      `UPDATE video_projects SET status='queued', error=NULL WHERE video_code=? AND status='failed'`
    ).run(code).changes).reduce((a, b) => a + b, 0);
    return NextResponse.json({ ok: true, requeued });
  }

  const id = String(body.id || '');
  const card = readCard(id);
  if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 });
  // Allowlist trường được sửa — agent KHÔNG xoá card, không đổi trường khác
  if (body.status && ['todo', 'doing', 'fixed', 'fix_failed'].includes(body.status)) card.status = body.status;
  if (typeof body.fixResult === 'string') card.fixResult = body.fixResult.slice(0, 4000);
  card.updatedAt = new Date().toISOString();
  fs.writeFileSync(path.join(KANBAN_DIR, id, 'card.json'), JSON.stringify(card, null, 2));
  return NextResponse.json({ ok: true, card: { id, status: card.status } });
}

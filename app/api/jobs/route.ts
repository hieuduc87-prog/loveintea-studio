export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db     = getDb();
  const status = req.nextUrl.searchParams.get('status');
  const limit  = parseInt(req.nextUrl.searchParams.get('limit') ?? '50');

  const jobs = status
    ? db.prepare('SELECT * FROM image_jobs WHERE status=? ORDER BY created_at DESC LIMIT ?').all(status, limit)
    : db.prepare('SELECT * FROM image_jobs ORDER BY created_at DESC LIMIT ?').all(limit);

  const counts = db.prepare(`
    SELECT status, COUNT(*) as count FROM image_jobs GROUP BY status
  `).all() as { status: string; count: number }[];

  return NextResponse.json({ jobs, counts });
}

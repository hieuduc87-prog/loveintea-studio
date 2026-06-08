export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const brand = req.nextUrl.searchParams.get('brand') || 'loveintea';
  const category = req.nextUrl.searchParams.get('category');
  const format = req.nextUrl.searchParams.get('format');
  const active = req.nextUrl.searchParams.get('active');
  const search = req.nextUrl.searchParams.get('q');
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '100');

  let sql = 'SELECT * FROM content_templates WHERE brand_id = ?';
  const params: (string | number)[] = [brand];

  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (format)   { sql += ' AND format = ?';   params.push(format); }
  if (active === '1') { sql += ' AND is_active = 1'; }
  if (active === '0') { sql += ' AND is_active = 0'; }
  if (search)   { sql += ' AND (name LIKE ? OR purpose LIKE ? OR tags LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

  sql += ' ORDER BY usage_count DESC, created_at DESC LIMIT ?';
  params.push(limit);

  const templates = db.prepare(sql).all(...params);
  return NextResponse.json({ templates });
}

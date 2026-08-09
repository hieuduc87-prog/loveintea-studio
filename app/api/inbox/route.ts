export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';
import { requireAdminSession } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  // SEC (vbsec C3): inbox_messages chứa PII khách cuối (Messenger). Route cũ không
  // vào brand context + không gác → IDOR (sống lại nếu kill-switch DB-per-tenant tắt).
  // Vá: vào context tenant TRƯỚC (getDb bind đúng DB brand) + chỉ admin xem hộp thư.
  const auth = await requireAdminSession();
  if ('error' in auth) return auth.error;
  getBrandId(req);
  const db = getDb();
  const messages = db.prepare('SELECT * FROM inbox_messages ORDER BY received_at DESC LIMIT 100').all();
  return NextResponse.json({ messages });
}

export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const messages = db.prepare('SELECT * FROM inbox_messages ORDER BY received_at DESC LIMIT 100').all();
  return NextResponse.json({ messages });
}

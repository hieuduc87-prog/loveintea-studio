export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getPageInbox } from '@/lib/facebook';
import { v4 as uuid } from 'uuid';

export async function POST() {
  try {
    const db   = getDb();
    const data = await getPageInbox(50) as {
      data?: Array<{
        id: string;
        snippet?: string;
        updated_time?: string;
        unread_count?: number;
        participants?: { data?: Array<{ id: string; name?: string }> };
      }>;
    };

    const convos = data?.data ?? [];
    let imported = 0;

    for (const c of convos) {
      const existing = db.prepare('SELECT id FROM inbox_messages WHERE id = ?').get(c.id);
      if (existing) continue;

      const sender    = c.participants?.data?.find((p) => p.id !== process.env.FB_PAGE_ID);
      db.prepare(`
        INSERT OR IGNORE INTO inbox_messages (id, platform, sender_id, sender_name, message_type, text, is_read, received_at, raw_json)
        VALUES (?, 'facebook', ?, ?, 'message', ?, ?, ?, ?)
      `).run(
        c.id,
        sender?.id ?? '',
        sender?.name ?? 'Unknown',
        c.snippet ?? '',
        c.unread_count ? 0 : 1,
        c.updated_time ?? new Date().toISOString(),
        JSON.stringify(c),
      );
      imported++;
    }

    return NextResponse.json({ ok: true, imported });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// Suppress uuid unused warning
void uuid;

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { v4 as uuid } from 'uuid';
import { getDb } from '@/lib/db';
import { authOptions } from '@/lib/auth-options';

export async function GET() {
  const db = getDb();
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? 'viewer';
  const userId = session?.user?.id;

  // Brand scoping: admins see all; members see assigned brands;
  // users with no membership rows see all (legacy single-team behavior)
  let brands: unknown[];
  if (role === 'admin' || role === 'root_admin' || !userId) {
    brands = db.prepare(`
      SELECT b.*,
        (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id) as product_count
      FROM brands b ORDER BY b.name
    `).all();
  } else {
    const memberships = db.prepare(`SELECT brand_id FROM brand_members WHERE user_id = ?`).all(userId) as Array<{ brand_id: string }>;
    // TENANT ISOLATION: a non-admin with no membership sees NOTHING (no more
    // legacy "see all"). Customers only ever see stores explicitly assigned.
    if (memberships.length === 0) {
      brands = [];
    } else {
      const placeholders = memberships.map(() => '?').join(',');
      brands = db.prepare(`
        SELECT b.*,
          (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id) as product_count
        FROM brands b WHERE b.id IN (${placeholders}) ORDER BY b.name
      `).all(...memberships.map(m => m.brand_id));
    }
  }
  return NextResponse.json({ brands });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  // Creating a store is a super-admin (platform-owner) action only.
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? 'viewer';
  if (role !== 'admin' && role !== 'root_admin') {
    return NextResponse.json({ error: 'Forbidden — chỉ super-admin được tạo store.' }, { status: 403 });
  }
  const body = await req.json() as {
    name: string; slug?: string; domain?: string; logo_url?: string;
  };
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const slug = body.slug?.trim() ||
    body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const id = slug; // use slug as ID for readability

  try {
    db.prepare(`
      INSERT INTO brands (id, name, slug, logo_url, domain, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(id, body.name.trim(), slug, body.logo_url || null, body.domain || null);

    // Seed empty brand_dna
    db.prepare(`
      INSERT OR IGNORE INTO brand_dna (id, brand_id) VALUES (?, ?)
    `).run(uuid(), id);

    return NextResponse.json({ ok: true, id, slug });
  } catch {
    return NextResponse.json({ error: 'Brand slug already exists' }, { status: 400 });
  }
}

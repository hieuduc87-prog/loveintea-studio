/**
 * Platform provisioning helpers (BigAI MKT super-admin operations).
 *
 * The platform hosts many tenant stores (loveintea, bazan, rootin, …). These
 * helpers create stores and attach customer users, and are called only from
 * admin-gated /api/admin/stores routes.
 */
import { getDb } from './db';
import { v4 as uuid } from 'uuid';

export interface StoreStats {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  domain: string | null;
  created_at: string | null;
  products: number;
  posts: number;
  members: number;
  fb_connected: boolean;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Create a tenant store (brand) + seed an empty brand_dna row. Throws on dup slug. */
export function createStore(input: { name: string; slug?: string; logo_url?: string; domain?: string }): { id: string; slug: string } {
  const db = getDb();
  const name = input.name.trim();
  if (!name) throw new Error('Name required');
  const slug = (input.slug?.trim() || slugify(name));
  if (!slug) throw new Error('Invalid slug');
  const id = slug; // slug doubles as readable id (matches existing convention)

  const exists = db.prepare('SELECT 1 FROM brands WHERE id=? OR slug=?').get(id, slug);
  if (exists) throw new Error('Store slug already exists');

  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO brands (id, name, slug, logo_url, domain, created_at) VALUES (?,?,?,?,?,datetime('now'))`)
      .run(id, name, slug, input.logo_url || null, input.domain || null);
    db.prepare(`INSERT OR IGNORE INTO brand_dna (id, brand_id) VALUES (?,?)`).run(uuid(), id);
  });
  tx();
  return { id, slug };
}

/** All stores with per-tenant stats for the platform dashboard. */
export function getStoresWithStats(): StoreStats[] {
  const db = getDb();
  return db.prepare(`
    SELECT b.id, b.name, b.slug, b.logo_url, b.domain, b.created_at,
      (SELECT COUNT(*) FROM products p       WHERE p.brand_id = b.id) AS products,
      (SELECT COUNT(*) FROM posts pt         WHERE pt.brand_id = b.id) AS posts,
      (SELECT COUNT(*) FROM brand_members bm  WHERE bm.brand_id = b.id) AS members,
      (SELECT COUNT(*) FROM channels c        WHERE c.brand_id = b.id AND c.platform='facebook' AND c.status='active') AS fb_channels
    FROM brands b
    ORDER BY b.created_at DESC, b.name
  `).all().map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
      logo_url: (row.logo_url as string) ?? null,
      domain: (row.domain as string) ?? null,
      created_at: (row.created_at as string) ?? null,
      products: Number(row.products) || 0,
      posts: Number(row.posts) || 0,
      members: Number(row.members) || 0,
      fb_connected: Number(row.fb_channels) > 0,
    };
  });
}

export interface StoreMember {
  id: string;
  email: string;
  name: string | null;
  role: string;
  is_approved: number;
  member_role: string;
  last_login: string | null;
}

export function getStoreMembers(brandId: string): StoreMember[] {
  const db = getDb();
  return db.prepare(`
    SELECT u.id, u.email, u.name, u.role, u.is_approved, u.last_login, bm.role AS member_role
    FROM brand_members bm
    JOIN auth_users u ON u.id = bm.user_id
    WHERE bm.brand_id = ?
    ORDER BY u.email
  `).all(brandId) as StoreMember[];
}

/**
 * Attach a customer to a store. Creates the user pre-approved (so they can sign
 * in with Google immediately) with a store-scoped writing role ('editor'), and
 * adds the brand_members row. Never downgrades an existing admin.
 */
export function inviteToStore(input: { email: string; brandId: string; role?: string; memberRole?: string }): { userId: string; created: boolean } {
  const db = getDb();
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error('email required');
  const brand = db.prepare('SELECT id FROM brands WHERE id=?').get(input.brandId);
  if (!brand) throw new Error('Store not found');

  const role = input.role || 'editor'; // customer default: writes, scoped to brand
  const memberRole = input.memberRole || 'member';

  const existing = db.prepare('SELECT id, role FROM auth_users WHERE email=?').get(email) as { id: string; role: string } | undefined;

  let userId: string;
  let created = false;
  const tx = db.transaction(() => {
    if (existing) {
      userId = existing.id;
      // Only elevate viewer→editor; never touch admin/root_admin/editor.
      if (existing.role === 'viewer') {
        db.prepare('UPDATE auth_users SET role=?, is_approved=1 WHERE id=?').run(role, userId);
      }
    } else {
      userId = uuid();
      created = true;
      db.prepare(`INSERT INTO auth_users (id, name, email, role, is_approved, created_at) VALUES (?,?,?,?,1,datetime('now'))`)
        .run(userId, email, email, role);
    }
    db.prepare(`INSERT OR IGNORE INTO brand_members (user_id, brand_id, role, created_at) VALUES (?,?,?,datetime('now'))`)
      .run(userId, input.brandId, memberRole);
  });
  tx();
  // @ts-expect-error assigned in tx
  return { userId, created };
}

export function removeMember(userId: string, brandId: string): void {
  getDb().prepare('DELETE FROM brand_members WHERE user_id=? AND brand_id=?').run(userId, brandId);
}

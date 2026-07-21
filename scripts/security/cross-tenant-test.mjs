#!/usr/bin/env node
/**
 * Cross-tenant isolation test — proves store A cannot touch store B's resources.
 *
 * Seeds two throwaway stores (sectest-a / sectest-b) + resources owned by B,
 * logs in as a NON-admin editor of store A (real NextAuth credentials session),
 * then hits every [id]/tenant endpoint with B's ids and asserts 403/404.
 * Positive controls confirm A CAN reach its own resources (guard isn't blanket-deny).
 * All seeded rows are prefixed `sectest-` and removed on exit — never touches real data.
 *
 * Run against a LOCAL server (http, no COOKIE_DOMAIN so the session cookie is settable):
 *   1) npm run build && npm start        # server on :3202
 *   2) node scripts/security/cross-tenant-test.mjs
 * Env: BASE_URL (default http://localhost:3202), DATA_DIR (default ./data)
 */
import Database from 'better-sqlite3';
import { scryptSync, randomBytes } from 'crypto';
import path from 'path';

const BASE = (process.env.BASE_URL || 'http://localhost:3202').replace(/\/$/, '');
const DB_PATH = path.join(process.env.DATA_DIR || 'data', 'studio.db');
const PW = 'Sectest-Pw-123456';
const P = 'sectest-'; // id/email prefix — cleanup key

function hashPassword(pw) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pw, salt, 64).toString('hex')}`;
}

// ── Seed ──────────────────────────────────────────────────────────────────
function seed(db) {
  const tx = db.transaction(() => {
    for (const b of ['a', 'b']) {
      db.prepare('INSERT OR REPLACE INTO brands (id, name, slug) VALUES (?,?,?)')
        .run(`${P}${b}`, `Sectest ${b.toUpperCase()}`, `${P}${b}`);
    }
    // Editor of store A (non-admin, can write, scoped to A). Approved so login works.
    db.prepare(`INSERT OR REPLACE INTO auth_users (id, name, email, role, is_approved, password_hash)
      VALUES (?,?,?,?,1,?)`).run(`${P}user-a`, 'Sectest A', `${P}a@example.com`, 'editor', hashPassword(PW));
    db.prepare('INSERT OR REPLACE INTO brand_members (user_id, brand_id, role) VALUES (?,?,?)')
      .run(`${P}user-a`, `${P}a`, 'member');

    // B-owned resources (the victims) + one A-owned product (positive control).
    db.prepare('INSERT OR REPLACE INTO products (id, brand_id, slug, name) VALUES (?,?,?,?)')
      .run(`${P}b-product`, `${P}b`, `${P}b-prod`, 'B Product');
    db.prepare('INSERT OR REPLACE INTO products (id, brand_id, slug, name) VALUES (?,?,?,?)')
      .run(`${P}a-product`, `${P}a`, `${P}a-prod`, 'A Product');
    db.prepare('INSERT OR REPLACE INTO posts (id, brand_id, sku_id, caption, platforms, status) VALUES (?,?,?,?,?,?)')
      .run(`${P}b-post`, `${P}b`, '', 'B caption', 'facebook', 'draft');
    db.prepare('INSERT OR REPLACE INTO content_plans (id, brand_id, title) VALUES (?,?,?)')
      .run(`${P}b-plan`, `${P}b`, 'B Plan');
    db.prepare('INSERT OR REPLACE INTO content_templates (id, brand_id, name, image_url) VALUES (?,?,?,?)')
      .run(`${P}b-tpl`, `${P}b`, 'B Template', '/api/images/none.png');
    db.prepare('INSERT OR REPLACE INTO knowledge_docs (id, brand_id, type, title) VALUES (?,?,?,?)')
      .run(`${P}b-doc`, `${P}b`, 'rule', 'B Doc');
    db.prepare('INSERT OR REPLACE INTO video_clips (id, brand_id, product_id, url, filename) VALUES (?,?,?,?,?)')
      .run(`${P}b-clip`, `${P}b`, `${P}b-product`, '/api/images/none.mp4', 'none.mp4');
    // [LIT-SEC-0721A] blog + image_library (feature loveintea-legacy vừa được scope brand)
    db.prepare('INSERT OR REPLACE INTO blog_posts (id, brand_id, sku_id, topic, title, status) VALUES (?,?,?,?,?,?)')
      .run(`${P}b-blog`, `${P}b`, '', 'B topic', 'B blog', 'draft');
    db.prepare('INSERT OR REPLACE INTO image_library (id, brand_id, sku_id, image_url) VALUES (?,?,?,?)')
      .run(`${P}b-img`, `${P}b`, 'hibiscus', '/api/images/none.png');
  });
  tx();
}

function cleanup(db) {
  const tables = ['video_clips', 'knowledge_docs', 'content_templates', 'content_plans',
    'posts', 'products', 'blog_posts', 'image_library', 'brand_members', 'auth_users', 'brands'];
  for (const t of tables) {
    try {
      const col = t === 'brand_members' ? 'user_id' : t === 'auth_users' ? 'id' : 'id';
      db.prepare(`DELETE FROM ${t} WHERE ${col} LIKE ?`).run(`${P}%`);
      if (t === 'brand_members') db.prepare(`DELETE FROM ${t} WHERE brand_id LIKE ?`).run(`${P}%`);
    } catch { /* table may not exist in older schema */ }
  }
}

// ── NextAuth credentials login → cookie jar ────────────────────────────────
function mergeCookies(jar, res) {
  const set = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of set) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
}
const cookieHeader = (jar) => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');

async function login(email, password) {
  const jar = {};
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  mergeCookies(jar, csrfRes);
  const { csrfToken } = await csrfRes.json();
  const body = new URLSearchParams({ csrfToken, email, password, callbackUrl: BASE, json: 'true' });
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookieHeader(jar) },
    body, redirect: 'manual',
  });
  mergeCookies(jar, res);
  const hasSession = Object.keys(jar).some(k => k.includes('session-token'));
  if (!hasSession) throw new Error(`Login failed for ${email} (no session cookie; status ${res.status})`);
  return jar;
}

// ── Test matrix ────────────────────────────────────────────────────────────
const CROSS = [ // A hitting B's resources → must be 403/404
  ['GET',    `/api/brands/${P}b`],
  ['PATCH',  `/api/brands/${P}b`, { name: 'hacked' }],
  ['DELETE', `/api/brands/${P}b`],
  ['POST',   `/api/brands/${P}b/products`, { name: 'spam' }],
  ['GET',    `/api/products/${P}b-product/images`],
  ['GET',    `/api/products/${P}b-product/knowledge`],
  ['PUT',    `/api/products/${P}b-product/knowledge`, { knowledge: { x: '1' } }],
  ['DELETE', `/api/products/${P}b-product/videos?clipId=${P}b-clip`],
  ['POST',   `/api/products/${P}b-product/images/classify`, { all: true }],
  ['POST',   `/api/posts/${P}b-post/publish`],
  ['PUT',    `/api/posts/${P}b-post/tags`, { tags: [] }],
  ['POST',   `/api/plans/${P}b-plan/generate`, {}],
  ['POST',   `/api/content-templates/${P}b-tpl/analyze`],
  ['POST',   `/api/content-templates/${P}b-tpl/generate`, {}],
  ['POST',   `/api/review`, { postId: `${P}b-post` }],
  ['DELETE', `/api/video/clips?id=${P}b-clip`],
  // [LIT-SEC-0721A] brandId từ URL path / body — từng leak vì middleware chỉ validate ?brand=
  ['POST',   `/api/brands/${P}b/dna/extract`, { text: 'probe' }],
  ['POST',   `/api/image/generate`, { prompt: 'probe', brandId: `${P}b`, productId: `${P}b-product` }],
  // [LIT-SEC-0721B] GET đọc trọn nội dung brand khác qua PATH; blog + kho ảnh dùng chung
  ['GET',    `/api/brands/${P}b/mindmap`],
  ['GET',    `/api/brands/${P}b/segments`],
  ['GET',    `/api/blog/${P}b-blog`],
  ['DELETE', `/api/blog/${P}b-blog`],
  ['PATCH',  `/api/image-library/${P}b-img`, { is_favorite: 1 }],
  ['DELETE', `/api/image-library/${P}b-img`],
];
const POSITIVE = [ // A hitting its OWN resources → must NOT be 403 (guard isn't blanket-deny)
  ['GET', `/api/brands/${P}a`],
  ['GET', `/api/products/${P}a-product/images`],
];

async function call(jar, method, url, body) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: { cookie: cookieHeader(jar), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  return res.status;
}

async function main() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  let pass = 0, fail = 0;
  const fails = [];
  try {
    cleanup(db); seed(db);
    const jarA = await login(`${P}a@example.com`, PW);
    console.log(`\n🔐 Logged in as store-A editor. Base: ${BASE}\n`);

    console.log('── Cross-tenant (A → B, expect 403/404) ──');
    for (const [method, url, body] of CROSS) {
      const st = await call(jarA, method, url, body);
      const ok = st === 403 || st === 404;
      console.log(`  ${ok ? '✅' : '❌'} ${method} ${url} → ${st}`);
      ok ? pass++ : (fail++, fails.push(`${method} ${url} → ${st} (want 403/404)`));
    }

    console.log('\n── Positive control (A → A, expect NOT 403) ──');
    for (const [method, url, body] of POSITIVE) {
      const st = await call(jarA, method, url, body);
      const ok = st !== 403;
      console.log(`  ${ok ? '✅' : '❌'} ${method} ${url} → ${st}`);
      ok ? pass++ : (fail++, fails.push(`${method} ${url} → ${st} (own resource wrongly blocked)`));
    }
  } finally {
    cleanup(db); db.close();
  }

  console.log(`\n═══ ${pass} passed, ${fail} failed ═══`);
  if (fail) { console.log('FAILURES:'); fails.forEach(f => console.log('  • ' + f)); process.exit(1); }
  console.log('✅ Tenant isolation holds — store A cannot reach store B.');
}

main().catch((e) => { console.error('Test harness error:', e.message); process.exit(2); });

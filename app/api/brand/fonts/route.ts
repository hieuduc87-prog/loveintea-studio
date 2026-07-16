export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { getDb } from '@/lib/db';
import { getBrandId, assertResourceBrand } from '@/lib/brand-guard';

/**
 * Font chữ thương hiệu cho "Chữ lên ảnh" (card ce0d8091).
 * GET            -> fonts hiện có của brand ({ headline?, sub? })
 * POST (multipart: file, role) -> upload font (.ttf/.otf/.woff/.woff2), thay font cũ của role
 * DELETE ?role=  -> xoá font của role (quay về font mặc định)
 */
const ROLES = ['headline', 'sub'] as const;
const EXT_ALLOW = ['ttf', 'otf', 'woff', 'woff2'];
const MAX_SIZE = 8 * 1024 * 1024; // font hiếm khi quá 8MB

function fontsDir(brandId: string): string {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  return path.join(dataDir, 'fonts', brandId.replace(/[^a-z0-9_-]/gi, ''));
}

export async function GET(req: NextRequest) {
  const brandId = getBrandId(req) || 'loveintea';
  const rows = getDb().prepare('SELECT role, filename, original_name, created_at FROM brand_fonts WHERE brand_id=?')
    .all(brandId) as Array<{ role: string; filename: string; original_name: string; created_at: string }>;
  const fonts: Record<string, { filename: string; original_name: string; created_at: string }> = {};
  for (const r of rows) fonts[r.role] = { filename: r.filename, original_name: r.original_name, created_at: r.created_at };
  return NextResponse.json({ fonts });
}

export async function POST(req: NextRequest) {
  try {
    const brandId = getBrandId(req) || 'loveintea';
    const denied = assertResourceBrand(req, brandId);
    if (denied) return denied;

    const fd = await req.formData();
    const file = fd.get('file') as File | null;
    const role = String(fd.get('role') || '');
    if (!file) return NextResponse.json({ error: 'Thiếu file font' }, { status: 400 });
    if (!(ROLES as readonly string[]).includes(role)) return NextResponse.json({ error: 'role phải là headline | sub' }, { status: 400 });
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!EXT_ALLOW.includes(ext)) return NextResponse.json({ error: 'Font phải là .ttf / .otf / .woff / .woff2' }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File font quá lớn (tối đa 8MB)' }, { status: 400 });

    const dir = fontsDir(brandId);
    fs.mkdirSync(dir, { recursive: true });
    const filename = `${role}-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));

    // Thay font cũ của role (nếu có) — xoá cả file cũ cho gọn đĩa
    const db = getDb();
    const prev = db.prepare('SELECT filename FROM brand_fonts WHERE brand_id=? AND role=?').get(brandId, role) as { filename?: string } | undefined;
    db.prepare(`INSERT INTO brand_fonts (brand_id, role, filename, original_name) VALUES (?, ?, ?, ?)
                ON CONFLICT(brand_id, role) DO UPDATE SET filename=excluded.filename, original_name=excluded.original_name, created_at=datetime('now')`)
      .run(brandId, role, filename, file.name.slice(0, 120));
    if (prev?.filename && prev.filename !== filename) {
      try { fs.unlinkSync(path.join(dir, prev.filename)); } catch { /* file cũ có thể đã mất */ }
    }
    return NextResponse.json({ ok: true, role, filename, original_name: file.name });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[brand-fonts]', e), 'Lỗi upload font') }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const brandId = getBrandId(req) || 'loveintea';
  const denied = assertResourceBrand(req, brandId);
  if (denied) return denied;
  const role = req.nextUrl.searchParams.get('role') || '';
  if (!(ROLES as readonly string[]).includes(role)) return NextResponse.json({ error: 'role phải là headline | sub' }, { status: 400 });
  const db = getDb();
  const prev = db.prepare('SELECT filename FROM brand_fonts WHERE brand_id=? AND role=?').get(brandId, role) as { filename?: string } | undefined;
  db.prepare('DELETE FROM brand_fonts WHERE brand_id=? AND role=?').run(brandId, role);
  if (prev?.filename) { try { fs.unlinkSync(path.join(fontsDir(brandId), prev.filename)); } catch { /* */ } }
  return NextResponse.json({ ok: true });
}

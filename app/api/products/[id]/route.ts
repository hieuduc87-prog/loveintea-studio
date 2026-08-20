export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getBrandId, assertResourceBrand } from '@/lib/brand-guard';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  getBrandId(req); // P3: vào ngữ cảnh brand TRƯỚC mọi query — route query-rồi-assert đọc nhầm DB global rỗng → 404 oan (card 52672e19)
  const { id } = await params;
  const db = getDb();
  const product = db.prepare('SELECT * FROM products WHERE id=?').get(id) as { brand_id?: string } | undefined;
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const denied = assertResourceBrand(req, product.brand_id);
  if (denied) return denied;

  const images = db.prepare(
    'SELECT * FROM product_images WHERE product_id=? ORDER BY is_hero DESC, sort_order'
  ).all(id);

  return NextResponse.json({ product, images });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  getBrandId(req); // P3: vào ngữ cảnh brand TRƯỚC mọi query — route query-rồi-assert đọc nhầm DB global rỗng → 404 oan (card 52672e19)
  const { id } = await params;
  const db = getDb();
  const row = db.prepare('SELECT brand_id FROM products WHERE id=?').get(id) as { brand_id?: string } | undefined;
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const denied = assertResourceBrand(req, row.brand_id);
  if (denied) return denied;

  const body = await req.json() as Record<string, unknown>;

  const allowed = ['name', 'display_name', 'theme', 'color', 'color_name', 'ingredients', 'image_url', 'best_moment', 'use_cases', 'pitch'];
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(body)) {
    if (allowed.includes(k)) {
      sets.push(`${k}=?`);
      vals.push(typeof v === 'object' ? JSON.stringify(v) : v);
    }
  }
  if (sets.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  vals.push(id);
  db.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id=?`).run(...vals);
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/products/[id] — xoá sản phẩm khỏi brand.
 *
 * FIX HỆ THỐNG (card hoa-lang-thang "Không thể xoá hoặc điều chỉnh thông tin sản phẩm"):
 * route trước CHỈ có GET + PATCH → nút Xoá SP trả 405 cho MỌI brand. Fix cấp API →
 * áp dụng ngay cho loveintea/bazan/rootin/gossby/hoa-lang-thang/WhiteLotus/Oliva Pilates
 * + brand mới về sau.
 *
 * Cascade delete: product_images (FK), tài nguyên xoá được. GIỮ lại kanban/posts đã
 * publish (không sửa lịch sử) — chỉ xoá row products.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  getBrandId(req); // P3: vào ngữ cảnh brand TRƯỚC mọi query
  const { id } = await params;
  const db = getDb();

  // Ngăn xoá SP thuộc brand khác (403)
  const row = db.prepare('SELECT brand_id FROM products WHERE id=?').get(id) as { brand_id?: string } | undefined;
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const denied = assertResourceBrand(req, row.brand_id);
  if (denied) return denied;

  // Transaction: xoá ảnh SP trước (FK), rồi xoá SP
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM product_images WHERE product_id=?').run(id);
    db.prepare('DELETE FROM products WHERE id=?').run(id);
  });
  tx();

  return NextResponse.json({ ok: true, deleted: id });
}

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
/**
 * POST /api/products/[id]/images/classify { all?: boolean }
 * Phân loại ảnh sản phẩm bằng Gemini Vision → đặt tên + gắn ref_role để luồng gen tự chọn.
 * Mặc định chỉ phân loại ảnh CHƯA có ref_role; all=true để phân loại lại hết.
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { getDb } from '@/lib/db';
import { resolveProductImagePath } from '@/lib/plan-generate';
import { classifyProductImage } from '@/lib/product-image-classify';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const { all } = await req.json().catch(() => ({})) as { all?: boolean };
    const db = getDb();
    const rows = db.prepare('SELECT id, image_url, ref_role FROM product_images WHERE product_id=? ORDER BY sort_order').all(id) as Array<{ id: string; image_url: string; ref_role: string | null }>;
    const todo = all ? rows : rows.filter(r => !r.ref_role);
    if (!todo.length) return NextResponse.json({ ok: true, classified: 0, message: 'Không có ảnh cần phân loại' });

    const upd = db.prepare('UPDATE product_images SET type=?, angle=?, ref_role=?, ai_label=?, caption=COALESCE(NULLIF(caption,\'\'),?), analysis_json=? WHERE id=?');
    let done = 0; const errors: string[] = [];
    for (const r of todo) {
      const fp = resolveProductImagePath((r.image_url || '').split('?')[0]);
      if (!fp || !fs.existsSync(fp)) { errors.push(`${r.id.slice(0, 6)}: file không tồn tại`); continue; }
      const ext = fp.toLowerCase().split('.').pop();
      const mime = ext === 'webp' ? 'image/webp' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
      const c = await classifyProductImage(fs.readFileSync(fp), mime);
      if (!c) { errors.push(`${r.id.slice(0, 6)}: AI không phân loại được`); continue; }
      upd.run(c.type, c.angle, c.ref_role, c.label, c.content, JSON.stringify(c), r.id);
      done++;
    }
    return NextResponse.json({ ok: true, classified: done, total: todo.length, errors: errors.length ? errors : undefined });
  } catch (e) {
    console.error('[api] classify', e);
    return NextResponse.json({ error: `Phân loại ảnh lỗi: ${String(e instanceof Error ? e.message : e).slice(0, 200)}` }, { status: 500 });
  }
}

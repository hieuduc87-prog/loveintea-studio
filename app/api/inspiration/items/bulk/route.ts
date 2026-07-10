export const dynamic = 'force-dynamic';
/**
 * POST /api/inspiration/items/bulk — nhân viên dán NHIỀU link video (mỗi dòng 1 link).
 * Hệ thống lưu hết: tạo item cho từng link → tải video nền TUẦN TỰ về kho
 * (status 'saved'), tuỳ chọn phân tích luôn. Link trùng (đã có trong kho) bị bỏ qua.
 * Body: { urls: string, sourceId?, analyze?: boolean }
 */
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';
import { enforceRateLimit } from '@/lib/rate-limit';
import { isAllowedSourceUrl } from '@/lib/inspiration/download';
import { enqueueBulkSave } from '@/lib/inspiration/analyze';

const MAX_LINKS = 50;

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { scope: 'inspiration:bulk', limit: 5, windowMs: 60_000 });
  if (limited) return limited;
  try {
    const brandId = getBrandId(req);
    const body = await req.json() as { urls?: string; sourceId?: string; analyze?: boolean };
    const lines = String(body.urls || '')
      .split(/[\n\r]+/).map(s => s.trim()).filter(Boolean);
    if (!lines.length) return NextResponse.json({ error: 'Dán ít nhất 1 link (mỗi dòng 1 link)' }, { status: 400 });
    if (lines.length > MAX_LINKS) return NextResponse.json({ error: `Tối đa ${MAX_LINKS} link mỗi lần` }, { status: 400 });

    const db = getDb();
    const ids: string[] = [];
    let invalid = 0, dup = 0;
    const insert = db.prepare(`INSERT INTO inspiration_items (id, brand_id, source_id, url, media_type, status)
      VALUES (?,?,?,?, 'video', 'new')`);
    const exists = db.prepare('SELECT 1 FROM inspiration_items WHERE brand_id=? AND url=?');
    const seen = new Set<string>();

    for (const url of lines) {
      if (!isAllowedSourceUrl(url)) { invalid++; continue; }
      if (seen.has(url) || exists.get(brandId, url)) { dup++; continue; }
      seen.add(url);
      const id = uuid();
      insert.run(id, brandId, body.sourceId || null, url);
      ids.push(id);
    }

    // Tải nền tuần tự (1 link/lượt) — trả response ngay, UI poll trạng thái.
    if (ids.length) enqueueBulkSave(ids, brandId, Boolean(body.analyze));

    return NextResponse.json({
      ok: true, queued: ids.length, skippedInvalid: invalid, skippedDuplicate: dup,
      message: `Đã nhận ${ids.length} link — đang tải & lưu lần lượt${body.analyze ? ' + phân tích' : ''}.`
        + (dup ? ` Bỏ qua ${dup} link trùng.` : '') + (invalid ? ` Bỏ qua ${invalid} link không hợp lệ.` : ''),
    });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
/**
 * Quản lý template registry (Reel Factory):
 * GET    → danh sách template ĐẦY ĐỦ (builtin + custom) kèm blocks để xem chi tiết
 * DELETE ?id=<id> → xoá template CUSTOM (builtin trong repo không xoá được)
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getBrandId } from '@/lib/brand-guard';
import { getReelTemplate, listReelTemplates, brandLibRoot } from '@/lib/video/brand-library';

export async function GET(req: NextRequest) {
  const brandId = getBrandId(req);
  const list = listReelTemplates(brandId);
  const full = list.map(t => ({ ...t, def: getReelTemplate(brandId, t.id) }));
  return NextResponse.json({ templates: full });
}

export async function DELETE(req: NextRequest) {
  const brandId = getBrandId(req);
  const id = String(req.nextUrl.searchParams.get('id') || '').replace(/[^a-z0-9_]/g, '');
  if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 });
  const list = listReelTemplates(brandId);
  const target = list.find(t => t.id === id);
  if (!target) return NextResponse.json({ error: 'Template không tồn tại' }, { status: 404 });
  if (target.source !== 'custom') return NextResponse.json({ error: 'Template builtin không xoá được' }, { status: 400 });
  const f = path.join(brandLibRoot(brandId), 'TEMPLATES', `reel_${id}.json`);
  try { fs.unlinkSync(f); } catch { /* đã mất */ }
  return NextResponse.json({ ok: true });
}

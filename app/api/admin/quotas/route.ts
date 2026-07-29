export const dynamic = 'force-dynamic';
/**
 * HẠN MỨC THEO KHÁCH — chỉ super-admin.
 *
 *   GET  /api/admin/quotas          → hạn mức + mức dùng + giá vốn tháng của MỌI brand
 *   PUT  /api/admin/quotas          → đặt hạn mức cho 1 brand
 *
 * ⚠️ Trả về cap_usd và spentUsd — GIÁ VỐN NỘI BỘ. Route này không bao giờ được
 * mở cho tenant; khách xem mức dùng ở /api/usage (chỉ số lượng).
 */
import { NextRequest, NextResponse } from 'next/server';
import { isAllBrands } from '@/lib/brand-guard';
import { getDb } from '@/lib/db';
import { getQuota, getUsage, setQuota, currentPeriod, DEFAULT_QUOTA, BrandQuota } from '@/lib/quota';
import { brandSpend } from '@/lib/cost-ledger';

export async function GET(req: NextRequest) {
  if (!isAllBrands(req)) return NextResponse.json({ error: 'Không có quyền — số liệu nội bộ' }, { status: 403 });
  const brands = getDb().prepare('SELECT id, name FROM brands ORDER BY name').all() as Array<{ id: string; name: string }>;
  return NextResponse.json({
    period: currentPeriod(),
    defaults: DEFAULT_QUOTA,
    brands: brands.map(b => {
      const q = getQuota(b.id);
      const u = getUsage(b.id);
      return {
        brandId: b.id, name: b.name, ...q,
        used: u,
        spentUsd: brandSpend(b.id, 31),
        capHit: q.capUsd > 0 && brandSpend(b.id, 31) >= q.capUsd,
      };
    }),
  });
}

export async function PUT(req: NextRequest) {
  if (!isAllBrands(req)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const body = await req.json().catch(() => ({})) as { brandId?: string } & Partial<BrandQuota>;
  const brandId = String(body.brandId || '').trim();
  if (!brandId) return NextResponse.json({ error: 'Thiếu brandId' }, { status: 400 });
  const exists = getDb().prepare('SELECT 1 FROM brands WHERE id=?').get(brandId);
  if (!exists) return NextResponse.json({ error: 'Brand không tồn tại' }, { status: 404 });

  // -1 = không giới hạn; ngoài ra ép về số nguyên không âm để không đặt nhầm giá trị lạ.
  const num = (v: unknown, cur: number) => {
    if (v === undefined || v === null || v === '') return cur;
    const n = Number(v);
    if (!Number.isFinite(n)) return cur;
    return n < 0 ? -1 : Math.floor(n);
  };
  const cur = getQuota(brandId);
  setQuota(brandId, {
    plan: body.plan ? String(body.plan).slice(0, 30) : cur.plan,
    videos: num(body.videos, cur.videos),
    images: num(body.images, cur.images),
    content: num(body.content, cur.content),
    capUsd: body.capUsd === undefined ? cur.capUsd : Math.max(0, Number(body.capUsd) || 0),
    note: body.note === undefined ? cur.note : String(body.note).slice(0, 200),
  });
  return NextResponse.json({ ok: true, brandId, quota: getQuota(brandId) });
}

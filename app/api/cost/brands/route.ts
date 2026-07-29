export const dynamic = 'force-dynamic';
/**
 * GET /api/cost/brands?days=30 — chi phí AI theo TỪNG KHÁCH.
 * Chỉ super-admin (số liệu tài chính toàn hệ). Tenant xem phần của mình qua
 * ?self=1 (chỉ trả brand đang xem).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getBrandId, isAllBrands } from '@/lib/brand-guard';
import { costByBrand, brandSpend } from '@/lib/cost-ledger';

export async function GET(req: NextRequest) {
  const days = Math.min(365, Math.max(1, Number(req.nextUrl.searchParams.get('days')) || 30));
  const self = req.nextUrl.searchParams.get('self') === '1';

  if (self || !isAllBrands(req)) {
    const brandId = getBrandId(req);
    if (!brandId) return NextResponse.json({ error: 'Thiếu brand' }, { status: 400 });
    const mine = costByBrand(days).find(b => b.brandId === brandId);
    return NextResponse.json({ days, brands: mine ? [mine] : [{ brandId, total: brandSpend(brandId, days), calls: 0, byFeature: {}, byProvider: {} }] });
  }
  const brands = costByBrand(days);
  return NextResponse.json({
    days, brands,
    totalUsd: Math.round(brands.reduce((s, b) => s + b.total, 0) * 10000) / 10000,
  });
}

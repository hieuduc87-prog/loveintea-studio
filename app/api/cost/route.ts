export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { buildCostReport, setUnitCosts, UnitCosts } from '@/lib/cost';
import { getBrandId, isAllBrands } from '@/lib/brand-guard';
import { requireAdminSession } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  // SEC (vbsec H1): report chứa ĐƠN GIÁ VỐN (COGS) + P&L — chỉ nội bộ, KHÔNG cho khách
  // (editor) thấy. Live-test cho thấy editor đọc được → gate admin-only.
  const auth = await requireAdminSession();
  if ('error' in auth) return auth.error;
  const brandId = getBrandId(req);
  return NextResponse.json(buildCostReport(brandId, isAllBrands(req)));
}

export async function PUT(req: NextRequest) {
  // SEC (vbsec H1): PUT sửa đơn giá vốn toàn hệ — bắt buộc admin.
  const auth = await requireAdminSession();
  if ('error' in auth) return auth.error;
  const body = await req.json() as Partial<UnitCosts>;
  const unit = setUnitCosts(body);
  const brandId = getBrandId(req);
  return NextResponse.json({ ok: true, unit, report: buildCostReport(brandId, isAllBrands(req)) });
}

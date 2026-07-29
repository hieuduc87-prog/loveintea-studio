export const dynamic = 'force-dynamic';
/**
 * GET /api/cost/brands?days=30 — GIÁ VỐN AI theo từng khách.
 *
 * ⚠️ CHỈ SUPER-ADMIN. Đây là giá vốn nội bộ — khách hàng KHÔNG được thấy, vì
 * lộ giá vốn là mất khả năng định giá bán (founder chốt 29/07). Khách chỉ được
 * xem MỨC TIÊU DÙNG (số video/ảnh đã tạo), không phải tiền.
 */
import { NextRequest, NextResponse } from 'next/server';
import { isAllBrands } from '@/lib/brand-guard';
import { costByBrand } from '@/lib/cost-ledger';

export async function GET(req: NextRequest) {
  const days = Math.min(365, Math.max(1, Number(req.nextUrl.searchParams.get('days')) || 30));
  if (!isAllBrands(req)) {
    return NextResponse.json({ error: 'Không có quyền — số liệu nội bộ' }, { status: 403 });
  }
  const brands = costByBrand(days);
  return NextResponse.json({
    days, brands,
    totalUsd: Math.round(brands.reduce((s, b) => s + b.total, 0) * 10000) / 10000,
  });
}

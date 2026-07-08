export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { buildCostReport, setUnitCosts, UnitCosts } from '@/lib/cost';
import { getBrandId } from '@/lib/brand-guard';

export async function GET(req: NextRequest) {
  const brandId = getBrandId(req);
  return NextResponse.json(buildCostReport(brandId));
}

export async function PUT(req: NextRequest) {
  const body = await req.json() as Partial<UnitCosts>;
  const unit = setUnitCosts(body);
  const brandId = getBrandId(req);
  return NextResponse.json({ ok: true, unit, report: buildCostReport(brandId) });
}

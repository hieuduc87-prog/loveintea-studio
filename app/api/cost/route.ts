export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { buildCostReport, setUnitCosts, UnitCosts } from '@/lib/cost';

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get('brand') || 'loveintea';
  return NextResponse.json(buildCostReport(brandId));
}

export async function PUT(req: NextRequest) {
  const body = await req.json() as Partial<UnitCosts>;
  const unit = setUnitCosts(body);
  const brandId = req.nextUrl.searchParams.get('brand') || 'loveintea';
  return NextResponse.json({ ok: true, unit, report: buildCostReport(brandId) });
}

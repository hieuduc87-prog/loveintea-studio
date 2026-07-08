export const dynamic = 'force-dynamic';
/** GET /api/templates/performance?brand=x — per-template win-rate from linked posts. */
import { NextRequest, NextResponse } from 'next/server';
import { getTemplatePerformance } from '@/lib/template-picker';
import { getBrandId } from '@/lib/brand-guard';

export async function GET(req: NextRequest) {
  const brandId = getBrandId(req);
  return NextResponse.json({ templates: getTemplatePerformance(brandId) });
}

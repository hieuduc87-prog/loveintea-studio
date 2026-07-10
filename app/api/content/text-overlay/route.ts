export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { getBrandId } from '@/lib/brand-guard';
import { OverlayLayout, OverlayFields } from '@/lib/text-overlay';
import { renderOverlayToUrl } from '@/lib/text-overlay-render';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      baseImageUrl?: string; layout?: OverlayLayout;
      headline?: string; sub?: string; cta?: string; badge?: string;
      brandName?: string;
    };
    if (!body.baseImageUrl) return NextResponse.json({ error: 'Thiếu ảnh nền' }, { status: 400 });

    const brandId = getBrandId(req) || 'loveintea';
    const fields: OverlayFields = { headline: body.headline, sub: body.sub, cta: body.cta, badge: body.badge };
    const url = await renderOverlayToUrl({
      baseImageUrl: body.baseImageUrl, layout: body.layout || 'bottom-headline',
      fields, brandId, brandName: body.brandName,
    });
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Render lỗi' }, { status: 500 });
  }
}

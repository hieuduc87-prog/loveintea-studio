export const dynamic = 'force-dynamic';
export const maxDuration = 120;
/**
 * POST /api/image/generate { prompt, productId? } → generate one image, save, return url.
 * If productId has a packshot, uses edit mode to keep packaging; else text-to-image.
 */
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getDb } from '@/lib/db';
import { editProductImage, generateImage, saveImageToFile } from '@/lib/openai-image';
import { resolveProductImagePath } from '@/lib/plan-generate';

export async function POST(req: NextRequest) {
  try {
    const { prompt, productId, brandId } = await req.json() as { prompt?: string; productId?: string; brandId?: string };
    if (!prompt?.trim()) return NextResponse.json({ error: 'prompt required' }, { status: 400 });

    let productPath: string | null = null;
    if (productId) {
      const p = getDb().prepare('SELECT image_url FROM products WHERE id=? OR (brand_id=? AND slug=?)')
        .get(productId, brandId || 'loveintea', productId) as { image_url: string } | undefined;
      productPath = resolveProductImagePath(p?.image_url);
    }

    const raw = productPath
      ? await editProductImage({ productImagePath: productPath, prompt, size: '1024x1536' })
      : await generateImage({ prompt, size: '1024x1536' });
    const url = raw.startsWith('data:') ? await saveImageToFile(raw, `${uuid()}.png`) : raw;
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { editProductImage, generateImage, saveImageToFile } from '@/lib/openai-image';
import { enforceRateLimit } from '@/lib/rate-limit';
import { reserveQuota } from '@/lib/quota';
import { buildImageEditPrompt } from '@/lib/o3-engine';
import { SKUS } from '@/lib/brand-dna';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';
import { pickProductRefUrl } from '@/lib/product-ref';
import { resolveProductImagePath } from '@/lib/plan-generate';

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { scope: 'ai:image', limit: 20, windowMs: 60_000 });
  if (limited) return limited;
  const db = getDb();
  const brandId = getBrandId(req);
  const { skuId, uspId, contextId, customPrompt, useEdit = true } = await req.json();

  // Đa-brand (L4): sản phẩm nằm trong bảng products theo brand — SKUS tĩnh chỉ là
  // legacy loveintea. Có 1 trong 2 là hợp lệ.
  const dbProduct = brandId
    ? db.prepare('SELECT id, slug, image_url FROM products WHERE brand_id=? AND (id=? OR slug=?)')
        .get(brandId, skuId ?? '', skuId ?? '') as { id: string; slug: string; image_url?: string } | undefined
    : undefined;
  const sku = SKUS.find(s => s.id === skuId);
  if (!sku && !dbProduct) return NextResponse.json({ error: 'Invalid SKU' }, { status: 400 });

  const overQuota = reserveQuota(brandId, 'image', 1);
  if (overQuota) return NextResponse.json({ error: overQuota.error }, { status: 429 });

  const jobId  = uuid();
  let prompt: string;
  try {
    prompt = buildImageEditPrompt({ skuId, uspId, contextId, extraNotes: customPrompt, brandId });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 400 });
  }
  const start  = Date.now();

  // Insert job as pending
  db.prepare(`
    INSERT INTO image_jobs (id, brand_id, sku_id, usp_id, context_id, prompt, use_edit, status, model)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'running', 'gpt-image-2')
  `).run(jobId, brandId, skuId, uspId ?? '', contextId ?? '', prompt, useEdit ? 1 : 0);

  try {
    let imageUrl: string;

    // ALWAYS prefer edit mode — keeps product packaging intact.
    // Ảnh gốc: packshot DB của brand trước (product_images/products.image_url),
    // fallback ảnh tĩnh public/brand/products chỉ cho SKU legacy.
    const refUrl = dbProduct ? (pickProductRefUrl(dbProduct.id, 'product') || dbProduct.image_url) : null;
    const productImagePath = (refUrl ? resolveProductImagePath(refUrl) : null)
      || (sku ? path.join(process.cwd(), 'public', 'brand', 'products', path.basename(sku.image)) : null);
    if (useEdit && productImagePath) {
      imageUrl = await editProductImage({ productImagePath, prompt, size: '1024x1536', brandId });
    } else {
      imageUrl = await generateImage({ prompt, size: '1024x1536', brandId });
    }

    // Save to file if base64
    let savedUrl = imageUrl;
    if (imageUrl.startsWith('data:')) {
      const filename = `${jobId}.png`;
      savedUrl = await saveImageToFile(imageUrl, filename);
    }

    const durationMs = Date.now() - start;

    // Update job
    db.prepare(`
      UPDATE image_jobs
      SET status='done', result_url=?, duration_ms=?, completed_at=datetime('now')
      WHERE id=?
    `).run(savedUrl, durationMs, jobId);

    // Save to image library
    const libId = uuid();
    db.prepare(`
      INSERT INTO image_library (id, job_id, sku_id, usp_id, context_id, prompt, image_url, brand_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(libId, jobId, skuId, uspId ?? '', contextId ?? '', prompt, savedUrl, brandId);

    return NextResponse.json({ jobId, imageUrl: savedUrl, prompt, skuId, libId, durationMs });
  } catch (e) {
    const msg = String(e);
    db.prepare(`UPDATE image_jobs SET status='failed', error=?, completed_at=datetime('now') WHERE id=?`)
      .run(msg, jobId);
    // Don't leak raw SDK internals to the client — only surface the actionable
    // billing case; everything else is a generic message.
    let userError = 'Có lỗi hệ thống';
    if (msg.includes('Billing hard limit') || msg.includes('billing') || msg.includes('quota')) {
      userError = 'OpenAI billing limit reached — please top up credit at platform.openai.com → Settings → Billing';
    }
    return NextResponse.json({ error: userError }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { editProductImage, generateImage, saveImageToFile } from '@/lib/openai-image';
import { buildImageEditPrompt } from '@/lib/o3-engine';
import { SKUS } from '@/lib/brand-dna';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  const db = getDb();
  const { skuId, uspId, contextId, customPrompt, useEdit = true } = await req.json();

  const sku = SKUS.find(s => s.id === skuId);
  if (!sku) return NextResponse.json({ error: 'Invalid SKU' }, { status: 400 });

  const jobId  = uuid();
  let prompt: string;
  try {
    prompt = buildImageEditPrompt({ skuId, uspId, contextId, extraNotes: customPrompt });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 400 });
  }
  const start  = Date.now();

  // Insert job as pending
  db.prepare(`
    INSERT INTO image_jobs (id, sku_id, usp_id, context_id, prompt, use_edit, status, model)
    VALUES (?, ?, ?, ?, ?, ?, 'running', 'gpt-image-2')
  `).run(jobId, skuId, uspId ?? '', contextId ?? '', prompt, useEdit ? 1 : 0);

  try {
    let imageUrl: string;

    // ALWAYS prefer edit mode — keeps product packaging intact
    if (useEdit) {
      const productImagePath = path.join(
        process.cwd(), 'public', 'brand', 'products',
        path.basename(sku.image)
      );
      imageUrl = await editProductImage({ productImagePath, prompt, size: '1024x1536' });
    } else {
      imageUrl = await generateImage({ prompt, size: '1024x1536' });
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
      INSERT INTO image_library (id, job_id, sku_id, usp_id, context_id, prompt, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(libId, jobId, skuId, uspId ?? '', contextId ?? '', prompt, savedUrl);

    return NextResponse.json({ jobId, imageUrl: savedUrl, prompt, skuId, libId, durationMs });
  } catch (e) {
    const msg = String(e);
    db.prepare(`UPDATE image_jobs SET status='failed', error=?, completed_at=datetime('now') WHERE id=?`)
      .run(msg, jobId);
    let userError = msg;
    if (msg.includes('Billing hard limit') || msg.includes('billing') || msg.includes('quota')) {
      userError = 'OpenAI billing limit reached — please top up credit at platform.openai.com → Settings → Billing';
    }
    return NextResponse.json({ error: userError }, { status: 500 });
  }
}

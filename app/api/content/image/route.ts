export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { editProductImage, generateImage } from '@/lib/openai-image';
import { buildImageEditPrompt } from '@/lib/o3-engine';
import { SKUS } from '@/lib/brand-dna';

export async function POST(req: NextRequest) {
  try {
    const { skuId, uspId, contextId, customPrompt, useEdit } = await req.json();

    const sku = SKUS.find(s => s.id === skuId);
    if (!sku) return NextResponse.json({ error: 'Invalid SKU' }, { status: 400 });

    const prompt = buildImageEditPrompt({ skuId, uspId, contextId, extraNotes: customPrompt });
    const jobId  = uuid();

    let imageUrl: string;

    if (useEdit) {
      // Use product image as reference — GPT edits into lifestyle scene
      const productImagePath = path.join(process.cwd(), 'public', 'brand', 'products', path.basename(sku.image));
      imageUrl = await editProductImage({ productImagePath, prompt, size: '1024x1536' });
    } else {
      imageUrl = await generateImage({ prompt, size: '1024x1536' });
    }

    return NextResponse.json({ jobId, imageUrl, prompt, skuId });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

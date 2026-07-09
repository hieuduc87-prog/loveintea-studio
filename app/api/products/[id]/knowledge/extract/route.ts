export const dynamic = 'force-dynamic';
export const maxDuration = 120;
/**
 * POST /api/products/[id]/knowledge/extract
 *  - multipart file (xlsx/csv/txt/md/json) OR JSON {text}  → AI fills template fields
 *  - JSON {action:'summarize', knowledge} → consolidate/polish current fields
 * Returns filled fields (NOT saved — the UI reviews then PUTs).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { fileToText, extractKnowledge, summarizeKnowledge } from '@/lib/product-knowledge';
import { assertResourceBrand } from '@/lib/brand-guard';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb();
    const product = db.prepare('SELECT name, brand_id FROM products WHERE id=?').get(params.id) as { name: string; brand_id: string } | undefined;
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    const denied = assertResourceBrand(req, product.brand_id);
    if (denied) return denied;

    const ct = req.headers.get('content-type') || '';

    if (ct.includes('multipart/form-data')) {
      const fd = await req.formData();
      const file = fd.get('file') as File | null;
      if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });
      const text = fileToText(Buffer.from(await file.arrayBuffer()), file.name);
      if (!text.trim()) return NextResponse.json({ error: 'Không đọc được nội dung file' }, { status: 400 });
      const knowledge = await extractKnowledge(product.name, product.brand_id, text);
      return NextResponse.json({ ok: true, knowledge });
    }

    const body = await req.json() as { text?: string; action?: string; knowledge?: Record<string, string> };
    if (body.action === 'summarize') {
      const knowledge = await summarizeKnowledge(product.name, product.brand_id, body.knowledge ?? {});
      return NextResponse.json({ ok: true, knowledge });
    }
    if (body.text?.trim()) {
      const knowledge = await extractKnowledge(product.name, product.brand_id, body.text);
      return NextResponse.json({ ok: true, knowledge });
    }
    return NextResponse.json({ error: 'file, text, or action required' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

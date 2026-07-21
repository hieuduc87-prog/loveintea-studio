export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateCaption } from '@/lib/gemini';
import { BRAND, SKUS } from '@/lib/brand-dna';
import { sanitizeBlogHtml } from '@/lib/sanitize-html';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getBrandId } from '@/lib/brand-guard';
import { v4 as uuid } from 'uuid';

export async function GET(req: NextRequest) {
  const db = getDb();
  // TENANT ISOLATION: blog scope theo brand (trước dùng chung mọi brand).
  const posts = db.prepare('SELECT id, sku_id, topic, title, status, created_at FROM blog_posts WHERE brand_id=? ORDER BY created_at DESC')
    .all(getBrandId(req) || 'loveintea');
  return NextResponse.json({ posts });
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { scope: 'ai:blog', limit: 10, windowMs: 60_000 });
  if (limited) return limited;
  try {
    const { topic, skuId } = await req.json();
    const sku = skuId ? SKUS.find(s => s.id === skuId) : null;

    const prompt = `You are an SEO content writer for LoveinTea, a premium Vietnamese herbal tea brand selling in the US.

Write a complete, SEO-optimized blog post in ENGLISH about: "${topic}"
${sku ? `Focus on the product: ${sku.productName} (${sku.ingredients.join(', ')})` : `Mention relevant LoveinTea products where natural.`}

BRAND VOICE:
- Warmly Wise: knowledgeable grandmother authority, never clinical
- Cheerfully Simple: joyful, accessible, wellness is a treat
- Proudly Vietnamese: celebrate heritage naturally
- NEVER: "cures", "treats", "heals", "prevents disease" — use "traditionally used to support", "a soothing ritual for"

FORMAT: 1500+ words, include:
- SEO title (include target keyword)
- Meta description (155 chars)
- H2 sections with H3 subsections
- FAQ section with 3+ questions
- Natural mentions of LoveinTea products
- Internal CTAs

Return as JSON:
{
  "title": "...",
  "slug": "...",
  "excerpt": "...",
  "content": "...full HTML blog content..."
}`;

    const raw    = await generateCaption(prompt);
    const match  = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : raw) as { title: string; slug: string; excerpt: string; content: string };

    const db = getDb();
    const id = uuid();
    db.prepare(
      'INSERT INTO blog_posts (id, sku_id, topic, title, slug, excerpt, content, status, brand_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, skuId ?? null, topic, parsed.title, parsed.slug, parsed.excerpt, sanitizeBlogHtml(parsed.content), 'draft', getBrandId(req) || 'loveintea');

    return NextResponse.json({ id, title: parsed.title, ok: true });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

// Suppress unused import warning
void BRAND;

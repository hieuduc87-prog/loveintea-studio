export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateJSON } from '@/lib/gemini';

interface MatchRequest {
  brandId?: string;
  skuId?: string;          // product being promoted
  purpose?: string;        // "flash sale", "new launch", "educational"
  format?: string;         // "post", "story", "carousel"
  mood?: string;           // "warm", "vibrant", "minimal"
  keywords?: string[];     // style keywords to match
  limit?: number;
}

interface TemplateRow {
  id: string; name: string; category: string; purpose: string;
  format: string; tags: string; analysis: string; usage_count: number;
  image_url: string; aspect_ratio: string; color_palette: string;
}

// POST /api/content-templates/match — AI-powered template selection
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as MatchRequest;
    const brandId = body.brandId || 'loveintea';
    const limit = body.limit || 3;

    const db = getDb();

    // Get all active templates with analysis
    let sql = 'SELECT * FROM content_templates WHERE brand_id = ? AND is_active = 1';
    const params: (string | number)[] = [brandId];

    // Pre-filter by format if specified
    if (body.format) { sql += ' AND format = ?'; params.push(body.format); }

    sql += ' ORDER BY usage_count DESC, created_at DESC LIMIT 50';
    const candidates = db.prepare(sql).all(...params) as TemplateRow[];

    if (candidates.length === 0) {
      return NextResponse.json({ templates: [], message: 'No templates available' });
    }

    // If only a few templates and no complex matching needed, return all
    if (candidates.length <= limit) {
      const result = candidates.map(t => ({
        ...t,
        analysis: t.analysis ? JSON.parse(t.analysis) : null,
        tags: safeParse(t.tags),
        match_score: 1,
        match_reason: 'Only available template',
      }));
      return NextResponse.json({ templates: result });
    }

    // Build context for Gemini to rank templates
    const candidateSummaries = candidates.map((t, i) => {
      const analysis = t.analysis ? JSON.parse(t.analysis) : null;
      return {
        index: i,
        id: t.id,
        name: t.name,
        category: t.category,
        purpose: t.purpose,
        format: t.format,
        tags: safeParse(t.tags),
        usage_count: t.usage_count,
        layout_type: analysis?.layout?.type ?? 'unknown',
        style_keywords: analysis?.style_keywords ?? [],
        best_for: analysis?.best_for ?? [],
        content_direction: analysis?.content_direction ?? '',
        has_product_zone: analysis?.product_placement?.has_product ?? false,
        mood: analysis?.colors?.mood ?? '',
      };
    });

    const prompt = `You are a content production AI for a Vietnamese beverage brand (LoveinTea — hibiscus, chrysanthemum, artichoke herbal teas).

Given the following content request and available templates, pick the ${limit} BEST templates and explain why.

CONTENT REQUEST:
- Product (SKU): ${body.skuId || 'any'}
- Purpose: ${body.purpose || 'general content'}
- Format: ${body.format || 'any'}
- Desired mood: ${body.mood || 'brand-appropriate'}
- Style keywords: ${(body.keywords ?? []).join(', ') || 'none specified'}

AVAILABLE TEMPLATES (${candidateSummaries.length}):
${JSON.stringify(candidateSummaries, null, 1)}

Return JSON array of exactly ${limit} items, ranked best-first:
[
  {
    "template_index": 0,
    "score": 0.95,
    "reason": "Why this template fits the request",
    "content_suggestion": "Brief direction for how to adapt this template for the specific product/purpose"
  }
]`;

    const rankings = await generateJSON<Array<{
      template_index: number;
      score: number;
      reason: string;
      content_suggestion: string;
    }>>(prompt);

    // Map rankings back to full template data
    const result = rankings
      .filter(r => r.template_index >= 0 && r.template_index < candidates.length)
      .map(r => {
        const t = candidates[r.template_index];
        // Increment usage count
        db.prepare('UPDATE content_templates SET usage_count = usage_count + 1 WHERE id = ?').run(t.id);
        return {
          ...t,
          analysis: t.analysis ? JSON.parse(t.analysis) : null,
          tags: safeParse(t.tags),
          match_score: r.score,
          match_reason: r.reason,
          content_suggestion: r.content_suggestion,
        };
      });

    return NextResponse.json({ templates: result });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

function safeParse(json: string): string[] {
  try { return JSON.parse(json); } catch { return []; }
}

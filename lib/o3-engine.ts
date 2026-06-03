/**
 * O3 One.One.One Content Engine
 * Generates LoveinTea social captions using the brand framework.
 * Every post = One Reason To Buy × One Flow × One CTA
 */

import { generateCaption } from './gemini';
import { BRAND, SKUS, SEGMENTS, RTBS, USP_ANCHORS, NARRATIVES, CONTEXTS } from './brand-dna';

export interface O3Config {
  skuId: string;
  segmentId: string;
  rtbId: string;
  uspId: string;
  narrativeId: string;
  contextId: string;
  cta: string;
  extraNotes?: string;
}

export interface O3Result {
  caption: string;
  imagePrompt: string;
  hashtags: string;
  cellId: string;
}

export async function generateO3Content(config: O3Config): Promise<O3Result> {
  const sku       = SKUS.find(s => s.id === config.skuId);
  const segment   = SEGMENTS.find(s => s.id === config.segmentId);
  const rtb       = RTBS.find(r => r.id === config.rtbId);
  const usp       = USP_ANCHORS.find(u => u.id === config.uspId);
  const narrative = NARRATIVES.find(n => n.id === config.narrativeId);
  const context   = CONTEXTS.find(c => c.id === config.contextId);

  if (!sku || !segment || !rtb || !usp || !narrative || !context) {
    throw new Error('Invalid O3 config — missing required fields');
  }

  const prompt = `You are writing an Instagram caption for LoveinTea, a premium Vietnamese herbal tea brand sold in the US.

BRAND VOICE (NON-NEGOTIABLE — all 3 traits in every post):
1. Warmly Wise — gentle grandmother authority, knowledgeable, never clinical
2. Cheerfully Simple — light, joyful, accessible; wellness is a treat not a chore
3. Proudly Vietnamese — celebrate heritage, NEVER exoticize

COMPLIANCE — NEVER USE: cures, treats, heals, prevents disease, innovative, disrupting, mysterious, exotic Eastern

PRODUCT: ${sku.productName}
- Ingredients: ${sku.ingredients.join(', ')}
- Theme: ${sku.theme}
- Best moment: ${sku.bestMoment}

TARGET PERSON: ${segment.name} (${segment.age}), tension: "${segment.tension}"

ONE REASON TO BUY: "${rtb.label}"

USP ANCHOR (what this post proves):
- Label: ${usp.label}
- Claim-safe phrasing: "${usp.caption}"
- Image must show: ${usp.imageRule}

NARRATIVE STRUCTURE: ${narrative.label} — hook: "${narrative.hook}"

SCENE/CONTEXT: ${context.label} — ${context.light}

CTA: "${config.cta}"

${config.extraNotes ? `EXTRA NOTES: ${config.extraNotes}` : ''}

Write the Instagram caption following this EXACT 4-beat structure:
1. HOOK (1 line) — pattern-interrupt using the narrative hook, mapped to segment tension
2. BRIDGE TO USP (1-2 lines) — connect moment/benefit to product truth using claim-safe phrasing above. THIS IS THE SELLING LINE.
3. HERITAGE VOICE (1 line) — Warmly Wise + Proudly Vietnamese, no health claims
4. CTA (1 line) — the exact CTA above

Then write a brief IMAGE PROMPT (2-3 sentences) describing the photo that proves the same USP. The product (LoveinTea box/tea bag) must be visible. Use: ${context.label}, ${context.light}.

Return as JSON: { "caption": "...", "imagePrompt": "..." }`;

  const result = await generateCaption(`${prompt}\n\nIMPORTANT: Return only valid JSON.`);

  let parsed: { caption: string; imagePrompt: string };
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result);
  } catch {
    parsed = { caption: result, imagePrompt: '' };
  }

  const cellId = `${config.segmentId}-${config.rtbId}-${config.uspId}-${config.narrativeId}-${config.contextId}`;

  return {
    caption:     parsed.caption,
    imagePrompt: parsed.imagePrompt,
    hashtags:    BRAND.hashtags.join(' '),
    cellId,
  };
}

/**
 * Build the GPT-image-2 edit prompt for a product + scene combination.
 * Ensures the product stays intact and brand rules are respected.
 */
export function buildImageEditPrompt(opts: {
  skuId: string;
  contextId: string;
  uspId: string;
  extraNotes?: string;
}): string {
  const sku     = SKUS.find(s => s.id === opts.skuId);
  const context = CONTEXTS.find(c => c.id === opts.contextId);
  const usp     = USP_ANCHORS.find(u => u.id === opts.uspId);

  if (!sku || !context || !usp) throw new Error('Invalid image prompt config');

  return `Editorial lifestyle photo for LoveinTea ${sku.name} herbal tea.

SCENE: ${context.label}. ${context.light}.

THE PRODUCT (keep perfectly intact — DO NOT alter label, logo, or text on box):
The LoveinTea ${sku.name} tea box (${sku.color} color) should appear naturally in the scene — placed on a surface, partially in frame, or held. The triangular pyramid tea bag should be visible steeping in a clear glass vessel. The white square tag with "LoveinTea" wordmark must be legible.

IMAGE MUST PROVE THIS USP: ${usp.label}
Required visual element: ${usp.imageRule}

VISUAL STYLE:
- Color palette: Cotton Cream (#FFF8F0) base, Heritage Green (#1A5632) accents
- Warm temperature grade, low contrast, lifted shadows
- Real tactile materials: linen, ceramic, wood, glass, fresh herbs
- Shallow depth of field, editorial quality
- Natural human element (hands, partial figure) — real skin texture, no AI artifacts
- 2-4 supporting props max (candle, linen, book, dried flowers)
- NO health claim visuals, NO text overlays

${opts.extraNotes ? `ADDITIONAL: ${opts.extraNotes}` : ''}

Output: Premium Instagram 4:5 feed photo that passes the 1-second brand test.`;
}

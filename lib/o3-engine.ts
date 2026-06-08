/**
 * O3 One.One.One Content Engine — Closed-Loop Edition
 * Injects knowledge_docs + content_rules + scoreboard into every AI call.
 * Every post = One Reason To Buy × One Flow × One CTA + lineage for attribution.
 */

import { generateCaption } from './gemini';
import { getDb } from './db';
import { BRAND, SKUS, SEGMENTS, RTBS, USP_ANCHORS, NARRATIVES, CONTEXTS } from './brand-dna';

// ── Per-SKU HARD LOCK (from detail-spec §2.4) ─────────────────────────────
const SKU_BEVERAGE_LOCK: Record<string, { color: string; vessel: string; cue: string }> = {
  dandelion:      { color: 'golden amber',     vessel: 'clear glass mug',  cue: 'whole dandelion root visible through mesh' },
  ginger:         { color: 'warm amber-gold',   vessel: 'ceramic mug',      cue: 'sliced ginger + cinnamon stick beside cup' },
  hibiscus:       { color: 'deep ruby-magenta', vessel: 'clear glass',      cue: 'dried hibiscus petals scattered on surface' },
  'lemon-balm':   { color: 'pale straw-green',  vessel: 'clear glass cup',  cue: 'fresh lemon balm sprig in frame' },
  peppermint:     { color: 'light celadon',     vessel: 'clear glass',      cue: 'fresh peppermint leaves as garnish' },
  'nighty-night': { color: 'soft golden',       vessel: 'ceramic mug',      cue: 'chamomile flowers + dim candlelight' },
};

export interface O3Config {
  skuId: string;
  segmentId: string;
  rtbId: string;
  uspId: string;
  narrativeId: string;
  contextId: string;
  cta: string;
  extraNotes?: string;
  briefId?: string;
  brandId?: string;
}

export interface O3Result {
  caption: string;
  imagePrompt: string;
  hashtags: string;
  cellId: string;
  briefId?: string;
  ruleVersion: string;
}

// ── Knowledge injection ────────────────────────────────────────────────────

function getKnowledgeContext(brandId: string): string {
  try {
    const db = getDb();
    // Get playbook excerpts (compliance, voice, content rules)
    const docs = db.prepare(
      `SELECT type, title, content FROM knowledge_docs
       WHERE brand_id = ? AND type IN ('playbook', 'guideline')
       ORDER BY uploaded_at ASC`
    ).all(brandId) as { type: string; title: string; content: string }[];

    if (!docs.length) return '';

    const sections: string[] = [];
    for (const doc of docs) {
      if (!doc.content) continue;
      // Extract key sections — compliance rules, content recipes, voice guidelines
      const content = doc.content;

      // From playbook: extract compliance and content structure sections
      if (doc.type === 'playbook') {
        // Extract Compliance section
        const compMatch = content.match(/##[^#]*[Cc]ompliance[^\n]*\n([\s\S]*?)(?=\n##[^#]|\n---|\Z)/);
        if (compMatch) sections.push(`[COMPLIANCE FROM PLAYBOOK]\n${compMatch[1].slice(0, 800)}`);

        // Extract Content Recipe / structure sections
        const recipeMatch = content.match(/##[^#]*[Rr]ecipe[^\n]*\n([\s\S]*?)(?=\n##[^#]|\n---|\Z)/);
        if (recipeMatch) sections.push(`[CONTENT RECIPE]\n${recipeMatch[1].slice(0, 600)}`);

        // Extract Fixed Core / Identity rules
        const fixedMatch = content.match(/##[^#]*[Ff]ixed\s*[Cc]ore[^\n]*\n([\s\S]*?)(?=\n##[^#]|\n---|\Z)/);
        if (fixedMatch) sections.push(`[BRAND IDENTITY RULES]\n${fixedMatch[1].slice(0, 600)}`);
      }

      // From guidelines: extract master-prompt and claim-safe rules
      if (doc.type === 'guideline' && doc.title.includes('Detail Spec')) {
        const claimMatch = content.match(/claim[\s-]*safe[^\n]*\n([\s\S]*?)(?=\n##[^#]|\n---|\Z)/i);
        if (claimMatch) sections.push(`[CLAIM-SAFE RULES]\n${claimMatch[1].slice(0, 500)}`);

        const masterMatch = content.match(/master[\s-]*prompt[^\n]*\n([\s\S]*?)(?=\n##[^#]|\n---|\Z)/i);
        if (masterMatch) sections.push(`[MASTER PROMPT TEMPLATE]\n${masterMatch[1].slice(0, 500)}`);
      }
    }

    return sections.length ? `\n\n═══ BRAND KNOWLEDGE (from strategy docs) ═══\n${sections.join('\n\n')}\n═══ END KNOWLEDGE ═══` : '';
  } catch {
    return ''; // DB not available — graceful fallback
  }
}

function getActiveRules(brandId: string): { version: string; rules: string[] } {
  try {
    const db = getDb();
    const rows = db.prepare(
      `SELECT version, rule_text FROM content_rules
       WHERE brand_id = ? AND status = 'active'
       ORDER BY created_at ASC LIMIT 30`
    ).all(brandId) as { version: string; rule_text: string }[];

    if (!rows.length) return { version: 'v1.0', rules: [] };

    const latestVersion = rows[rows.length - 1].version;
    return { version: latestVersion, rules: rows.map(r => r.rule_text) };
  } catch {
    return { version: 'v1.0', rules: [] };
  }
}

function getScoreboardContext(brandId: string): string {
  try {
    const db = getDb();
    const rows = db.prepare(
      `SELECT angle, channel, verdict, sample_size FROM scoreboard
       WHERE brand_id = ? AND verdict != 'HOLD'
       ORDER BY verdict ASC, sample_size DESC LIMIT 20`
    ).all(brandId) as { angle: string; channel: string; verdict: string; sample_size: number }[];

    if (!rows.length) return '';

    const scale = rows.filter(r => r.verdict === 'SCALE').map(r => `${r.angle} (${r.channel})`);
    const retire = rows.filter(r => r.verdict === 'RETIRE').map(r => `${r.angle} (${r.channel})`);

    const parts: string[] = [];
    if (scale.length) parts.push(`SCALE (proven winners): ${scale.join(', ')}`);
    if (retire.length) parts.push(`RETIRE (stop using): ${retire.join(', ')}`);
    return parts.length ? `\nSCOREBOARD VERDICTS:\n${parts.join('\n')}` : '';
  } catch {
    return '';
  }
}

// ── Main content generation ────────────────────────────────────────────────

export async function generateO3Content(config: O3Config): Promise<O3Result> {
  const sku_      = SKUS.find(s => s.id === config.skuId);
  const segment_  = SEGMENTS.find(s => s.id === config.segmentId);
  const rtb_      = RTBS.find(r => r.id === config.rtbId);
  const usp_      = USP_ANCHORS.find(u => u.id === config.uspId);
  const narrative_= NARRATIVES.find(n => n.id === config.narrativeId);
  const context_  = CONTEXTS.find(c => c.id === config.contextId);

  const missing: string[] = [];
  if (!sku_)       missing.push('SKU');
  if (!segment_)   missing.push('Segment');
  if (!rtb_)       missing.push('Reason to Buy (RTB)');
  if (!usp_)       missing.push('USP Anchor');
  if (!narrative_) missing.push('Narrative');
  if (!context_)   missing.push('Scene / Context');
  if (missing.length) {
    throw new Error(`Thiếu: ${missing.join(', ')}. Vui lòng chọn đầy đủ trước khi generate.`);
  }

  const sku = sku_!;
  const segment = segment_!;
  const rtb = rtb_!;
  const usp = usp_!;
  const narrative = narrative_!;
  const context = context_!;

  const brandId = config.brandId || 'loveintea';
  const knowledgeBlock = getKnowledgeContext(brandId);
  const { version: ruleVersion, rules } = getActiveRules(brandId);
  const scoreboardBlock = getScoreboardContext(brandId);
  const bevLock = SKU_BEVERAGE_LOCK[config.skuId];

  const rulesBlock = rules.length
    ? `\nACTIVE RULES (rule_version: ${ruleVersion}):\n${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
    : '';

  const bevBlock = bevLock
    ? `\nBEVERAGE HARD LOCK for ${sku.name}:
- Brew color: ${bevLock.color}
- Vessel: ${bevLock.vessel}
- Visual cue: ${bevLock.cue}
(These are NON-NEGOTIABLE in both copy description and image prompt)`
    : '';

  const prompt = `You are writing an Instagram caption for LoveinTea, a premium Vietnamese herbal tea brand sold in the US.

BRAND VOICE (NON-NEGOTIABLE — all 3 traits in every post):
1. Warmly Wise — gentle grandmother authority, knowledgeable, never clinical
2. Cheerfully Simple — light, joyful, accessible; wellness is a treat not a chore
3. Proudly Vietnamese — celebrate heritage, NEVER exoticize

COMPLIANCE — NEVER USE: cures, treats, heals, prevents disease, innovative, disrupting, mysterious, exotic Eastern, detox, liver, heart, optimize, protocol
CLAIM-SAFE APPROACH: Describe moments, rituals, feelings. NEVER promise health effects on organs or body systems. Use "traditionally used to support" or "a soothing ritual for" framing.
${knowledgeBlock}
${rulesBlock}
${scoreboardBlock}

PRODUCT: ${sku.productName}
- Ingredients: ${sku.ingredients.join(', ')}
- Theme: ${sku.theme}
- Best moment: ${sku.bestMoment}
${bevBlock}

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

Then write a brief IMAGE PROMPT (2-3 sentences) describing the photo that proves the same USP. The product (LoveinTea box/tea bag) must be visible. ${bevLock ? `MANDATORY: brew in ${bevLock.vessel}, ${bevLock.color} brew color, ${bevLock.cue}.` : ''} Use: ${context.label}, ${context.light}.

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
    briefId:     config.briefId,
    ruleVersion,
  };
}

/**
 * Build the GPT-image-2 edit prompt for a product + scene combination.
 * Now includes per-SKU beverage HARD LOCK.
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

  const bev = SKU_BEVERAGE_LOCK[opts.skuId];
  const bevInstructions = bev
    ? `The brew must be ${bev.color} in a ${bev.vessel}. Include: ${bev.cue}.`
    : '';

  return `Editorial lifestyle photo for LoveinTea ${sku.name} herbal tea.

SCENE: ${context.label}. ${context.light}.

THE PRODUCT (keep perfectly intact — DO NOT alter label, logo, or text on box):
The LoveinTea ${sku.name} tea box (${sku.color} color) should appear naturally in the scene — placed on a surface, partially in frame, or held. The triangular pyramid tea bag should be visible steeping in a clear glass vessel. The white square tag with "LoveinTea" wordmark must be legible.
${bevInstructions}

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
- Tag: 1 white LoveinTea logo tag — NOT red, NOT kraft

${opts.extraNotes ? `ADDITIONAL: ${opts.extraNotes}` : ''}

Output: Premium Instagram 4:5 feed photo that passes the 1-second brand test.`;
}

// ── Review Desk (3 gates) ──────────────────────────────────────────────────

export interface ReviewResult {
  passed: boolean;
  gates: {
    claimSafety: { passed: boolean; issues: string[] };
    aiQuality: { passed: boolean; issues: string[] };
    dedup: { passed: boolean; issues: string[] };
  };
}

const BANNED_CLAIMS = [
  'cures', 'treats', 'heals', 'prevents', 'detox', 'detoxify', 'liver',
  'heart', 'blood pressure', 'anti-inflammatory', 'antioxidant-rich',
  'boosts immune', 'fights cancer', 'reduces cholesterol', 'burns fat',
  'weight loss', 'anti-aging', 'cleanses', 'flushes toxins',
];

export function reviewContent(caption: string, brandId: string): ReviewResult {
  const gates = {
    claimSafety: { passed: true, issues: [] as string[] },
    aiQuality: { passed: true, issues: [] as string[] },
    dedup: { passed: true, issues: [] as string[] },
  };

  // Gate 1: FDA claim safety
  const lowerCaption = caption.toLowerCase();
  for (const claim of BANNED_CLAIMS) {
    if (lowerCaption.includes(claim)) {
      gates.claimSafety.passed = false;
      gates.claimSafety.issues.push(`Contains banned claim: "${claim}"`);
    }
  }

  // Gate 2: AI quality checks
  const aiPatterns = [
    { pattern: /\b(delve|tapestry|embark|elevate|resonate|leverage)\b/i, msg: 'AI-slop word detected' },
    { pattern: /(.{20,})\1/i, msg: 'Repetitive text block' },
    { pattern: /\b(imagine|picture this|close your eyes)\b/i, msg: 'Cliché AI opening' },
  ];
  for (const { pattern, msg } of aiPatterns) {
    if (pattern.test(caption)) {
      gates.aiQuality.passed = false;
      gates.aiQuality.issues.push(msg);
    }
  }

  // Gate 3: Dedup — check against recent posts
  try {
    const db = getDb();
    const recent = db.prepare(
      `SELECT caption FROM posts
       WHERE brand_id = ? AND status IN ('published', 'scheduled')
       AND created_at > datetime('now', '-30 days')
       ORDER BY created_at DESC LIMIT 50`
    ).all(brandId) as { caption: string }[];

    for (const post of recent) {
      if (!post.caption) continue;
      const similarity = computeSimilarity(caption, post.caption);
      if (similarity > 0.7) {
        gates.dedup.passed = false;
        gates.dedup.issues.push(`${Math.round(similarity * 100)}% similar to a recent post`);
        break;
      }
    }
  } catch { /* DB unavailable */ }

  return {
    passed: gates.claimSafety.passed && gates.aiQuality.passed && gates.dedup.passed,
    gates,
  };
}

function computeSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  if (!wordsA.size || !wordsB.size) return 0;
  let overlap = 0;
  for (const w of wordsA) if (wordsB.has(w)) overlap++;
  return overlap / Math.max(wordsA.size, wordsB.size);
}

// ── Brief Builder ──────────────────────────────────────────────────────────

export interface BriefConfig {
  brandId: string;
  planItemId?: string;
  channel: string;
  skuId: string;
  segmentId: string;
  rtbId: string;
  uspId: string;
  contextId: string;
  narrativeId?: string;
}

export interface Brief {
  id: string;
  purpose: string;
  variableCell: string;
  ruleVersion: string;
  channel: string;
  format: string;
  copyDirection: string;
  visualDirection: string;
}

export async function generateBrief(config: BriefConfig): Promise<Brief> {
  const { version: ruleVersion, rules } = getActiveRules(config.brandId);
  const sku = SKUS.find(s => s.id === config.skuId);
  const segment = SEGMENTS.find(s => s.id === config.segmentId);
  const rtb = RTBS.find(r => r.id === config.rtbId);
  const usp = USP_ANCHORS.find(u => u.id === config.uspId);
  const context = CONTEXTS.find(c => c.id === config.contextId);

  const rulesText = rules.length
    ? `\nActive Rules (v${ruleVersion}):\n${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
    : '';

  const prompt = `You are the brief builder for LoveinTea.
Input: 1 content slot.
${rulesText}

Slot:
- Channel: ${config.channel}
- Product: ${sku?.name ?? config.skuId}
- Segment: ${segment?.name ?? config.segmentId} — tension: "${segment?.tension ?? ''}"
- RTB: ${rtb?.label ?? config.rtbId}
- USP: ${usp?.label ?? config.uspId}
- Context: ${context?.label ?? config.contextId}

Generate 1 brief with EXACTLY:
- 1 purpose (the single goal of this tile)
- 1 variable_cell (the variable being tested)
- copy_direction (tone + angle in 1-2 sentences)
- visual_direction (scene + mood in 1-2 sentences)
- format (still_lifestyle | still_product | carousel | reel)

Constraints:
- Copy must be claim-safe (FDA structure/function)
- Use theme/moment language, not health promises
- Tag: 1 white LoveinTea logo tag

Return JSON: { "purpose": "...", "variable_cell": "...", "copy_direction": "...", "visual_direction": "...", "format": "..." }`;

  const result = await generateCaption(`${prompt}\n\nReturn only valid JSON.`);
  let parsed: { purpose: string; variable_cell: string; copy_direction: string; visual_direction: string; format: string };
  try {
    const m = result.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : result);
  } catch {
    parsed = { purpose: 'Content for ' + (sku?.name ?? config.skuId), variable_cell: config.rtbId, copy_direction: '', visual_direction: '', format: 'still_lifestyle' };
  }

  const { v4: uuid } = await import('uuid');
  const id = uuid();

  // Save to DB
  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO briefs (id, brand_id, plan_item_id, rule_version, purpose, variable_cell, channel, format, copy_direction, visual_direction, sku_id, segment_id, rtb_id, usp_id, context_id, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(id, config.brandId, config.planItemId ?? null, ruleVersion, parsed.purpose, parsed.variable_cell, config.channel, parsed.format, parsed.copy_direction, parsed.visual_direction, config.skuId, config.segmentId, config.rtbId, config.uspId, config.contextId, 'active');
  } catch { /* DB save failed, brief still returned */ }

  return {
    id,
    purpose: parsed.purpose,
    variableCell: parsed.variable_cell,
    ruleVersion,
    channel: config.channel,
    format: parsed.format,
    copyDirection: parsed.copy_direction,
    visualDirection: parsed.visual_direction,
  };
}

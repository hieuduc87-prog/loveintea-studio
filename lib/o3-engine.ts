/**
 * O3 One.One.One Content Engine — Closed-Loop Edition
 * Injects knowledge_docs + content_rules + scoreboard into every AI call.
 * Every post = One Reason To Buy × One Flow × One CTA + lineage for attribution.
 */

import { generateCaption } from './gemini';
import { getDb } from './db';
import { SKUS, SEGMENTS, RTBS, USP_ANCHORS, NARRATIVES, CONTEXTS } from './brand-dna';

// ── Brand identity (L4 multi-brand-doctrine: danh tính tenant TRUYỀN VÀO prompt,
//    không viết cứng tên hãng/ngành hàng — 30/07 gỡ 3 cụm "LoveinTea ... herbal tea") ──

interface BrandIdentity {
  name: string;            // '' nếu không xác định được brand — KHÔNG default tenant (L1)
  throughLine: string;
  voiceTraits: string[];
  neverSay: string[];
  alwaysSay: string[];
  hashtags: string[];
  colors: Record<string, string>;
}

const EMPTY_IDENTITY: BrandIdentity = {
  name: '', throughLine: '', voiceTraits: [], neverSay: [], alwaysSay: [], hashtags: [], colors: {},
};

function parseJson<T>(s: string | undefined | null, fallback: T): T {
  try { return s ? (JSON.parse(s) as T) : fallback; } catch { return fallback; }
}

export function getBrandIdentity(brandId: string): BrandIdentity {
  if (!brandId) return EMPTY_IDENTITY;
  try {
    const db = getDb();
    const brand = db.prepare('SELECT name FROM brands WHERE id=?').get(brandId) as { name?: string } | undefined;
    const dna = db.prepare(
      'SELECT tagline, through_line, voice_traits, compliance_json, hashtags, colors_json FROM brand_dna WHERE brand_id=?'
    ).get(brandId) as Record<string, string> | undefined;
    const comp = parseJson<{ neverSay?: string[]; alwaysSay?: string[] }>(dna?.compliance_json, {});
    return {
      name: brand?.name || '',
      throughLine: dna?.through_line || dna?.tagline || '',
      voiceTraits: parseJson<string[]>(dna?.voice_traits, []).filter(Boolean),
      neverSay: (comp.neverSay || []).filter(Boolean),
      alwaysSay: (comp.alwaysSay || []).filter(Boolean),
      hashtags: parseJson<string[]>(dna?.hashtags, []).filter(Boolean),
      colors: parseJson<Record<string, string>>(dna?.colors_json, {}),
    };
  } catch {
    return EMPTY_IDENTITY;
  }
}

interface ProductInfo {
  id: string;              // slug chuẩn (khớp SKU_BEVERAGE_LOCK / SEGMENTS.leadSkus)
  name: string;
  productName: string;
  theme: string;
  color: string;
  ingredients: string[];
  bestMoment: string;
  pitch: string;
  useCases: string[];
}

/** DB trước (đa-brand, lọc theo brand_id); SKUS tĩnh chỉ là fallback legacy
 *  cho ngữ cảnh chưa có brand — KHÔNG dùng SKUS tĩnh khi brand khác có id trùng. */
export function resolveProduct(brandId: string, skuId: string): ProductInfo | null {
  if (!skuId) return null;
  try {
    const db = getDb();
    const row = brandId
      ? db.prepare('SELECT * FROM products WHERE brand_id=? AND (id=? OR slug=?)').get(brandId, skuId, skuId) as Record<string, string> | undefined
      : undefined;
    if (row) {
      return {
        id: row.slug || row.id,
        name: row.name,
        productName: row.display_name || row.name,
        theme: row.theme || '',
        color: row.color || '',
        ingredients: parseJson<string[]>(row.ingredients, []),
        bestMoment: row.best_moment || '',
        pitch: row.pitch || '',
        useCases: parseJson<string[]>(row.use_cases, []),
      };
    }
  } catch { /* DB unavailable */ }
  // L1/L4: fallback SKUS tĩnh CHỈ cho loveintea/ngữ cảnh legacy không brand.
  // Brand khác có id trùng slug trà (vd 'hibiscus') KHÔNG được nhận sản phẩm LIT.
  if (brandId && brandId !== 'loveintea') return null;
  const sku = SKUS.find(s => s.id === skuId);
  if (!sku) return null;
  return {
    id: sku.id, name: sku.name, productName: sku.productName, theme: sku.theme,
    color: sku.color, ingredients: [...sku.ingredients], bestMoment: sku.bestMoment,
    pitch: sku.pitch, useCases: [...sku.useCases],
  };
}

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
    const sections: string[] = [];

    // Brand strategy fields (audience / insight / behavior / brand rules)
    const dna = db.prepare('SELECT target_audience, insight, behavior, brand_rules FROM brand_dna WHERE brand_id=?')
      .get(brandId) as { target_audience?: string; insight?: string; behavior?: string; brand_rules?: string } | undefined;
    if (dna) {
      const strat: string[] = [];
      if (dna.target_audience) strat.push(`Target audience: ${dna.target_audience}`);
      if (dna.insight) strat.push(`Insight: ${dna.insight}`);
      if (dna.behavior) strat.push(`Behavior: ${dna.behavior}`);
      if (dna.brand_rules) strat.push(`BRAND RULES (mandatory): ${dna.brand_rules}`);
      if (strat.length) sections.push(`[BRAND STRATEGY]\n${strat.join('\n')}`);
    }

    // File giọng thương hiệu brand tự upload (Brand DNA → Upload Custom File).
    // ƯU TIÊN CAO NHẤT: đè lên voice mặc định. Trước 29/07 file này không được
    // nạp vào bất kỳ prompt nào (card 2b3d5193).
    const voice = db.prepare('SELECT value FROM settings WHERE key=?')
      .get(`brand_voice:${brandId}`) as { value?: string } | undefined;
    if (voice?.value) sections.push(`[BRAND VOICE FILE — HIGHEST PRIORITY, overrides default voice]\n${voice.value.slice(0, 6000)}`);

    // Get playbook excerpts (compliance, voice, content rules)
    const docs = db.prepare(
      `SELECT type, title, content FROM knowledge_docs
       WHERE brand_id = ? AND type IN ('playbook', 'guideline')
       ORDER BY uploaded_at ASC`
    ).all(brandId) as { type: string; title: string; content: string }[];

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

    const docBlock = sections.length ? `\n\n═══ BRAND KNOWLEDGE (from strategy docs) ═══\n${sections.join('\n\n')}\n═══ END KNOWLEDGE ═══` : '';
    // Human-injected expert knowledge (fast learning loop)
    let expertBlock = '';
    try { const { getExpertKnowledgeBlock } = require('./brand-knowledge'); expertBlock = getExpertKnowledgeBlock(brandId); } catch { /* */ }
    return docBlock + expertBlock;
  } catch {
    return ''; // DB not available — graceful fallback
  }
}

function getActiveRules(brandId: string): { version: string; rules: string[] } {
  try {
    const db = getDb();
    const rows = db.prepare(
      `SELECT version, rule_text FROM content_rules
       WHERE (brand_id = ? OR scope = 'platform') AND status = 'active'
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
  const brandId = config.brandId || '';
  const sku_ = resolveProduct(brandId, config.skuId);
  // Only SKU is required. Any variable not selected is AUTO-PICKED (relevant to the
  // SKU when possible, else the first option) so 2-3 selections are enough to run.
  if (!sku_) throw new Error('Vui lòng chọn sản phẩm (SKU) trước khi generate.');
  const sku = sku_;

  const skuKey = (sku.id || '').replace(/^prod-/, '');
  const segment  = SEGMENTS.find(s => s.id === config.segmentId)
    || SEGMENTS.find(s => (s as unknown as { leadSkus?: string[] }).leadSkus?.some(k => k === skuKey || k === sku.id)) || SEGMENTS[0];
  const rtb       = RTBS.find(r => r.id === config.rtbId) || RTBS[0];
  const usp       = USP_ANCHORS.find(u => u.id === config.uspId) || USP_ANCHORS[0];
  const narrative = NARRATIVES.find(n => n.id === config.narrativeId) || NARRATIVES[0];
  const context_  = CONTEXTS.find(c => c.id === config.contextId)
    || CONTEXTS.find(c => sku.bestMoment && JSON.stringify(c).toLowerCase().includes(String(sku.bestMoment).toLowerCase())) || CONTEXTS[0];
  const context = context_!;

  const brand = getBrandIdentity(brandId);
  const knowledgeBlock = getKnowledgeContext(brandId);
  const { version: ruleVersion, rules } = getActiveRules(brandId);
  const scoreboardBlock = getScoreboardContext(brandId);
  // Ma trận O3 tĩnh (SEGMENTS/RTBS/USP/NARRATIVES hook) + khoá đồ uống là DỮ LIỆU
  // RIÊNG của loveintea (chứa nguyên văn tên hãng, túi trà, thảo mộc). Brand khác
  // phải thay bằng dữ liệu sản phẩm/DNA của chính họ — gate theo brand (L4).
  const isLitMatrix = !brandId || brandId === 'loveintea';
  const bevLock = isLitMatrix
    ? (SKU_BEVERAGE_LOCK[sku.id] || SKU_BEVERAGE_LOCK[config.skuId])
    : undefined;

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

  // Danh tính brand bơm từ brands/brand_dna theo brandId — không giả định ngành (L4).
  const brandLabel = brand.name || 'this brand';
  const voiceBlock = brand.voiceTraits.length
    ? `BRAND VOICE (NON-NEGOTIABLE — every trait in every post):\n${brand.voiceTraits.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
    : 'BRAND VOICE: warm, human, specific to this brand — never generic AI tone.';
  const neverLine = brand.neverSay.length
    ? `COMPLIANCE — NEVER USE: ${brand.neverSay.join(', ')}`
    : 'COMPLIANCE: no medical/health-effect claims, no superlatives you cannot prove.';
  const alwaysLine = brand.alwaysSay.length
    ? ` Preferred phrasings: ${brand.alwaysSay.map(p => `"${p}"`).join(', ')}.`
    : '';

  const prompt = `You are writing an Instagram caption for ${brandLabel}${brand.throughLine ? ` — ${brand.throughLine}` : ''}.

${voiceBlock}

${neverLine}
CLAIM-SAFE APPROACH: Describe moments, rituals, feelings. NEVER promise physical or health effects on organs or body systems.${alwaysLine}
${knowledgeBlock}
${rulesBlock}
${scoreboardBlock}

PRODUCT: ${sku.productName}
${sku.ingredients.length ? `- Ingredients/components: ${sku.ingredients.join(', ')}` : ''}
${sku.theme ? `- Theme: ${sku.theme}` : ''}
${sku.bestMoment ? `- Best moment: ${sku.bestMoment}` : ''}
${sku.pitch ? `- Pitch: ${sku.pitch}` : ''}
${bevBlock}

${isLitMatrix
  ? `TARGET PERSON: ${segment.name} (${segment.age}), tension: "${segment.tension}"

ONE REASON TO BUY: "${rtb.label}"

USP ANCHOR (what this post proves):
- Label: ${usp.label}
- Claim-safe phrasing: "${usp.caption}"
- Image must show: ${usp.imageRule}

NARRATIVE STRUCTURE: ${narrative.label} — hook: "${narrative.hook}"`
  : `TARGET PERSON: the brand's core customer — infer from the BRAND STRATEGY above; never assume another industry's customer.

ONE REASON TO BUY: "${sku.pitch || sku.theme || `what makes ${sku.name} genuinely worth buying — state it concretely`}"

USP ANCHOR (what this post proves):
- Label: ${sku.theme || sku.name}
- Claim-safe phrasing: "${sku.pitch || `describe ${sku.name} honestly, no unverifiable claims`}"
- Image must show: the real product with its key differentiating detail clearly visible

NARRATIVE STRUCTURE: ${narrative.label} — write your own pattern-interrupt hook that fits THIS product and its customer (do NOT borrow hooks from other industries).`}

SCENE/CONTEXT: ${isLitMatrix ? `${context.label} — ${context.light}` : (sku.bestMoment || 'a natural, true-to-life moment where this product is actually used — soft natural light')}

CTA: "${config.cta}"

${config.extraNotes ? `EXTRA NOTES: ${config.extraNotes}` : ''}

Write the Instagram caption following this EXACT 4-beat structure:
1. HOOK (1 line) — pattern-interrupt using the narrative hook, mapped to segment tension
2. BRIDGE TO USP (1-2 lines) — connect moment/benefit to product truth using claim-safe phrasing above. THIS IS THE SELLING LINE.
3. BRAND VOICE (1 line) — ${isLitMatrix ? 'Warmly Wise + Proudly Vietnamese' : 'one line that embodies the brand voice traits above'}, no health claims
4. CTA (1 line) — the exact CTA above

Then write a brief IMAGE PROMPT (2-3 sentences) describing the photo that proves the same USP. The product (${brandLabel} "${sku.productName}" packaging) must be visible. ${bevLock ? `MANDATORY: brew in ${bevLock.vessel}, ${bevLock.color} brew color, ${bevLock.cue}.` : ''} Use: ${isLitMatrix ? `${context.label}, ${context.light}` : `the scene/context above, natural soft light`}.

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
    hashtags:    brand.hashtags.join(' '),
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
  brandId?: string;
}): string {
  const brandId = opts.brandId || '';
  const brand   = getBrandIdentity(brandId);
  const sku     = resolveProduct(brandId, opts.skuId);
  const context = CONTEXTS.find(c => c.id === opts.contextId);
  const usp     = USP_ANCHORS.find(u => u.id === opts.uspId);

  // Khoá đồ uống + chi tiết túi trà/tag trắng + USP/CONTEXT tĩnh là danh tính
  // loveintea — gate theo brand; brand khác dùng USP/scene suy từ chính sản phẩm (L4),
  // nên uspId/contextId với brand khác là TÙY CHỌN.
  const isLitMatrix = !brandId || brandId === 'loveintea';
  if (!sku || (isLitMatrix && (!context || !usp))) throw new Error('Invalid image prompt config');
  const bev = isLitMatrix
    ? (SKU_BEVERAGE_LOCK[sku.id] || SKU_BEVERAGE_LOCK[opts.skuId])
    : undefined;
  const brandLabel = brand.name || 'the brand';
  const bevInstructions = bev
    ? `The triangular pyramid tea bag should be visible steeping in a clear glass vessel. The white square tag with "${brandLabel}" wordmark must be legible. The brew must be ${bev.color} in a ${bev.vessel}. Include: ${bev.cue}.`
    : '';

  // Bảng màu lấy từ brand_dna.colors_json; camelCase key → nhãn đọc được.
  const colorEntries = Object.entries(brand.colors);
  const paletteLine = colorEntries.length
    ? `- Color palette: ${colorEntries.map(([k, v]) => `${k.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase())} (${v})`).join(', ')}`
    : '- Color palette: warm, premium tones consistent with the product packaging';

  return `Editorial lifestyle photo for ${brandLabel} — "${sku.productName}"${sku.pitch ? ` (${sku.pitch})` : ''}.

SCENE: ${context ? `${context.label}. ${context.light}.` : `${sku.bestMoment || 'A natural lifestyle moment where this product is actually used'}. Soft natural daylight.`}

THE PRODUCT (keep perfectly intact — DO NOT alter label, logo, or text on packaging):
The ${brandLabel} "${sku.name}" product packaging${sku.color ? ` (${sku.color} color)` : ''} should appear naturally in the scene — placed on a surface, partially in frame, or held. Reproduce the packaging design, printed text and logo exactly as in the reference image.
${bevInstructions}

IMAGE MUST PROVE THIS USP: ${isLitMatrix ? usp!.label : (sku.theme || sku.pitch || sku.name)}
Required visual element: ${isLitMatrix ? usp!.imageRule : "the real product with its key differentiating detail clearly visible — never props from another industry"}

VISUAL STYLE:
${paletteLine}
- Warm temperature grade, low contrast, lifted shadows
- Real tactile materials and textures true to the product's world
- Shallow depth of field, editorial quality
- Natural human element (hands, partial figure) — real skin texture, no AI artifacts
- 2-4 supporting props max, all plausible for this product's category
- NO health claim visuals, NO text overlays, NO invented logos
${bev ? `- Tag: 1 white ${brandLabel} logo tag — NOT red, NOT kraft` : ''}

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

export function reviewContent(caption: string, brandId: string, excludePostId?: string): ReviewResult {
  const gates = {
    claimSafety: { passed: true, issues: [] as string[] },
    aiQuality: { passed: true, issues: [] as string[] },
    dedup: { passed: true, issues: [] as string[] },
  };

  // Gate 1: FDA claim safety — match whole words only, so "liver" doesn't
  // flag "delivers" and "cures" doesn't flag "securest"
  for (const claim of BANNED_CLAIMS) {
    const re = new RegExp(`\\b${claim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(caption)) {
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
    // Loại CHÍNH bài đang đăng ra khỏi so sánh — nếu không, đăng FB xong rồi đăng
    // tiếp IG sẽ thấy bản FB vừa đăng là "trùng 100%" và bị chặn (card df16e755).
    const recent = db.prepare(
      `SELECT caption FROM posts
       WHERE brand_id = ? AND status IN ('published', 'scheduled')
       AND created_at > datetime('now', '-30 days')
       AND id != ?
       ORDER BY created_at DESC LIMIT 50`
    ).all(brandId, excludePostId ?? '') as { caption: string }[];

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
  const brand = getBrandIdentity(config.brandId);
  const sku = resolveProduct(config.brandId, config.skuId);
  // Ma trận O3 tĩnh là dữ liệu riêng loveintea — brand khác dùng dữ liệu sản phẩm (L4).
  const briefLitMatrix = !config.brandId || config.brandId === 'loveintea';
  const segment = SEGMENTS.find(s => s.id === config.segmentId);
  const rtb = RTBS.find(r => r.id === config.rtbId);
  const usp = USP_ANCHORS.find(u => u.id === config.uspId);
  const context = CONTEXTS.find(c => c.id === config.contextId);

  const rulesText = rules.length
    ? `\nActive Rules (v${ruleVersion}):\n${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
    : '';

  const prompt = `You are the brief builder for ${brand.name || 'this brand'}${brand.throughLine ? ` — ${brand.throughLine}` : ''}.
Input: 1 content slot.
${rulesText}

Slot:
- Channel: ${config.channel}
- Product: ${sku?.name ?? config.skuId}${sku?.pitch ? ` — ${sku.pitch}` : ''}
${briefLitMatrix
  ? `- Segment: ${segment?.name ?? config.segmentId} — tension: "${segment?.tension ?? ''}"
- RTB: ${rtb?.label ?? config.rtbId}
- USP: ${usp?.label ?? config.uspId}`
  : `- Segment: the brand's core customer (infer from brand strategy; never assume another industry's customer)
- RTB: ${sku?.pitch || sku?.theme || 'state concretely why this product is worth buying'}
- USP: ${sku?.theme || sku?.name || config.skuId}`}
- Context: ${briefLitMatrix ? (context?.label ?? config.contextId) : (sku?.bestMoment || context?.label || 'a natural moment where this product is used')}

Generate 1 brief with EXACTLY:
- 1 purpose (the single goal of this tile)
- 1 variable_cell (the variable being tested)
- copy_direction (tone + angle in 1-2 sentences)
- visual_direction (scene + mood in 1-2 sentences)
- format (still_lifestyle | still_product | carousel | reel)

Constraints:
- Copy must be claim-safe (FDA structure/function)
- Use theme/moment language, not health promises${briefLitMatrix && sku && SKU_BEVERAGE_LOCK[sku.id] ? `\n- Tag: 1 white ${brand.name || 'brand'} logo tag` : ''}

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

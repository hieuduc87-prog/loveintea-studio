/**
 * Director — Gemini builds the storyboard (script_json) from a brief,
 * brand DNA, and the brand's tagged clip library.
 * Pattern from bigai-youtube-tonghop script_matcher + content engine prompts.
 */
import { getDb } from '../db';
import { generateJSON } from '../gemini';
import { getExpertKnowledgeBlock } from '../brand-knowledge';

export interface Segment {
  dur_s: number;
  source: 'clip' | 'image' | 'ai_image';
  clip_id?: string;        // source=clip
  image_url?: string;      // source=image (DAM / product photo)
  image_prompt?: string;   // source=ai_image
  text?: string;           // caption overlaid during this segment
  text_anim?: 'fade' | 'pop' | 'slide';
}

export interface Storyboard {
  title: string;
  hook: string;            // big text first ~2.5s
  segments: Segment[];
  cta_text: string;        // end card
  voiceover: string;       // narration script paced to the duration (~2.3 words/sec)
}

export async function buildStoryboard(opts: {
  brandId: string; purpose: string; productId?: string;
  targetDurationS: number; bpm?: number | null; notes?: string; language?: string;
}): Promise<Storyboard> {
  const db = getDb();
  const { brandId, purpose, productId, targetDurationS, bpm, notes } = opts;
  // Ngôn ngữ cho toàn bộ text/hook/CTA/voiceover. Mặc định Tiếng Việt.
  const langName = (opts.language ?? 'vi').toLowerCase().startsWith('en') ? 'English' : 'Vietnamese';

  const dna = db.prepare('SELECT * FROM brand_dna WHERE brand_id=?').get(brandId) as Record<string, string> | undefined;
  const product = productId
    ? db.prepare('SELECT * FROM products WHERE id=?').get(productId) as Record<string, string> | undefined
    : undefined;
  const productImages = productId
    ? db.prepare('SELECT image_url FROM product_images WHERE product_id=? LIMIT 4').all(productId) as Array<{ image_url: string }>
    : [];
  if (product?.image_url) productImages.unshift({ image_url: product.image_url });

  // Prefer this product's own footage; fall back to brand-level clips (no product).
  const clips = productId
    ? db.prepare(
        `SELECT id, duration_s, tags_json FROM video_clips
         WHERE brand_id=? AND status='ready' AND (product_id=? OR product_id IS NULL)
         ORDER BY (product_id=?) DESC, created_at DESC LIMIT 60`
      ).all(brandId, productId, productId) as Array<{ id: string; duration_s: number; tags_json: string }>
    : db.prepare(
        `SELECT id, duration_s, tags_json FROM video_clips WHERE brand_id=? AND status='ready' ORDER BY created_at DESC LIMIT 60`
      ).all(brandId) as Array<{ id: string; duration_s: number; tags_json: string }>;

  const clipCatalog = clips.map(c => {
    let t: Record<string, unknown> = {};
    try { t = JSON.parse(c.tags_json); } catch { /* untagged */ }
    return { id: c.id, max_dur_s: Math.floor(c.duration_s * 10) / 10, ...t };
  });

  // Beat grid: segment durations should be whole multiples of the beat
  const beatS = bpm && bpm > 40 ? 60 / bpm : null;
  const beatRule = beatS
    ? `BGM is ${Math.round(bpm!)} BPM (1 beat = ${beatS.toFixed(3)}s). Every segment dur_s MUST be a whole multiple of ${(beatS * 2).toFixed(3)}s (2 beats) so cuts land on the beat.`
    : 'No BGM beat grid — use segment durations between 1.5s and 4s.';

  const compliance = dna?.compliance_json ?? '{}';

  const prompt = `You are the creative director for the brand "${brandId}" making a SHORT vertical video (9:16, Reels) for social media.

BRIEF:
- Purpose: ${purpose}
- Target duration: ${targetDurationS}s (sum of segment dur_s must be within ±10%)
- ${beatRule}
${product ? `- Featured product: ${product.name} — ${product.pitch ?? ''}. Theme: ${product.theme ?? ''}.` : '- No specific product (brand-level video).'}
${notes ? `- Extra notes from the marketer: ${notes}` : ''}

BRAND DNA (follow strictly):
- Tagline: ${dna?.tagline ?? ''} | Archetype: ${dna?.archetype ?? ''}
- Voice: ${dna?.voice_traits ?? '[]'}
- Target audience: ${dna?.target_audience ?? ''} | Insight: ${dna?.insight ?? ''} | Behavior: ${dna?.behavior ?? ''}
- COMPLIANCE (neverSay / alwaysSay): ${compliance}
${dna?.brand_rules ? `- BRAND RULES (mandatory): ${dna.brand_rules}` : ''}
${getExpertKnowledgeBlock(brandId)}

AVAILABLE BRAND CLIPS (use their id; never exceed max_dur_s):
${JSON.stringify(clipCatalog).slice(0, 6000)}

AVAILABLE PRODUCT PHOTOS (use as source=image with image_url):
${JSON.stringify(productImages.map(p => p.image_url))}

RULES (proven editing knowledge):
1. 5-9 segments. First segment = strongest visual (scroll-stopper).
2. Mix ratio target: ~30% real clips, ~70% photos/AI images (Ken Burns motion is applied to stills automatically).
3. source priority: clip from catalog → image (product photo) → ai_image (only for atmosphere scenes that don't exist; write a 60-100 word prompt: Subject, Action, Environment, Camera, Style — no brand text in image).
LANGUAGE: write ALL on-screen text, hook, cta_text and voiceover in ${langName}. Do NOT mix languages.
4. text: short ${langName} caption (max 8 words), benefit-led, follows compliance. Not every segment needs text.
5. hook: max 7 words, creates curiosity, ${langName}.
6. cta_text: short CTA aligned with the purpose, ${langName}.
7. voiceover: a smooth ${langName} narration read over the whole video. Length ≈ ${Math.round(targetDurationS * 2.3)} words (≈2.3 words/sec for ${targetDurationS}s). Warm, on-brand, follows compliance, complements (does NOT just repeat) the on-screen text. One flowing paragraph, no timestamps.

Return ONLY JSON:
{"title":"...","hook":"...","segments":[{"dur_s":2.0,"source":"clip|image|ai_image","clip_id":"...","image_url":"...","image_prompt":"...","text":"...","text_anim":"fade|pop|slide"}],"cta_text":"...","voiceover":"..."}`;

  const board = await generateJSON<Storyboard>(prompt);
  if (!board?.segments?.length) throw new Error('Director returned empty storyboard');

  // Sanity: clamp durations, snap to beat grid, drop unknown clip ids
  const clipIds = new Set(clips.map(c => c.id));
  board.segments = board.segments.slice(0, 10).map(s => {
    let dur = Math.min(6, Math.max(1, Number(s.dur_s) || 2));
    if (beatS) dur = Math.max(2, Math.round(dur / (beatS * 2))) * beatS * 2;
    if (s.source === 'clip' && (!s.clip_id || !clipIds.has(s.clip_id))) {
      s.source = s.image_url ? 'image' : 'ai_image';
      if (s.source === 'ai_image' && !s.image_prompt) s.image_prompt = 'Cozy tea moment, warm natural light, steam rising from a ceramic cup on a wooden table, soft morning glow, camera static close-up, cinematic 35mm, no text';
    }
    return { ...s, dur_s: Math.round(dur * 1000) / 1000 };
  });
  return board;
}

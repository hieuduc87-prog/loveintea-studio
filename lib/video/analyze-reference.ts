/**
 * Reference-video analysis — reverse-engineer a proven viral video into a reusable
 * RECIPE (DLS-automedia `src/clone` pattern). Upload the clip to the Gemini File API,
 * get a deep structural breakdown (scenes, pacing, narrative arc, camera, transitions),
 * then compress it into a VideoRecipe the director locks the new storyboard onto.
 *
 * The goal: keep the WINNING structure (scene count, pacing, camera energy, emotional
 * arc) but swap in our brand's own product/content. We never copy the competitor's words.
 */
import fs from 'fs';
import path from 'path';
import { VideoRecipe } from './director';
import { extractFrames, TMP_DIR } from './ffmpeg';
import { analyzeImage } from '../gemini';

export interface ReferenceAnalysis {
  duration_s?: number;
  overall_mood?: string;
  pacing?: { tempo?: string; avg_scene_duration_s?: number; rhythm_pattern?: string };
  color_palette?: { dominant?: string[]; temperature?: string; saturation?: string; contrast?: string };
  narrative_arc?: { structure?: string };
  scenes?: Array<{
    start_s?: number; end_s?: number; duration_s?: number;
    type?: string;                 // hook|process|sensory|hero|reveal|lifestyle|cta|transition|text_card
    visual_description?: string;   // CONCEPT to show (not the original footage)
    camera?: string;               // dolly in|pan|static|tracking|macro|orbit|tilt|handheld|rack_focus|whip_pan
    framing?: string;              // ECU|CU|MS|WS|top_down|low_angle|high_angle
    motion_intensity?: number;
    has_text_overlay?: boolean; text_content?: string;
    has_product?: boolean; product_visibility?: string;
    transition_to_next?: string;   // cut|dissolve|crossfade|match_cut|wipe|zoom
    emotional_beat?: string;       // curiosity|wonder|pride|desire|trust|urgency|calm|excitement
  }>;
  audio_analysis?: { has_voiceover?: boolean; vo_pace?: string; bgm_mood?: string; audio_mix_style?: string };
  production_notes?: { real_footage_ratio?: number; notable_techniques?: string[] };
}

const DEEP_PROMPT = `You are an expert video production analyst reverse-engineering a viral short video so it can be RECREATED with different source material. Watch the whole clip and return ONLY JSON.

Rules:
- Timestamps accurate to 0.1s; identify EVERY scene/cut including fast ones.
- camera/framing must use the exact vocabulary listed.
- visual_description tells WHAT TO SHOW as a CONCEPT (so we can recreate it with our own footage) — do NOT describe the original footage's specific subjects.
- Capture every text overlay (content) and the emotional arc.

JSON shape:
{"duration_s":<num>,"overall_mood":"...",
 "pacing":{"tempo":"slow|medium|fast","avg_scene_duration_s":<num>,"rhythm_pattern":"e.g. gradual build → climax → resolution"},
 "color_palette":{"dominant":["#hex"],"temperature":"warm|cool|neutral","saturation":"low|medium|high","contrast":"low|medium|high"},
 "narrative_arc":{"structure":"hook → ... → cta"},
 "scenes":[{"start_s":0,"end_s":2.0,"duration_s":2.0,
   "type":"hook|origin|process|sensory|hero|reveal|lifestyle|cta|transition|text_card",
   "visual_description":"concept to show","camera":"dolly in|pan|static|tracking|macro|orbit|tilt|handheld|slider|rack_focus|whip_pan",
   "framing":"ECU|CU|MS|WS|establishing|top_down|low_angle|high_angle","motion_intensity":0.0,
   "has_text_overlay":true,"text_content":"...","has_product":true,"product_visibility":"full|partial|none",
   "transition_to_next":"cut|dissolve|crossfade|match_cut|wipe|zoom","emotional_beat":"curiosity|wonder|pride|desire|trust|urgency|calm|excitement"}],
 "audio_analysis":{"has_voiceover":true,"vo_pace":"slow|medium|fast","bgm_mood":"...","audio_mix_style":"vo_dominant|music_dominant|balanced"},
 "production_notes":{"real_footage_ratio":0.5,"notable_techniques":["..."]}}`;

/** Full-clip analysis via Gemini File API (native video understanding). Returns null on failure. */
async function geminiVideoDeep(videoPath: string, mimeType: string): Promise<ReferenceAnalysis | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const { GoogleAIFileManager, FileState } = await import('@google/generative-ai/server');
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const fm = new GoogleAIFileManager(key);

    const uploaded = await fm.uploadFile(videoPath, { mimeType, displayName: path.basename(videoPath) });
    let file = await fm.getFile(uploaded.file.name);
    const deadline = Date.now() + 120_000;
    while (file.state === FileState.PROCESSING && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 3000));
      file = await fm.getFile(uploaded.file.name);
    }
    if (file.state !== FileState.ACTIVE) { try { await fm.deleteFile(uploaded.file.name); } catch { /* */ } return null; }

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseMimeType: 'application/json' } });
    const res = await model.generateContent([{ fileData: { mimeType, fileUri: file.uri } }, DEEP_PROMPT]);
    const raw = res.response.text().trim();
    try { await fm.deleteFile(uploaded.file.name); } catch { /* best effort */ }
    const m = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : raw) as ReferenceAnalysis;
  } catch (e) {
    console.warn('[analyze-ref] gemini video API failed, will fall back to frames:', String(e).slice(0, 200));
    return null;
  }
}

/** Fallback: sample frames and infer a coarse structure (when File API is unavailable). */
async function frameFallback(videoPath: string, id: string): Promise<ReferenceAnalysis | null> {
  try {
    const dir = path.join(TMP_DIR, `ref_${id}`);
    const frames = await extractFrames(videoPath, dir, 6);
    // Send the middle frame; the model infers a plausible structure from a single still.
    const raw = await analyzeImage(fs.readFileSync(frames[Math.floor(frames.length / 2)]), 'image/jpeg',
      `${DEEP_PROMPT}\n(You only see ONE representative frame — infer a plausible 5-7 scene structure from it.)`);
    fs.rmSync(dir, { recursive: true, force: true });
    const m = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : raw) as ReferenceAnalysis;
  } catch (e) {
    console.warn('[analyze-ref] frame fallback failed:', String(e).slice(0, 150));
    return null;
  }
}

export async function analyzeReferenceVideo(videoPath: string, mimeType: string, id: string): Promise<ReferenceAnalysis | null> {
  return (await geminiVideoDeep(videoPath, mimeType)) ?? (await frameFallback(videoPath, id));
}

/** Compress a deep analysis into the compact recipe the director locks onto. */
export function analysisToRecipe(a: ReferenceAnalysis): VideoRecipe {
  const scenes = (a.scenes ?? []).slice(0, 12).map(s => ({
    dur_s: Math.max(1, Math.round(((s.duration_s ?? ((s.end_s ?? 0) - (s.start_s ?? 0))) || 2) * 10) / 10),
    type: s.type,
    camera: s.camera,
    framing: s.framing,
    emotional_beat: s.emotional_beat,
    transition: s.transition_to_next,
    has_product: s.has_product ?? (s.product_visibility === 'full' || s.product_visibility === 'partial'),
  }));
  return {
    total_s: a.duration_s,
    structure: a.narrative_arc?.structure,
    scenes,
  };
}

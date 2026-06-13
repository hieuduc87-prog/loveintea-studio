/**
 * Gemini video understanding — DLS-automedia pattern.
 * Uploads the whole clip to the Gemini File API and asks for a structured
 * breakdown (subject, scenes, mood, motion, best moment) used to (a) autotag
 * the clip library and (b) feed the director with real footage knowledge.
 *
 * Falls back to single-frame Vision analysis (analyzeImage) if the File API
 * path fails — so tagging never blocks the upload pipeline.
 */
import fs from 'fs';
import path from 'path';
import { analyzeImage } from '../gemini';
import { extractFrames, TMP_DIR } from './ffmpeg';

export interface ClipAnalysis {
  subject: string;
  scene: string;
  mood: string;            // calm | energetic | cozy | fresh | dramatic | joyful
  motion: string;          // static | slow | medium | fast
  colors: string[];
  has_product: boolean;
  has_text: boolean;
  quality: string;         // high | medium | low
  time_of_day: string;
  shot: string;            // close-up | medium | wide
  best_moment_s?: number;  // timestamp of the most usable beat
  scenes?: Array<{ start_s: number; end_s: number; description: string }>;
  usable_for?: string[];   // purposes this clip fits: promo, ritual, educate...
}

const ANALYSIS_PROMPT = `You are a video editor cataloguing brand footage for a short-video (Reels) library.
Watch this clip and return ONLY JSON describing it for later automatic editing:
{"subject":"main subject 2-5 words","scene":"setting","mood":"calm|energetic|cozy|fresh|dramatic|joyful",
"motion":"static|slow|medium|fast","colors":["dominant","colors"],"has_product":true/false,"has_text":true/false,
"quality":"high|medium|low","time_of_day":"morning|afternoon|evening|night|studio","shot":"close-up|medium|wide",
"best_moment_s":<seconds of the single most usable/beautiful moment>,
"scenes":[{"start_s":0,"end_s":3,"description":"..."}],
"usable_for":["promo","ritual","educate","launch","testimonial"]}`;

/** Full-clip analysis via Gemini File API. Returns null on failure (caller falls back). */
async function geminiVideoAnalyze(videoPath: string, mimeType: string): Promise<ClipAnalysis | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const { GoogleAIFileManager, FileState } = await import('@google/generative-ai/server');
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const fm = new GoogleAIFileManager(key);

    const uploaded = await fm.uploadFile(videoPath, { mimeType, displayName: path.basename(videoPath) });
    let file = await fm.getFile(uploaded.file.name);
    const deadline = Date.now() + 90_000;
    while (file.state === FileState.PROCESSING && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 3000));
      file = await fm.getFile(uploaded.file.name);
    }
    if (file.state !== FileState.ACTIVE) { try { await fm.deleteFile(uploaded.file.name); } catch { /* */ } return null; }

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseMimeType: 'application/json' } });
    const res = await model.generateContent([
      { fileData: { mimeType, fileUri: file.uri } },
      ANALYSIS_PROMPT,
    ]);
    const raw = res.response.text().trim();
    try { await fm.deleteFile(uploaded.file.name); } catch { /* best effort */ }
    const m = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : raw) as ClipAnalysis;
  } catch (e) {
    console.warn('[analyze] gemini video API failed, will fall back to frame:', String(e).slice(0, 200));
    return null;
  }
}

/** Single mid-frame fallback (the original lite tagger). */
async function frameFallback(videoPath: string, id: string): Promise<ClipAnalysis | null> {
  try {
    const dir = path.join(TMP_DIR, `tag_${id}`);
    const frames = await extractFrames(videoPath, dir, 3);
    const raw = await analyzeImage(fs.readFileSync(frames[1]), 'image/jpeg', ANALYSIS_PROMPT);
    fs.rmSync(dir, { recursive: true, force: true });
    const m = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : raw) as ClipAnalysis;
  } catch (e) {
    console.warn('[analyze] frame fallback failed:', String(e).slice(0, 150));
    return null;
  }
}

export async function analyzeClip(videoPath: string, mimeType: string, id: string): Promise<ClipAnalysis | null> {
  return (await geminiVideoAnalyze(videoPath, mimeType)) ?? (await frameFallback(videoPath, id));
}

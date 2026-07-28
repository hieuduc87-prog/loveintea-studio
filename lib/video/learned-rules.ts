/**
 * LEARNED RULES — vòng run→learn→fix→loop TỰ ĐỘNG của Reel Machine:
 * QA gate bắt lỗi → Gemini tổng quát hóa thành 1 luật tái dùng → lưu
 * BRAND_LIBRARY/RULES/learned_rules.json → TỰ áp vào mọi prompt sau.
 * GUARD > GIẤY: luật nằm trong pipeline, không nằm trong trí nhớ người.
 */
import { generateJSON } from '../gemini';
import { readLibJson, writeLibJson } from './brand-library';

export interface LearnedRule { rule: string; from: string; at: string; hits: number }

const REL = 'RULES/learned_rules.json';
const MAX_RULES = 30;      // chống phình — luật cũ ít trúng bị đẩy ra
const APPLY_TOP = 8;       // số luật gần nhất áp vào prompt

export function readLearnedRules(brandId: string): LearnedRule[] {
  return readLibJson<LearnedRule[]>(brandId, REL) ?? [];
}

/** Chuẩn hoá để dedupe luật trùng ý (so substring thô — đủ tốt, rẻ). */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

export function appendLearnedRule(brandId: string, rule: string, from: string): boolean {
  const clean = rule.trim().slice(0, 200);
  if (clean.length < 15) return false;
  const rules = readLearnedRules(brandId);
  const n = norm(clean);
  const dup = rules.find(r => norm(r.rule).includes(n) || n.includes(norm(r.rule)));
  if (dup) { dup.hits += 1; dup.at = new Date().toISOString(); }
  else rules.push({ rule: clean, from: from.slice(0, 40), at: new Date().toISOString(), hits: 1 });
  rules.sort((a, b) => (b.at > a.at ? 1 : -1));
  writeLibJson(brandId, REL, rules.slice(0, MAX_RULES));
  return !dup;
}

/** Khối luật đã học — director append vào mọi prompt scene/hero. */
export function learnedRulesBlock(brandId: string): string {
  const top = readLearnedRules(brandId).slice(0, APPLY_TOP);
  if (!top.length) return '';
  return ` LEARNED RULES (from past failures, obey strictly): ${top.map(r => r.rule).join(' ')}`;
}

/** Gọi khi QA fail — tổng quát hóa lỗi thành luật (không chặn pipeline nếu Gemini chập chờn). */
export async function learnFromFailure(brandId: string, blockId: string, sceneHint: string, reason: string): Promise<void> {
  try {
    const r = await generateJSON<{ rule: string }>(
      `A video-generation QA gate FAILED. Scene concept: "${sceneHint.slice(0, 140)}". Failure reason: "${reason.slice(0, 200)}".
Generalize this into ONE short reusable ENGLISH rule (max 25 words) to append to FUTURE image/video prompts so this CLASS of failure never happens again — abstract the pattern, do not mention this specific scene. Example style: "any book or journal in frame must be closed with a plain cover and no readable text".
Return ONLY JSON {"rule":"..."}`
    );
    if (r.rule) {
      const added = appendLearnedRule(brandId, r.rule, blockId);
      if (added) console.log(`[reel-learn] luật mới (${blockId}): ${r.rule}`);
    }
  } catch { /* học được thì tốt, không học được thì thôi — không chặn render */ }
}

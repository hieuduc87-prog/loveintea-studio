/**
 * Expert knowledge block — human-injected tips / real cases / rules that go
 * straight into the production prompts. This is the FAST learning loop: experts
 * push knowledge in, it shapes generation immediately (complements the slow
 * metrics-based loop).
 */
import { getDb } from './db';

// Knowledge types treated as direct production guidance
export const EXPERT_TYPES = ['expert_tip', 'real_case', 'rule', 'insight'] as const;

const TYPE_LABEL: Record<string, string> = {
  expert_tip: 'MẸO CHUYÊN GIA', real_case: 'CASE THỰC TẾ', rule: 'RULE', insight: 'INSIGHT',
};

/** Formatted block of the most recent expert knowledge for a brand (capped). */
export function getExpertKnowledgeBlock(brandId: string, limit = 25): string {
  try {
    const rows = getDb().prepare(
      `SELECT type, title, content FROM knowledge_docs
       WHERE brand_id = ? AND type IN ('expert_tip','real_case','rule','insight')
       ORDER BY uploaded_at DESC LIMIT ?`
    ).all(brandId, limit) as Array<{ type: string; title: string; content: string | null }>;
    if (!rows.length) return '';
    const lines = rows.map(r => `- [${TYPE_LABEL[r.type] ?? r.type}] ${r.title}${r.content ? `: ${r.content.slice(0, 400)}` : ''}`);
    return `\n\n═══ EXPERT KNOWLEDGE (tri thức người vận hành — tuân thủ) ═══\n${lines.join('\n')}\n═══ END EXPERT KNOWLEDGE ═══`;
  } catch {
    return '';
  }
}

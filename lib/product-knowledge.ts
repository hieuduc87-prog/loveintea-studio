/**
 * Product knowledge template + photo shot-list requirements.
 * - Default field template that customer-sent files get parsed into (Gemini).
 * - Default shot list (angles + min quantity) to brief a photographer when missing.
 */
import * as XLSX from 'xlsx';
import { getDb } from './db';
import { generateJSON } from './gemini';

// ── Knowledge template — default fields filled from customer files ──
export interface KnowledgeField { key: string; label: string; hint: string; multiline?: boolean }

export const DEFAULT_KNOWLEDGE_FIELDS: KnowledgeField[] = [
  { key: 'short_desc',     label: 'Mô tả ngắn',          hint: '1-2 câu giới thiệu sản phẩm' },
  { key: 'full_desc',      label: 'Mô tả đầy đủ',        hint: 'Đoạn mô tả chi tiết', multiline: true },
  { key: 'ingredients',    label: 'Thành phần',          hint: 'Danh sách nguyên liệu + %', multiline: true },
  { key: 'benefits',       label: 'Lợi ích',             hint: 'Công dụng, lợi ích chính', multiline: true },
  { key: 'how_to_use',     label: 'Cách dùng',           hint: 'Hướng dẫn pha/sử dụng', multiline: true },
  { key: 'target_audience',label: 'Khách hàng mục tiêu', hint: 'Ai nên dùng' },
  { key: 'usps',           label: 'Điểm khác biệt (USP)',hint: 'Lý do chọn sản phẩm này', multiline: true },
  { key: 'story',          label: 'Câu chuyện / nguồn gốc', hint: 'Xuất xứ, câu chuyện thương hiệu', multiline: true },
  { key: 'certifications', label: 'Chứng nhận',          hint: 'Tiêu chuẩn, chứng nhận, an toàn' },
  { key: 'price',          label: 'Giá / quy cách',      hint: 'Giá bán, đóng gói, dung tích' },
  { key: 'keywords',       label: 'Từ khóa',             hint: 'Keywords cho SEO/hashtag' },
  { key: 'faq',            label: 'Câu hỏi thường gặp',  hint: 'FAQ', multiline: true },
];

// ── Photo shot-list — required angles to brief a photographer ──
export interface ShotReq { type: string; label: string; desc: string; min: number }

export const DEFAULT_SHOT_REQUIREMENTS: ShotReq[] = [
  { type: 'packshot',  label: 'Packshot bao bì',  desc: 'Chụp chính diện + góc 45°, nền sạch/trắng, đủ sáng, thấy rõ nhãn', min: 2 },
  { type: 'macro',     label: 'Macro nguyên liệu',desc: 'Cận cảnh lá trà/nguyên liệu, kết cấu, hạt — DOF nông', min: 2 },
  { type: 'flat-lay',  label: 'Flat-lay',         desc: 'Bố cục nhìn từ trên xuống với props (tách, thìa, hoa khô)', min: 1 },
  { type: 'lifestyle', label: 'Lifestyle',        desc: 'Khung cảnh sử dụng thật: bàn làm việc, sáng sớm, thư giãn — có người càng tốt', min: 3 },
  { type: 'photo',     label: 'Nước pha thành phẩm', desc: 'Ly/tách trà đã pha, thấy màu nước, hơi nước bốc lên', min: 2 },
];

export function getShotRequirements(productRow: { shot_req_json?: string | null }): ShotReq[] {
  if (productRow.shot_req_json) {
    try { const r = JSON.parse(productRow.shot_req_json) as ShotReq[]; if (Array.isArray(r) && r.length) return r; } catch { /* default */ }
  }
  return DEFAULT_SHOT_REQUIREMENTS;
}

/** Parse an uploaded file buffer into plain text for the AI extractor. */
export function fileToText(buffer: Buffer, filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    return wb.SheetNames.map(name => `### Sheet: ${name}\n${XLSX.utils.sheet_to_csv(wb.Sheets[name])}`).join('\n\n').slice(0, 30000);
  }
  // txt, csv, md, json, or anything decodable as utf-8
  return buffer.toString('utf-8').slice(0, 30000);
}

/** Extract template fields from raw text (customer doc) via Gemini. */
export async function extractKnowledge(productName: string, brandId: string, text: string): Promise<Record<string, string>> {
  const fields = DEFAULT_KNOWLEDGE_FIELDS.map(f => `"${f.key}": "${f.label} — ${f.hint}"`).join(',\n');
  const prompt = `You are organizing product information for "${productName}" (brand ${brandId}) into a structured template.
From the SOURCE TEXT below (sent by the client, may be messy / multi-language), extract and fill these fields in Vietnamese.
Leave a field as empty string "" if the source has no info for it. Do NOT invent facts — only use what's in the source.

FIELDS:
{
${fields}
}

SOURCE TEXT:
"""
${text}
"""

Return ONLY a JSON object with exactly these keys: ${DEFAULT_KNOWLEDGE_FIELDS.map(f => f.key).join(', ')}.`;
  const out = await generateJSON<Record<string, string>>(prompt);
  const clean: Record<string, string> = {};
  for (const f of DEFAULT_KNOWLEDGE_FIELDS) clean[f.key] = String(out[f.key] ?? '').trim();
  return clean;
}

/** Consolidate / rewrite the current knowledge into clean, on-brand copy ("sum all"). */
export async function summarizeKnowledge(productName: string, brandId: string, current: Record<string, string>): Promise<Record<string, string>> {
  const db = getDb();
  const dna = db.prepare('SELECT tagline, voice_traits, compliance_json FROM brand_dna WHERE brand_id=?').get(brandId) as Record<string, string> | undefined;
  const prompt = `Polish and consolidate the product knowledge for "${productName}" into clean, consistent, on-brand Vietnamese copy.
Merge duplicates, fix grammar, keep facts, follow brand voice + compliance. Do NOT add unverified claims.

BRAND VOICE: ${dna?.voice_traits ?? '[]'} | COMPLIANCE: ${dna?.compliance_json ?? '{}'}
CURRENT KNOWLEDGE (JSON): ${JSON.stringify(current)}

Return ONLY a JSON object with the same keys, improved.`;
  const out = await generateJSON<Record<string, string>>(prompt);
  const clean: Record<string, string> = {};
  for (const f of DEFAULT_KNOWLEDGE_FIELDS) clean[f.key] = String(out[f.key] ?? current[f.key] ?? '').trim();
  return clean;
}

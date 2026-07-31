/**
 * GATE TRUNG THỰC SẢN PHẨM (founder 30/07: "edit phải đảm bảo chuẩn nhất về
 * sản phẩm, không được tự bịa") — máy tự kiểm sau MỖI ảnh sinh ra, không đợi
 * mắt người:
 *   1. CHỮ trên sản phẩm (thêu/in/nhãn) phải khớp từng ký tự với ảnh thật
 *      (case thật: "BELLA" thành "BELLEA").
 *   2. KHÔNG bịa bao bì: ảnh sinh có hộp/carton mà ảnh thật không có → fail
 *      (case thật: mũ chó bị vẽ kèm hộp carton "BELLEA").
 *
 * VERIFY-GATE law: hỏi CHECKLIST từng trường, CODE quyết verdict — không tin
 * "ổn không?" tổng của LLM. Gate hỏng (Gemini chết) → coi như PASS kèm cờ
 * unchecked: gate là lưới an toàn, không được chặn việc thật.
 */
import { imagesVerdictJSON } from './gemini';

export interface FidelityVerdict {
  ok: boolean;
  checked: boolean;          // false = gate không chạy được (đừng nhầm với pass)
  textMismatch: boolean;
  inventedPackaging: boolean;
  /** Gossby 31/07: mũ CHO CHÓ bị đội lên đầu NGƯỜI — sản phẩm phải được dùng
   *  bởi đúng loại chủ thể như trong ảnh thật (pet ↔ pet, người ↔ người). */
  wrongWearer: boolean;
  expectedWearer: string;
  generatedWearer: string;
  expectedText: string;
  generatedText: string;
  note: string;
}

interface RawVerdict {
  product_text_visible?: boolean;
  reference_text_spelled?: string;
  generated_text_spelled?: string;
  reference_has_retail_packaging?: boolean;
  generated_has_retail_packaging?: boolean;
  reference_worn_by?: string;
  generated_worn_by?: string;
  note?: string;
}

/** "B-E-L-L-A" / "BELLA " / "bella" → "BELLA" để CODE so sánh. */
const normText = (t: string | undefined): string =>
  String(t ?? '').replace(/[-\s._]/g, '').toUpperCase();

// LLM chỉ làm MẮT (đánh vần), CODE làm quan toà — bản đầu tin trường
// text_matches_exactly và bị qua mặt ngay lần hai: ảnh "BELEA" được phán đạt.
// Đánh vần từng ký tự có gạch nối ép model nhìn kỹ từng chữ cái.
const PROMPT = `IMAGE 1 is a REAL reference photo of a product. IMAGE 2 is an AI-generated marketing image that is supposed to show the SAME product.
Read all printed/embroidered/label text ON THE PRODUCT in each image. Spell it CHARACTER BY CHARACTER separated by hyphens (e.g. "B-E-L-L-A"). Look extremely carefully at every letter.
Answer ONLY this JSON (no prose):
{
 "product_text_visible": true|false,
 "reference_text_spelled": "characters on the product in IMAGE 1, hyphen-separated, empty if none",
 "generated_text_spelled": "characters on the product in IMAGE 2, hyphen-separated, empty if none",
 "reference_has_retail_packaging": true|false,
 "generated_has_retail_packaging": true|false,
 "reference_worn_by": "who/what wears or uses the product in IMAGE 1: dog|cat|pet|person|child|nobody",
 "generated_worn_by": "who/what wears or uses the product in IMAGE 2: dog|cat|pet|person|child|nobody",
 "note": "one short sentence"
}`;

export async function verifyProductFidelity(
  refImage: Buffer,
  generated: Buffer,
  opts?: { refHasPackaging?: boolean },
): Promise<FidelityVerdict> {
  try {
    const imgs = [
      { data: refImage, mimeType: 'image/png' },
      { data: generated, mimeType: 'image/png' },
    ];
    // OCR HAI LẦN độc lập — hai lần đọc lệch nhau = mắt không chắc = KHÔNG pass
    // (gate 1 phiếu từng bị qua mặt: "BELEA" được phán đạt ở lần chạy thứ hai).
    const [v, v2] = await Promise.all([
      imagesVerdictJSON<RawVerdict>(imgs, PROMPT),
      imagesVerdictJSON<RawVerdict>(imgs, PROMPT),
    ]);
    const refText  = normText(v.reference_text_spelled);
    const refText2 = normText(v2.reference_text_spelled);
    const genText  = normText(v.generated_text_spelled);
    const genText2 = normText(v2.generated_text_spelled);
    // CODE quyết verdict: chuỗi ĐÃ CHUẨN HOÁ phải trùng ở CẢ hai lần đọc.
    const anyVisible = Boolean(v.product_text_visible) || Boolean(v2.product_text_visible);
    const ocrUnstable = refText !== refText2 || genText !== genText2;
    const textMismatch = anyVisible && Boolean(refText) && (genText !== refText || ocrUnstable);
    // Bịa bao bì = ảnh sinh có bao bì trong khi cả ảnh ref lẫn kho ảnh đều không có
    const refHasPack = Boolean(v.reference_has_retail_packaging) || Boolean(v2.reference_has_retail_packaging) || Boolean(opts?.refHasPackaging);
    const inventedPackaging = (Boolean(v.generated_has_retail_packaging) || Boolean(v2.generated_has_retail_packaging)) && !refHasPack;
    // NGƯỜI DÙNG SẢN PHẨM: pet-group (dog/cat/pet) vs người — khác nhóm = sai.
    const wearerGroup = (w?: string) => {
      const x = String(w ?? '').toLowerCase();
      if (/dog|cat|pet|animal/.test(x)) return 'pet';
      if (/person|child|human|man|woman/.test(x)) return 'person';
      return '';
    };
    const refWearer = wearerGroup(v.reference_worn_by) || wearerGroup(v2.reference_worn_by);
    const genWearer = wearerGroup(v.generated_worn_by) || wearerGroup(v2.generated_worn_by);
    const wrongWearer = Boolean(refWearer) && Boolean(genWearer) && refWearer !== genWearer;
    return {
      ok: !textMismatch && !inventedPackaging && !wrongWearer,
      checked: true,
      textMismatch,
      inventedPackaging,
      wrongWearer,
      expectedWearer: refWearer,
      generatedWearer: genWearer,
      expectedText: refText,
      generatedText: ocrUnstable && genText === refText ? genText2 : genText,
      note: `${ocrUnstable ? 'OCR hai lần lệch nhau; ' : ''}${String(v.note ?? '')}`,
    };
  } catch (e) {
    // Gate không được chặn việc thật — nhưng phải nói rõ là CHƯA kiểm.
    return {
      ok: true, checked: false, textMismatch: false, inventedPackaging: false,
      wrongWearer: false, expectedWearer: '', generatedWearer: '',
      expectedText: '', generatedText: '',
      note: `gate không chạy được: ${String(e instanceof Error ? e.message : e).slice(0, 120)}`,
    };
  }
}

/** Đổi verdict fail thành chỉ dẫn sửa nhét vào prompt lần gen lại. */
export function fidelityRetryClause(v: FidelityVerdict): string {
  const parts: string[] = ['PREVIOUS ATTEMPT FAILED PRODUCT-FIDELITY QA:'];
  if (v.textMismatch) {
    parts.push(`the text on the product must read EXACTLY "${v.expectedText}" letter-for-letter (previous attempt wrote "${v.generatedText}"). Reproduce the reference text precisely — do not add, drop or alter any character.`);
  }
  if (v.inventedPackaging) {
    parts.push('do NOT draw any retail box, carton or packaging — the real product is sold WITHOUT one; show only the product itself.');
  }
  if (v.wrongWearer) {
    parts.push(`the product must be worn/used by a ${v.expectedWearer === 'pet' ? 'PET (the animal itself)' : 'PERSON'} exactly as in the reference photos — previous attempt put it on a ${v.generatedWearer}. NEVER transfer the product onto a different kind of wearer.`);
  }
  return parts.join(' ');
}

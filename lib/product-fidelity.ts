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
  expectedText: string;
  generatedText: string;
  note: string;
}

interface RawVerdict {
  product_text_visible?: boolean;
  reference_text?: string;
  generated_text?: string;
  text_matches_exactly?: boolean;
  reference_has_retail_packaging?: boolean;
  generated_has_retail_packaging?: boolean;
  note?: string;
}

const PROMPT = `IMAGE 1 is a REAL reference photo of a product. IMAGE 2 is an AI-generated marketing image that is supposed to show the SAME product.
Answer ONLY this JSON (no prose):
{
 "product_text_visible": true|false,        // any printed/embroidered/label text readable on the product in IMAGE 2?
 "reference_text": "text readable on the product in IMAGE 1, empty if none",
 "generated_text": "text readable on the product in IMAGE 2, empty if none",
 "text_matches_exactly": true|false,        // letter-for-letter identical (ignore case/line breaks)?
 "reference_has_retail_packaging": true|false,  // IMAGE 1 shows a retail box/carton/pouch as packaging?
 "generated_has_retail_packaging": true|false,  // IMAGE 2 shows a retail box/carton/pouch?
 "note": "one short sentence on any mismatch"
}`;

export async function verifyProductFidelity(
  refImage: Buffer,
  generated: Buffer,
  opts?: { refHasPackaging?: boolean },
): Promise<FidelityVerdict> {
  try {
    const v = await imagesVerdictJSON<RawVerdict>(
      [
        { data: refImage, mimeType: 'image/png' },
        { data: generated, mimeType: 'image/png' },
      ],
      PROMPT,
    );
    // CODE quyết verdict từ từng trường:
    const textMismatch = Boolean(v.product_text_visible) && v.text_matches_exactly === false;
    // Bịa bao bì = ảnh sinh có bao bì trong khi cả ảnh ref lẫn kho ảnh đều không có
    const refHasPack = Boolean(v.reference_has_retail_packaging) || Boolean(opts?.refHasPackaging);
    const inventedPackaging = Boolean(v.generated_has_retail_packaging) && !refHasPack;
    return {
      ok: !textMismatch && !inventedPackaging,
      checked: true,
      textMismatch,
      inventedPackaging,
      expectedText: String(v.reference_text ?? ''),
      generatedText: String(v.generated_text ?? ''),
      note: String(v.note ?? ''),
    };
  } catch (e) {
    // Gate không được chặn việc thật — nhưng phải nói rõ là CHƯA kiểm.
    return {
      ok: true, checked: false, textMismatch: false, inventedPackaging: false,
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
  return parts.join(' ');
}

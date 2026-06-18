/**
 * Phân loại ảnh sản phẩm bằng Gemini Vision → đặt tên + gắn vai trò (ref_role) để luồng
 * gen ảnh (gpt-image edit) tự chọn đúng ảnh base phù hợp với từng cảnh cần dựng.
 */
import { analyzeImage } from './gemini';

export interface ProductImageClass {
  type: string;        // packshot | lifestyle | macro | flat-lay | photo
  angle: string;       // front | back | side | 45 | top | macro | in_use | flat_lay | detail | unknown
  ref_role: string;    // packshot | ingredient | lifestyle | texture | scale | other
  label: string;       // tên ngắn, vd "Front packshot trên nền gỗ"
  content: string;     // mô tả ngắn ảnh thể hiện gì
}

const PROMPT = `Bạn phân loại MỘT ảnh sản phẩm (trà/thảo mộc) để hệ thống tự chọn ảnh tham chiếu phù hợp khi tạo ảnh mới bằng AI edit.
Trả ONLY JSON đúng schema:
{
 "type": "packshot|lifestyle|macro|flat-lay|photo",
 "angle": "front|back|side|45|top|macro|in_use|flat_lay|detail|unknown",
 "ref_role": "packshot|ingredient|lifestyle|texture|scale|other",
 "label": "tên ngắn gọn tiếng Việt mô tả ảnh (vd: Front packshot hộp trà trên nền gỗ)",
 "content": "1 câu mô tả ảnh thể hiện gì"
}
Hướng dẫn ref_role (vai trò làm ẢNH BASE khi gen):
- packshot: ảnh bao bì/hộp/túi sản phẩm rõ nét, chính diện — dùng làm base cho cảnh HERO/giới thiệu sản phẩm.
- ingredient: trà khô/thảo mộc/nguyên liệu rời cận cảnh — base cho cảnh nguyên liệu/thành phần.
- lifestyle: sản phẩm đang dùng / ly trà pha / tay cầm / bối cảnh đời sống — base cho cảnh lifestyle.
- texture: macro kết cấu bề mặt.
- scale: nhiều sản phẩm/bộ sưu tập trong 1 ảnh.
- other: còn lại.`;

export async function classifyProductImage(data: Buffer, mimeType: string): Promise<ProductImageClass | null> {
  try {
    const raw = await analyzeImage(data, mimeType, PROMPT);
    const m = raw.match(/\{[\s\S]*\}/);
    const o = JSON.parse(m ? m[0] : raw) as Partial<ProductImageClass>;
    return {
      type: o.type || 'photo',
      angle: o.angle || 'unknown',
      ref_role: o.ref_role || 'other',
      label: o.label || '',
      content: o.content || '',
    };
  } catch (e) {
    console.warn('[classify] failed:', String(e).slice(0, 150));
    return null;
  }
}

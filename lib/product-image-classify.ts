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

/**
 * Card 26c22e82 — prompt cũ viết cứng "(trà/thảo mộc)" và mô tả vai trò toàn
 * bằng từ ngữ trà ("trà khô", "ly trà pha"). Brand bán mũ cho chó thì mọi mô tả
 * đều lệch. Nay bối cảnh sản phẩm được TRUYỀN VÀO, prompt giữ trung lập ngành.
 */
function buildPrompt(ctx?: { productName?: string; category?: string }): string {
  const about = ctx?.productName
    ? `Sản phẩm trong ảnh là: "${ctx.productName}"${ctx.category ? ` (ngành hàng: ${ctx.category})` : ''}.`
    : 'Sản phẩm có thể thuộc bất kỳ ngành hàng nào — ĐỪNG giả định là đồ ăn/thức uống.';
  return `Bạn phân loại MỘT ảnh sản phẩm để hệ thống tự chọn ảnh tham chiếu phù hợp khi tạo ảnh mới bằng AI edit.
${about}
Trả ONLY JSON đúng schema:
{
 "type": "packshot|lifestyle|macro|flat-lay|in_use",
 "angle": "front|back|side|45|top|macro|in_use|flat_lay|detail|unknown",
 "ref_role": "packshot|ingredient|lifestyle|texture|scale|other",
 "label": "tên ngắn gọn tiếng Việt mô tả ảnh (vd: Packshot chính diện trên nền trắng)",
 "content": "1 câu mô tả ảnh thể hiện gì"
}
Hướng dẫn "type":
- packshot: chỉ có sản phẩm, nền sạch/trắng, thấy rõ hình dáng và nhãn.
- macro: cận cảnh chất liệu/kết cấu/chi tiết một phần sản phẩm.
- flat-lay: nhìn từ trên xuống, sản phẩm cùng đạo cụ xếp đặt.
- lifestyle: sản phẩm trong bối cảnh đời sống, có người/thú cưng/khung cảnh.
- in_use: sản phẩm ở trạng thái hoàn chỉnh lúc dùng (đồ uống đã pha, quần áo đã mặc, mũ đã đội…).
Hướng dẫn ref_role (vai trò làm ẢNH BASE khi gen):
- packshot: ảnh sản phẩm/bao bì rõ nét, chính diện — base cho cảnh HERO/giới thiệu.
- ingredient: thành phần/nguyên liệu rời cận cảnh (nếu ngành hàng có) — base cho cảnh thành phần.
- lifestyle: sản phẩm đang được dùng / tay cầm / bối cảnh đời sống.
- texture: macro kết cấu bề mặt.
- scale: nhiều sản phẩm/bộ sưu tập trong 1 ảnh.
- other: còn lại.
Nếu KHÔNG chắc chắn, chọn "other" cho ref_role — đừng đoán bừa.`;
}

export async function classifyProductImage(
  data: Buffer, mimeType: string, ctx?: { productName?: string; category?: string },
): Promise<ProductImageClass | null> {
  try {
    const raw = await analyzeImage(data, mimeType, buildPrompt(ctx));
    const m = raw.match(/\{[\s\S]*\}/);
    const o = JSON.parse(m ? m[0] : raw) as Partial<ProductImageClass>;
    return {
      // Không rơi về 'photo': đó là giá trị "chưa phân loại" (card 26c22e82) —
      // để mặc định vào đó là ảnh chưa nhận dạng được vẫn hiện như đã phân loại.
      type: o.type || 'other',
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

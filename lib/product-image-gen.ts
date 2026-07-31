/**
 * CỔNG SINH ẢNH SẢN PHẨM DÙNG CHUNG — mọi đường gen ảnh có sản phẩm PHẢI đi
 * qua đây (gossby 31/07: mũ CHO CHÓ bị đội lên đầu NGƯỜI ở các route chưa gác;
 * gate lúc đó chỉ phủ template-generate = 1/6 đường. Meta-luật doctrine: lỗi
 * cùng lớp có cùng hình dạng — vá cả lớp, không vá từng route).
 *
 * Cung cấp: (1) khoá CÁCH DÙNG sản phẩm vào prompt (pet ↔ pet, người ↔ người,
 * theo đúng ảnh thật); (2) fidelity gate sau sinh (chữ + bao bì + người đội)
 * + tự gen lại 1 lần; (3) cảnh báo tiếng Việt rõ ràng khi vẫn chưa đạt.
 * Brand-agnostic — áp mọi tenant.
 */
import fs from 'fs';
import { editProductImage } from './openai-image';
import { pickProductRefUrl, productHasBoxImage } from './product-ref';
import { resolveProductImagePath } from './plan-generate';
import { verifyProductFidelity, fidelityRetryClause } from './product-fidelity';

export interface GatedImageResult {
  dataUri: string;                // data:image/png;base64,...
  warnings: string[];             // tiếng Việt — hiện cho nhân viên
  gate: 'pass' | 'retried' | 'warned' | 'skipped';
}

/** Câu khoá cách dùng — chèn vào MỌI prompt có sản phẩm, kể cả khi gate chết. */
export const USAGE_LOCK =
  'PRODUCT USAGE LOCK: depict the product used by the SAME kind of wearer/subject as in its reference photos — a pet product is worn by THE PET itself and NEVER by a human; a human product is never put on an animal. Copy the product\'s real appearance exactly; do not invent packaging, text or variants.';

/**
 * Sinh ảnh sản phẩm CÓ GÁC. baseImagePath mặc định = ảnh ref tốt nhất của
 * sản phẩm (hero/front). Trả dataUri + cảnh báo; ném lỗi nếu không sinh được.
 */
export async function generateProductImageGated(opts: {
  brandId: string;
  productId: string;
  prompt: string;
  baseImagePath?: string;         // ép ảnh gốc cụ thể (vd ref người dùng chọn)
  size?: '1024x1024' | '1024x1536' | '1536x1024';
  log?: (m: string) => void;
}): Promise<GatedImageResult> {
  const { brandId, productId, log } = opts;
  const refUrl = pickProductRefUrl(productId, 'product');
  const refPath = opts.baseImagePath || (refUrl ? resolveProductImagePath(refUrl.split('?')[0]) : null);
  const productHasBox = productHasBoxImage(productId);
  const prompt = `${opts.prompt} ${USAGE_LOCK}${productHasBox ? '' : ' This product has NO retail box/packaging — never draw one.'}`;

  if (!refPath) {
    // Không có ảnh sản phẩm cục bộ → generate thuần nhưng VẪN khoá cách dùng,
    // và nói rõ cho nhân viên là chưa kiểm được độ trung thực.
    const { generateImage } = await import('./openai-image');
    const dataUri = await generateImage({ prompt, size: opts.size, brandId });
    log?.('⚠ sản phẩm chưa có ảnh tham chiếu cục bộ — sinh không kiểm chứng được, kiểm tra kỹ');
    return { dataUri, warnings: ['sản phẩm chưa có ảnh tham chiếu — không kiểm được độ trung thực'], gate: 'skipped' };
  }

  let dataUri = await editProductImage({ productImagePath: refPath, prompt, size: opts.size, brandId });
  const warnings: string[] = [];
  let gateState: GatedImageResult['gate'] = 'pass';
  try {
    if (dataUri.startsWith('data:')) {
      const refBuf = fs.readFileSync(refPath);
      const genBuf = () => Buffer.from(dataUri.slice(dataUri.indexOf(',') + 1), 'base64');
      let v = await verifyProductFidelity(refBuf, genBuf(), { refHasPackaging: productHasBox });
      if (v.checked && !v.ok) {
        const why = [
          v.textMismatch ? `chữ "${v.generatedText}" ≠ "${v.expectedText}"` : '',
          v.inventedPackaging ? 'bịa bao bì' : '',
          v.wrongWearer ? `sản phẩm bị ${v.generatedWearer === 'person' ? 'NGƯỜI' : 'thú'} dùng thay vì ${v.expectedWearer === 'pet' ? 'thú cưng' : 'người'}` : '',
        ].filter(Boolean).join(', ');
        log?.(`QA sản phẩm FAIL (${why}) — gen lại…`);
        const retry = await editProductImage({ productImagePath: refPath, prompt: `${prompt} ${fidelityRetryClause(v)}`, size: opts.size, brandId });
        if (retry.startsWith('data:')) {
          const v2 = await verifyProductFidelity(refBuf, Buffer.from(retry.slice(retry.indexOf(',') + 1), 'base64'), { refHasPackaging: productHasBox });
          dataUri = retry; v = v2;
        }
        if (v.checked && !v.ok) {
          gateState = 'warned';
          warnings.push(`⚠ ảnh chưa khớp sản phẩm thật (${why}) — KIỂM TRA KỸ trước khi đăng`);
          log?.(warnings[warnings.length - 1]);
        } else {
          gateState = 'retried';
          log?.('QA đạt sau gen lại ✓');
        }
      } else if (v.checked) {
        log?.('QA sản phẩm ✓');
      }
    }
  } catch { /* gate không bao giờ chặn việc thật */ }
  return { dataUri, warnings, gate: gateState };
}

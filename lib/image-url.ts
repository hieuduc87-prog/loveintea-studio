/**
 * Image URL helpers — đảm bảo mọi nút DOWNLOAD/PREVIEW ảnh trong app dùng chất
 * lượng cao thay vì ảnh native 1024×1536.
 *
 * FIX HỆ THỐNG (card hoa-lang-thang "Không thể generate hình ảnh chất lượng 4K"):
 * gpt-image-2 xuất native 1024×1536. Route /api/images/[filename] hỗ trợ ?w=N&q=Q
 * (sharp resize/upscale trên-the-fly), nhưng frontend download link CŨ KHÔNG
 * append query → khách tải ra 1024×1536 → tưởng app không xuất được 4K.
 *
 * Fix áp cho MỌI brand: gọi hdDownloadUrl() ở mọi anchor download → 4096×5120,
 * quality 95 (JPEG-like). Ảnh non-/api/images (external URL / data:) trả nguyên.
 */

/** URL để DOWNLOAD ảnh HD 4K (4096w, q=95). Chỉ áp cho /api/images/*. */
export function hdDownloadUrl(url: string | undefined | null): string {
  if (!url) return '';
  if (!url.startsWith('/api/images/')) return url;
  // Nếu URL đã có query khác thì giữ, chỉ đảm bảo có w+q
  const [base, qs] = url.split('?');
  const p = new URLSearchParams(qs || '');
  if (!p.has('w')) p.set('w', '4096');
  if (!p.has('q')) p.set('q', '95');
  return `${base}?${p.toString()}`;
}

/** URL để PREVIEW ảnh chất lượng vừa phải (1600w, q=85) — tiết kiệm bandwidth. */
export function previewUrl(url: string | undefined | null, w: number = 1600): string {
  if (!url) return '';
  if (!url.startsWith('/api/images/')) return url;
  const [base, qs] = url.split('?');
  const p = new URLSearchParams(qs || '');
  if (!p.has('w')) p.set('w', String(w));
  if (!p.has('q')) p.set('q', '85');
  return `${base}?${p.toString()}`;
}

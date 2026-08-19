'use client';

/**
 * ViewHelpButton — nút "?" nhỏ ở góc phải header của MỖI VIEW quan trọng.
 * Click → mở drawer bên phải với hướng dẫn step-by-step cho ĐÚNG view đó.
 * Dùng chung: `<ViewHelpButton viewId="brand_dna" />` — nội dung lấy từ VIEW_HELP map.
 *
 * Trải nghiệm cao cấp:
 * - Nút nhỏ, không phô trương (chỉ hiện khi user cần)
 * - Drawer trượt vào 320-420px bên phải, không đóng modal chính (user vẫn thấy màn)
 * - Step-by-step số thứ tự + mock UI screenshot inline (ASCII/SVG mockup nhẹ)
 * - "Vẫn không rõ" → mở HelpChatbot floating (kết nối chuỗi tự phục vụ)
 */
import { useState, useEffect } from 'react';

interface HelpStep {
  title: string;
  detail: string;
  tip?: string;
  warn?: string;
}
interface HelpContent {
  title: string;
  intro: string;
  steps: HelpStep[];
  faq?: Array<{ q: string; a: string }>;
}

const VIEW_HELP: Record<string, HelpContent> = {
  brand_dna: {
    title: '🌿 Brand DNA — Chất thương hiệu',
    intro: 'AI dựa vào Brand DNA để viết đúng "giọng" thương hiệu bạn. Điền càng kỹ, mọi caption/ảnh/video sau đó càng chuẩn. Chỉ điền một lần, hưởng cả năm.',
    steps: [
      { title: 'Cách nhanh nhất — kéo-thả tài liệu', detail: 'Kéo file Word/PDF/PNG (brand guideline, brochure, moodboard) vào ô trên → AI đọc và tự trích ra: tagline, giọng nói, đối tượng khách, insight, luật thương hiệu. Xong trong 30-60 giây.', tip: 'Kéo nhiều file cùng lúc — càng nhiều tài liệu, DNA càng đầy đủ.' },
      { title: 'Điền tay các trường chính', detail: 'Nếu không có tài liệu: TAGLINE (1 câu, vd "Trà thảo mộc cho người ngủ ngon"), VOICE (3-5 tính từ, vd "ấm áp, chân thật, khoa học"), ARCHETYPE (mẫu hình, vd "Người chữa lành"), THROUGH-LINE (câu chuyện xuyên suốt).' },
      { title: 'Compliance & Content Rules', detail: 'Nhập từ CẤM (không được viết vì luật quảng cáo) + hashtag TRẮNG (được ưu tiên) + màu chủ đạo (hex code). AI sẽ tuân theo tuyệt đối khi sinh nội dung.', warn: 'Từ cấm quan trọng với thực phẩm/mỹ phẩm — bạn khai báo 1 lần, tránh vi phạm cả năm.' },
      { title: 'Model Look (Ảnh AI)', detail: 'Chọn "vietnamese" (mẫu người Việt) hoặc "western" (mẫu Tây) hoặc "auto" (theo ngôn ngữ). Loveintea đang set "western" vì bán US.' },
    ],
    faq: [
      { q: 'Có bắt buộc điền tất cả không?', a: 'Không — tối thiểu TAGLINE + VOICE là đủ dùng. Còn lại làm dần khi có thời gian.' },
      { q: 'AI trích sai từ tài liệu, làm sao sửa?', a: 'Bấm vào từng trường và sửa tay. AI chỉ là gợi ý, quyết định cuối là của bạn.' },
    ],
  },
  products: {
    title: '📦 Products — Kho sản phẩm & ảnh chuẩn vàng',
    intro: 'Mỗi sản phẩm cần TÊN + MÔ TẢ + ẢNH (nhiều góc). Đặc biệt: MỖI SẢN PHẨM cần ĐÁNH DẤU 1 ẢNH HERO (⭐) — đây là ảnh chuẩn vàng mà AI sẽ bám 100% để không bịa bao bì.',
    steps: [
      { title: 'Thêm sản phẩm mới', detail: 'Bấm "+ Add Product" ở góc phải → điền tên, slug (URL friendly), ingredients (thành phần thật — quan trọng cho AI hiểu chủ đề), best_moment (khi nào dùng), use_cases (dùng làm gì).', tip: 'Ingredients viết dạng "chamomile, lotus leaf, perilla, red dates" — AI sẽ dùng để vẽ đúng cảnh nguyên liệu.' },
      { title: 'Upload nhiều góc ảnh', detail: 'Cho mỗi sản phẩm, upload ≥5 ảnh: hộp front (mặt trước chuẩn), 45° (nghiêng), side (cạnh), detail (chi tiết bao bì), flat-lay (ingredients rời).', tip: 'Càng nhiều góc, AI càng có "kho tham chiếu" phong phú để tổng hợp cảnh lifestyle.' },
      { title: '⭐ ĐÁNH HERO — bước SỐNG CÒN', detail: 'Bấm nút ⭐ (star) trên 1 ảnh hộp MẶT TRƯỚC chuẩn nhất. Đây là ảnh mọi hệ thống tạo ảnh SẼ BÁM 100% — không có hero, AI dễ bịa bao bì (màu sai, tên sai, layout sai).', warn: 'Sau khi thêm sản phẩm mới → NHỚ ĐÁNH HERO ngay. Không có hero = ảnh AI sẽ drift → founder mất công báo lỗi.' },
      { title: 'Phân loại ảnh (auto)', detail: 'Hệ thống tự chạy AI để gán ref_role cho mỗi ảnh (packshot / lifestyle / ingredient). Bạn có thể sửa tay nếu AI đoán sai bằng dropdown.' },
    ],
  },
  content_templates: {
    title: '🎨 Content Templates — Kho ảnh mẫu để AI học phong cách',
    intro: 'Template là bộ ảnh mẫu bạn muốn nội dung có phong cách giống. AI phân tích template → hiểu bố cục/màu/mood → tái tạo với sản phẩm của bạn.',
    steps: [
      { title: 'Tạo template mới', detail: 'Bấm "+ Tạo template" → chọn kiểu (1 ảnh / Collection nhiều ảnh / Video) → upload ảnh mẫu.', tip: 'Chọn ảnh có phong cách bạn thích: minimal / vibrant / warm / clean. AI sẽ học cả 3-4 template và tổng hợp.' },
      { title: 'AI Analyze — TỰ ĐỘNG CHẠY ngầm', detail: 'Sau upload, hệ thống TỰ chạy Gemini phân tích bố cục ~8 giây. Bạn không cần bấm gì — chờ badge chuyển từ "⚠ chưa phân tích" thành "✓ đã phân tích".', tip: 'Nếu 8s sau vẫn "⚠", bấm nút "AI Analyze" trên panel template để chạy lại.' },
      { title: 'Tạo post từ template', detail: 'Chọn template + chọn sản phẩm → AI sinh 1 hoặc N ảnh (carousel) giữ phong cách template nhưng CHỦ THỂ là sản phẩm bạn. Ảnh ra Review & Queue để duyệt.', warn: 'Nếu template CHƯA phân tích xong (badge ⚠), hệ thống chặn tạo post — chờ analyze xong rồi thử lại.' },
      { title: 'Tổ chức bằng category', detail: 'Đặt category cho template (product, lifestyle, promo, education) để lọc dễ. Dùng "Scoreboard" xem template nào chạy engagement cao → làm thêm.' },
    ],
    faq: [
      { q: 'Template có bao nhiêu ảnh là đủ?', a: 'Tối thiểu 3-5 template mỗi loại (product/lifestyle/promo). Nhiều hơn thì AI có kho phong phú, ảnh sinh ra đa dạng hơn.' },
      { q: 'Có thể xoá template cũ không?', a: 'Được, bấm nút thùng rác. Không ảnh hưởng bài đã đăng.' },
    ],
  },
};

export function ViewHelpButton({ viewId }: { viewId: string }) {
  const [open, setOpen] = useState(false);
  const help = VIEW_HELP[viewId];

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    if (open) window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open]);

  if (!help) return null;

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="w-7 h-7 rounded-full border border-gray-700 hover:border-brand-500 hover:bg-brand-600/10 text-gray-400 hover:text-brand-300 text-xs font-bold flex items-center justify-center transition-colors"
        title="Hướng dẫn nhanh cho màn hình này (phím tắt: ?)"
        aria-label="Hướng dẫn nhanh">
        ?
      </button>

      {open && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setOpen(false)} />
          <aside className="fixed right-0 top-0 h-full w-full sm:w-[420px] bg-gray-950 border-l border-gray-800 z-50 overflow-y-auto shadow-2xl">
            <header className="sticky top-0 bg-gray-950 border-b border-gray-800 px-5 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">{help.title}</h3>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white text-sm px-2">✕</button>
            </header>

            <div className="p-5 space-y-6">
              <p className="text-sm text-gray-300 leading-relaxed">{help.intro}</p>

              <ol className="space-y-4">
                {help.steps.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-600/20 border border-brand-500 text-brand-300 text-xs font-bold flex items-center justify-center">{i + 1}</div>
                    <div className="flex-1 space-y-1.5">
                      <div className="text-sm font-semibold text-white">{s.title}</div>
                      <div className="text-xs text-gray-400 leading-relaxed">{s.detail}</div>
                      {s.tip && <div className="text-xs bg-blue-950/30 border border-blue-900/50 text-blue-300 rounded px-2 py-1.5">💡 {s.tip}</div>}
                      {s.warn && <div className="text-xs bg-amber-950/30 border border-amber-900/50 text-amber-300 rounded px-2 py-1.5">⚠ {s.warn}</div>}
                    </div>
                  </li>
                ))}
              </ol>

              {help.faq && help.faq.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Câu hỏi thường gặp</h4>
                  <div className="space-y-3">
                    {help.faq.map((f, i) => (
                      <div key={i} className="text-xs">
                        <div className="text-gray-300 font-semibold mb-1">Q: {f.q}</div>
                        <div className="text-gray-500 leading-relaxed">A: {f.a}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-800 pt-4">
                <div className="text-xs text-gray-500 mb-2">Vẫn không rõ?</div>
                <button onClick={() => setOpen(false)}
                  className="text-xs text-brand-300 hover:text-brand-200">
                  💬 Mở chatbot ở góc phải dưới → hỏi tự do bằng tiếng Việt
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  );
}

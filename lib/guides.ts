// Tài liệu hướng dẫn dùng chung — UserGuideView (tab Guide) + nút ❓ trong từng tab.
export interface Guide {
  id: string; icon: string; title: string; group: string;
  intro: string; steps?: string[]; tips?: string[];
}

export const GUIDES: Guide[] = [
  {
    id: 'overview', icon: '🏠', title: 'Tổng quan hệ thống', group: 'Bắt đầu',
    intro: 'LoveinTea Studio là hệ điều hành marketing khép kín: Chiến lược → Kế hoạch → Sản xuất → Đăng → Đo lường → Học hỏi → quay lại Chiến lược. Mọi tính năng phục vụ vòng lặp này; càng vận hành, hệ thống càng tự tối ưu (template/segment/insight nào thắng thì ưu tiên).',
    steps: [
      'Điều hướng bằng link sạch: mỗi tab là 1 URL (vd /plan-calendar, /video-studio) — bookmark hoặc share được.',
      'Brand switcher ở góc trên sidebar: mọi dữ liệu (sản phẩm, kế hoạch, kênh, metrics) tách theo brand.',
      'Thứ tự nhóm sidebar = đúng quy trình: Home → Brain → Plan → Create → Publish → Engage → Learn → Library → System.',
      'Bắt đầu lần đầu: (1) Brand DNA → nhập/đổ từ tài liệu, (2) Products → ảnh + knowledge, (3) Channels → kết nối FB/IG, (4) Plan/Create → làm content.',
    ],
    tips: ['Dashboard luôn báo đỏ khi có sự cố (token hết hạn, scheduler chết, bài lỗi) — nhìn Dashboard mỗi sáng.'],
  },
  {
    id: 'dashboard', icon: '🏠', title: 'Dashboard', group: 'Home',
    intro: 'Màn hình tổng quan sức khỏe + số liệu. Mở app là vào đây.',
    steps: [
      'Banner đỏ "Cần chú ý": liệt kê sự cố cần xử lý (FB chưa kết nối, token sắp hết, scheduler không chạy, bài đăng lỗi, AI đang dùng backup).',
      '4 thẻ funnel: Draft / Đã hẹn giờ / Đã đăng 7 ngày / Thất bại — bấm để nhảy tới chỗ xử lý.',
      'Thẻ "Tình trạng hệ thống": FB token (số ngày còn lại), IG, scheduler, AI engines. Nút "Kiểm tra lại" để check token trực tiếp.',
      'Phần chi tiết phía dưới: hiệu suất theo sản phẩm, top bài engaged, tăng trưởng theo tuần, tag thắng (segment/insight/hành vi).',
    ],
    tips: ['Số liệu chi tiết = 0 cho tới khi có bài đã đăng + scheduler sync metrics (mỗi 6h).'],
  },
  {
    id: 'brand_dna', icon: '🌿', title: 'Brand DNA', group: 'Brain',
    intro: 'Bộ não thương hiệu — nuôi MỌI prompt AI. Có 4 sub-tab: DNA & Chiến lược · Knowledge · Rules · Mindmap.',
    steps: [
      'DNA & Chiến lược: tagline, archetype, giọng, màu + 4 trường chiến lược (Khách hàng mục tiêu, Insight, Hành vi, Rule riêng brand).',
      'Không gõ tay được? Bấm "✨ Tổng hợp tất cả tài liệu đã có" (đọc Playbook + tài liệu đã upload) hoặc "📄 Nhập từ file khách gửi" (xlsx/csv/txt/docx) → AI tự điền → xem lại → Lưu.',
      'Knowledge (sub-tab): thư viện tài liệu nguồn. "⚡ Thêm nhanh tri thức" để bơm mẹo/case thực tế/rule/insight — AI áp dụng NGAY khi sinh content (vòng học nhanh).',
      'Rules (sub-tab): quy tắc content có version.',
      'Mindmap (sub-tab): sơ đồ radial toàn bộ tri thức brand — bấm node xem chi tiết.',
    ],
    tips: ['4 trường chiến lược + tri thức expert được nhồi vào Content Workshop, Plan generate và Video director — điền kỹ ở đây thì content tự bám đúng.'],
  },
  {
    id: 'products', icon: '📦', title: 'Products', group: 'Brain',
    intro: 'Hồ sơ + kho media từng sản phẩm. Mỗi sản phẩm có 2 mục: "Ảnh & Video" và "Brief & Knowledge".',
    steps: [
      'Chọn sản phẩm → "📦 Ảnh & Video": upload ảnh + video (tới 200MB/file, chunked qua Cloudflare). Video tự được AI phân tích cảnh/mood.',
      'Gắn loại ảnh: mở 1 ảnh (lightbox) → dropdown chọn loại (packshot/macro/lifestyle…) để brief chụp chính xác.',
      '"📋 Brief & Knowledge": checklist yêu cầu ảnh (các góc + số lượng cần) — coverage tự đếm, nút "Gửi creative" xuất brief .txt liệt kê shot còn thiếu.',
      'Knowledge sản phẩm: 12 trường mặc định, AI fill từ file khách (📎) hoặc dán text, "✨ Tổng hợp" để gom sạch.',
    ],
    tips: ['Video upload ở đây = kho footage per-product cho Video Studio dùng.'],
  },
  {
    id: 'content_templates', icon: '🎨', title: 'Content Templates', group: 'Brain',
    intro: 'Thư viện khung mẫu content. Mỗi template là 1 ảnh, 1 collection (nhiều ảnh có thứ tự), hoặc video.',
    steps: [
      'Bấm "+ Tạo template" → nhập tên + chọn loại trong dropdown (🖼 1 ảnh / 📚 Collection / 🎬 Video) → "Tạo & thêm media".',
      'Trong template: "+ Upload ảnh" (nhiều ảnh), "🖼 Ảnh có sẵn" (kéo/chọn từ thư viện), kéo thumbnail để sắp thứ tự, hover để xóa. Loại video thì upload 1 video.',
      'Bấm "🤖 AI Analyze" → Gemini đọc tất cả ảnh → số lượng, step, nội dung từng ảnh + cấu trúc + 🦴 khung sườn tái dùng.',
      'Card hiện badge loại (🎬/📚N/🖼); collection có collage tất cả ảnh + bung xem thứ tự.',
    ],
    tips: ['Sau khi AI Analyze, khi tạo post & chọn template này (ở Tạo Content hoặc Plan), AI dựng bài theo khung sườn nhưng khớp sản phẩm mới.'],
  },
  {
    id: 'plan_calendar', icon: '🗓️', title: 'Plan & Lịch', group: 'Plan',
    intro: 'Gộp Kế hoạch + Lịch đăng. Toggle Lịch | Bảng plan.',
    steps: [
      'Upload .xlsx kế hoạch hoặc chọn plan có sẵn từ dropdown.',
      'Banner Drift cảnh báo: item quá hạn chưa tạo bài, bài lệch ngày plan, bài chờ duyệt.',
      'Run All / Run từng dòng: AI sinh caption + (tùy chọn) ảnh + (tùy chọn) lên lịch theo plan. Công tắc "dùng template (rotate)" để tự chọn template win-rate cao.',
      'Duyệt: tick từng dòng hoặc "Duyệt tất cả". Mỗi bài tự gắn multi-tag (segment/insight/hành vi/template…) ngay khi tạo.',
      'Chèn bài: bấm ngày trống trên lịch để tạo nhanh, hoặc kéo bài nháp vào ngày. Bài đã đăng có 🔒 — không đổi lịch được.',
    ],
    tips: ['Run All gọi AI tuần tự nên tốn thời gian + quota; tắt "tạo ảnh" nếu chỉ cần caption.'],
  },
  {
    id: 'create_studio', icon: '✨', title: 'Tạo Content', group: 'Create',
    intro: 'Gom 3 công cụ: CreateLab (thử nhanh) · Content Workshop (O3) · Image Studio.',
    steps: [
      'CreateLab: chọn sản phẩm + nhập ý chính → "✨ Tạo nhanh" (AI tự suy giọng/đối tượng/USP từ DNA, ra 3 biến thể). Chọn template (dải thumbnail) để bài bám cấu trúc template.',
      'Preview thật FB & IG (cấp post / cấp wall) ngay bên phải; bấm "🖼 Tạo ảnh", rồi "📅 Thêm vào lịch".',
      'Content Workshop (O3): chỉ cần chọn Sản phẩm (SKU) — các biến còn lại (Segment/RTB/USP/Narrative/Context) không chọn thì hệ thống TỰ pick và chạy bình thường.',
      'Image Studio: tạo/sửa ảnh sản phẩm (giữ nguyên packaging qua chế độ Edit).',
    ],
    tips: ['Bật "Auto-post to Facebook" trong Workshop = sinh xong đăng luôn.'],
  },
  {
    id: 'video_studio', icon: '🎬', title: 'Video Studio', group: 'Create',
    intro: 'Tạo video ngắn 9:16 hybrid: clip kho + ảnh AI + voiceover, beat-sync nhạc.',
    steps: [
      'Chọn sản phẩm → dropdown load clip của sản phẩm đó. Upload clip mới nếu cần (AI tự tag cảnh/mood).',
      'Chọn mục đích + thời lượng + nhạc nền (mp3 HOẶC video — tự bóc nhạc). Bật "🎙️ Lồng tiếng" + chọn giọng.',
      'Bấm "🧠 Tạo storyboard" → AI dựng kịch bản (trộn clip + ảnh sản phẩm + ảnh AI) → "▶ Render".',
      'Render xong xem preview / tải về (1080×1920, mix voiceover + nhạc ducking).',
    ],
    tips: ['Server render tuần tự ~3-8 phút/video. Output lưu data/images, đăng FB/IG fetch được.'],
  },
  {
    id: 'blog_factory', icon: '📝', title: 'Blog Factory', group: 'Create',
    intro: 'Sinh nội dung blog SEO theo chủ đề/sản phẩm.',
    steps: ['Chọn sản phẩm/chủ đề → AI viết bài blog (title, excerpt, nội dung) → lưu draft/published.'],
  },
  {
    id: 'content_queue', icon: '✅', title: 'Review & Queue', group: 'Publish',
    intro: 'Bàn duyệt + hàng đợi mọi bài (draft/scheduled/published/failed).',
    steps: [
      'Lọc theo trạng thái. Bấm 1 bài để xem chi tiết (caption, ảnh).',
      'Đăng: nút Post Now chạy Review Desk (gate compliance) trước → publish FB/IG. Hoặc đặt giờ để hẹn lịch.',
      'Bài hẹn giờ được scheduler tự đăng đúng giờ (IG không có native scheduling — hệ thống tự đăng).',
    ],
    tips: ['Bài thất bại xem lỗi ở đây; sửa rồi đăng lại.'],
  },
  {
    id: 'publisher', icon: '📡', title: 'Channels', group: 'Publish',
    intro: 'Kết nối + quản lý kênh FB/IG cho từng brand.',
    steps: [
      'Cách 1 (tự động): "Connect with Facebook" — đăng nhập, cấp quyền, chọn page.',
      'Cách 2 (khuyên cho khách ngoài): "Nhập token thủ công / System User token" — dán token + Page ID, hệ thống verify qua Graph API trước khi lưu (mã hóa AES-256-GCM, gắn riêng brand đang chọn).',
      'IG: phải link Instagram Business vào page (Meta Business Suite) trước, rồi token mới đăng IG được.',
    ],
    tips: ['Token lưu mã hóa; status không bao giờ lộ token. Mỗi brand 1 kênh riêng.'],
  },
  {
    id: 'inbox', icon: '💬', title: 'Inbox & Comments', group: 'Engage',
    intro: 'Tin nhắn + bình luận FB/IG về 1 chỗ để trả lời.',
    steps: ['Xem comment/message, đánh dấu đã đọc, trả lời.'],
  },
  {
    id: 'analytics', icon: '📊', title: 'Analytics', group: 'Learn',
    intro: 'Thống kê hiệu suất bài đăng.',
    steps: ['Xem reach/engaged/reactions/comments/shares per bài; dữ liệu từ scheduler sync mỗi 6h.'],
  },
  {
    id: 'scoreboard', icon: '🏆', title: 'Scoreboard', group: 'Learn',
    intro: 'Bảng phán quyết SCALE / HOLD / RETIRE theo từng góc content.',
    steps: ['Cần ≥10 bài đã đăng để tính. Góc SCALE = nhân bản, RETIRE = ngừng. Bấm "recompute" để tính lại.'],
    tips: ['Kết hợp với tag-performance + template win-rate để chọn combo thắng.'],
  },
  {
    id: 'cost', icon: '💰', title: 'Cost & P&L', group: 'Learn',
    intro: 'Tính chi phí content + lãi/lỗ.',
    steps: [
      'Đơn giá tùy chỉnh từng loại (caption/ảnh/video/template) + tỷ giá — sửa theo giá thật rồi "Lưu & tính lại".',
      'Bảng chi phí thực tế đếm theo usage thật. P&L: doanh thu (thanh toán đã nhận) − chi phí = lợi nhuận + biên %.',
    ],
  },
  {
    id: 'asset_dam', icon: '🗃️', title: 'Library', group: 'Library',
    intro: 'Kho tài nguyên gộp (ảnh AI + ảnh sản phẩm + upload). Quản lý + tái sử dụng.',
    steps: [
      'Lọc theo sản phẩm/trạng thái/nguồn/tag.',
      'Gom folder: bật "Chọn nhiều" → chọn ảnh → "Gom vào folder mới" / chuyển folder; hoặc kéo ảnh thả vào chip folder. Lọc theo folder bằng thanh chip.',
    ],
    tips: ['Dùng folder để gom 1 bộ ảnh rời rạc thành nhóm mạch lạc (vd theo buổi chụp).'],
  },
  {
    id: 'content_log', icon: '📜', title: 'Content Log', group: 'Library',
    intro: 'Nhật ký nội dung đã sản xuất/đăng.',
    steps: ['Xem lịch sử content theo brand/sản phẩm/trạng thái.'],
  },
  {
    id: 'job_queue', icon: '⏳', title: 'Job Queue', group: 'Library',
    intro: 'Hàng đợi job sinh ảnh (gpt-image-2).',
    steps: ['Theo dõi trạng thái pending/running/done/failed của các job ảnh.'],
  },
  {
    id: 'payment', icon: '💳', title: 'Billing', group: 'System',
    intro: 'Gói dịch vụ + thanh toán (Casso bank + MoMo).',
    steps: ['Chọn gói (setup 1 lần / subscription tháng), thanh toán chuyển khoản — webhook tự fulfill.'],
  },
  {
    id: 'team', icon: '👥', title: 'Team & Access', group: 'System',
    intro: 'Quản lý người dùng + phân quyền (admin only).',
    steps: [
      'Vai trò: root_admin/admin (toàn quyền), viewer (chỉ đọc — mọi thao tác ghi bị chặn 403).',
      'Gán brand cho user: user thường chỉ thấy brand được gán; admin thấy hết.',
    ],
  },
  {
    id: 'brands', icon: '🏢', title: 'Quản lý Brand', group: 'System',
    intro: 'Tạo và chuyển đổi giữa các brand (đa thương hiệu). Mỗi brand có dữ liệu tách biệt: DNA, sản phẩm, kế hoạch, kênh, metrics.',
    steps: [
      'Bấm "+ Thêm brand" để tạo brand mới (đặt tên + mã định danh).',
      'Chọn brand để chuyển ngữ cảnh — toàn bộ app (sidebar, dữ liệu) đổi theo brand đang chọn.',
      'Sau khi tạo brand: vào Brand DNA → Products → Channels để thiết lập đầy đủ.',
    ],
    tips: ['User thường chỉ thấy brand được admin gán; admin thấy tất cả brand.'],
  },
  {
    id: 'pipeline', icon: '🔄', title: 'Quy trình vận hành hàng ngày', group: 'Bắt đầu',
    intro: 'Luồng làm việc đề xuất mỗi ngày.',
    steps: [
      'Sáng: mở Dashboard → xử lý banner đỏ (token, scheduler, bài lỗi).',
      'Plan & Lịch → Run các item đến hạn (bật template rotate) → Duyệt.',
      'Tạo Content (CreateLab) cho bài ad-hoc → preview → thêm vào lịch.',
      'Review & Queue → đăng / hẹn giờ. Scheduler tự đăng bài đến hạn.',
      'Cuối tuần: Scoreboard + tag-performance + Cost/P&L để quyết định nhân bản combo thắng.',
    ],
  },
];

export const GROUPS = ['Bắt đầu', 'Home', 'Brain', 'Plan', 'Create', 'Publish', 'Engage', 'Learn', 'Library', 'System'];

export const getGuide = (id: string): Guide | undefined => GUIDES.find(g => g.id === id);

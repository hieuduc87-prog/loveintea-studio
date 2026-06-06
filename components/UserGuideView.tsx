'use client';

import { useState } from 'react';

type Section = 'overview' | 'strategy' | 'plan' | 'create' | 'publish' | 'measure' | 'library' | 'workflow';

const SECTIONS: { id: Section; icon: string; label: string }[] = [
  { id: 'overview',  icon: '🏠', label: 'Tổng quan hệ thống' },
  { id: 'strategy',  icon: '🌿', label: 'Strategy — Brand & Products' },
  { id: 'plan',      icon: '📋', label: 'Plan — Lập kế hoạch nội dung' },
  { id: 'create',    icon: '✍️', label: 'Create — Tạo nội dung' },
  { id: 'publish',   icon: '📡', label: 'Publish — Đăng bài & Quản lý' },
  { id: 'measure',   icon: '📊', label: 'Measure — Phân tích hiệu quả' },
  { id: 'library',   icon: '🗃️', label: 'Library — Kho tài nguyên' },
  { id: 'workflow',  icon: '🔄', label: 'Quy trình vận hành hàng ngày' },
];

export function UserGuideView() {
  const [active, setActive] = useState<Section>('overview');

  return (
    <div className="flex h-full">
      {/* Sidebar TOC */}
      <div className="w-56 flex-shrink-0 border-r border-gray-800 bg-gray-900/30 overflow-y-auto">
        <div className="px-3 py-4">
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 px-2">Hướng dẫn sử dụng</p>
          <div className="space-y-0.5">
            {SECTIONS.map(s => (
              <button key={s.id} onClick={() => setActive(s.id)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors text-left ${
                  active === s.id
                    ? 'bg-brand-600/20 text-white font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}>
                <span className="text-sm">{s.icon}</span>
                <span className="truncate">{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl">
        {active === 'overview' && <OverviewSection />}
        {active === 'strategy' && <StrategySection />}
        {active === 'plan' && <PlanSection />}
        {active === 'create' && <CreateSection />}
        {active === 'publish' && <PublishSection />}
        {active === 'measure' && <MeasureSection />}
        {active === 'library' && <LibrarySection />}
        {active === 'workflow' && <WorkflowSection />}
      </div>
    </div>
  );
}

/* ── Reusable elements ─────────────────────────────────────────── */
function H1({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-bold text-white mb-4">{children}</h2>;
}
function H2({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-bold text-white mt-6 mb-2">{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-300 leading-relaxed mb-3">{children}</p>;
}
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-brand-600/10 border border-brand-600/30 rounded-lg px-3 py-2.5 mb-3">
      <p className="text-xs text-brand-300 leading-relaxed">{children}</p>
    </div>
  );
}
function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 mb-3">
      <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{n}</span>
      <div className="text-sm text-gray-300 leading-relaxed pt-0.5">{children}</div>
    </div>
  );
}
function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 mb-1">
      <span className="text-xs text-gray-500 w-32 flex-shrink-0">{label}</span>
      <span className="text-xs text-gray-300">{value}</span>
    </div>
  );
}

/* ── Sections ──────────────────────────────────────────────────── */

function OverviewSection() {
  return (
    <>
      <H1>🏠 Tổng quan LoveinTea Marketing Studio</H1>
      <P>
        LoveinTea Studio là hệ thống quản lý marketing toàn diện, từ chiến lược thương hiệu → lập kế hoạch → sản xuất nội dung → đăng bài → đo lường hiệu quả. Hệ thống được thiết kế theo mô hình vòng lặp khép kín (closed-loop):
      </P>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
        <p className="text-center text-sm text-gray-300 font-mono leading-loose">
          Strategy → Plan → Create → Publish → Measure → Learn → Strategy
        </p>
      </div>

      <H2>Cấu trúc hệ thống</H2>
      <P>Hệ thống gồm 6 nhóm chức năng, mỗi nhóm tương ứng với 1 giai đoạn trong quy trình marketing:</P>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { icon: '🌿', group: 'Strategy', desc: 'Brand DNA, Products — Nền tảng thương hiệu & sản phẩm' },
          { icon: '📋', group: 'Plan', desc: 'Content Plans, Calendar, Schedule — Lập kế hoạch & lịch đăng bài' },
          { icon: '✍️', group: 'Create', desc: 'Content Workshop, Image Studio, Blog — Sản xuất nội dung' },
          { icon: '📡', group: 'Publish', desc: 'Queue, Channels, Jobs — Đăng bài & theo dõi' },
          { icon: '📊', group: 'Measure', desc: 'Analytics — Đo lường hiệu quả từng bài & tổng thể' },
          { icon: '🗃️', group: 'Library', desc: 'Image Library, Inbox — Kho ảnh & tin nhắn' },
        ].map(g => (
          <div key={g.group} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
            <p className="text-sm font-medium text-white mb-1">{g.icon} {g.group}</p>
            <p className="text-xs text-gray-400">{g.desc}</p>
          </div>
        ))}
      </div>

      <H2>Sản phẩm (6 SKU)</H2>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { name: 'Dandelion', color: '#F4A020', moment: 'Sáng' },
          { name: 'Ginger', color: '#A8B525', moment: 'Sáng' },
          { name: 'Hibiscus', color: '#5B8C3E', moment: 'Chiều' },
          { name: 'Lemon Balm', color: '#8BBF5C', moment: 'Tối' },
          { name: 'Peppermint', color: '#5BBCD2', moment: 'Chiều' },
          { name: 'Nighty Night', color: '#3F3D99', moment: 'Tối' },
        ].map(s => (
          <div key={s.name} className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg p-2.5">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
            <div>
              <p className="text-xs text-white font-medium">{s.name}</p>
              <p className="text-[10px] text-gray-500">{s.moment}</p>
            </div>
          </div>
        ))}
      </div>

      <Tip>
        Mỗi SKU có màu riêng (color dot) — nhất quán xuyên suốt hệ thống để dễ nhận biết khi xem calendar, schedule, plan.
      </Tip>
    </>
  );
}

function StrategySection() {
  return (
    <>
      <H1>🌿 Strategy — Brand DNA & Products</H1>

      <H2>Brand DNA</H2>
      <P>
        Tab Brand DNA hiển thị toàn bộ thông tin nền tảng thương hiệu: tagline, archetype, through-line, màu sắc, typography, tone of voice, compliance gate (từ cấm/bắt buộc), và hashtags.
      </P>
      <P>
        Đây là nguồn tham chiếu cho tất cả nội dung được tạo ra. AI engine (O3) sẽ tự động tuân theo các quy tắc này khi viết caption.
      </P>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 mb-4 space-y-1">
        <KeyValue label="Tagline" value="Timeless Remedies" />
        <KeyValue label="Archetype" value="The Joyful Healer" />
        <KeyValue label="Through-line" value="Vietnam's timeless herbal remedies, made simple for your everyday calm" />
        <KeyValue label="Tone" value="Warmly Wise · Cheerfully Simple · Proudly Vietnamese" />
      </div>

      <H2>Brand Voice Upload</H2>
      <P>
        Upload file brand voice (.txt, .md, .docx) — nội dung được lưu vào hệ thống, AI sẽ tham khảo khi viết content.
      </P>

      <H2>Products</H2>
      <P>
        Tab Products quản lý 6 sản phẩm trà. Mỗi sản phẩm hiển thị: tên, theme, màu, thành phần, use cases, pitch.
      </P>
      <P>
        Nhấn vào sản phẩm để xem chi tiết và quản lý <strong className="text-white">Product Photography</strong> — upload ảnh gốc chụp sản phẩm (packshot, lifestyle, macro, flat-lay, ingredient). Ảnh này dùng cho Image Studio (edit mode).
      </P>

      <Tip>
        Upload ảnh sản phẩm chất lượng cao ở đây. Image Studio sẽ dùng ảnh gốc này + GPT-image-2 edit mode để tạo ảnh marketing.
      </Tip>
    </>
  );
}

function PlanSection() {
  return (
    <>
      <H1>📋 Plan — Lập kế hoạch nội dung</H1>
      <P>
        Nhóm Plan gồm 3 tab liên kết chặt chẽ: Content Plans → Post Calendar → Schedule.
      </P>

      <H2>📋 Content Plans — Quản lý kế hoạch</H2>
      <P>
        Đây là trung tâm quản lý kế hoạch nội dung. Mỗi lần upload file Excel (.xlsx) sẽ tạo ra 1 plan mới.
      </P>

      <Step n={1}>Nhấn <strong className="text-white">Upload Plan (.xlsx)</strong> hoặc kéo thả file vào.</Step>
      <Step n={2}>Hệ thống đọc 3 sheet: Content Plan (danh sách bài), Stories Rotation (lịch stories), Summary (tổng hợp).</Step>
      <Step n={3}>Tự động tạo posts (dạng draft) với ngày lên lịch từ plan.</Step>
      <Step n={4}>Plan hiển thị ở sidebar trái — nhấn vào để xem chi tiết: bảng plan, stories, summary.</Step>

      <Tip>
        Thanh tiến độ trên mỗi plan hiển thị: xanh = published, vàng = scheduled, xám = draft. Giúp theo dõi nhanh tiến độ thực thi.
      </Tip>

      <P>
        Cấu trúc file Excel:
      </P>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 mb-4 space-y-1 text-xs text-gray-400">
        <p><strong className="text-white">Sheet 1 — Content Plan:</strong> Date | Day | Wave | Surface | Purpose | Pillar | Segment | RTB | USP | SKU | Context | Hook | Copy Direction | Visual Direction | Hashtags</p>
        <p><strong className="text-white">Sheet 2 — Stories:</strong> Daily rotation (Mon-Sun themes) + Highlights storefront</p>
        <p><strong className="text-white">Sheet 3 — Summary:</strong> Purpose mix, format mix, context split, balance check</p>
      </div>

      <H2>🗓️ Post Calendar — Lịch đăng bài</H2>
      <P>
        Hiển thị tất cả bài viết trên lịch tháng. Mỗi bài = 1 thanh nhỏ với color dot SKU + thời gian.
      </P>
      <P>
        <strong className="text-white">Plan Items (Blueprint):</strong> Nhấn nút <strong className="text-white">📋 Plan</strong> ở góc trên phải để bật/tắt hiển thị plan item từ Content Plans. Plan item hiện trên calendar như các ô màu xanh nhạt — là "bản thiết kế" cho bài viết chưa sản xuất (wave, surface, hook, product). Nhấn vào để xem brief chi tiết.
      </P>
      <P>
        <strong className="text-white">Filter by plan:</strong> Dropdown ở góc phải cho phép lọc theo plan hoặc xem tất cả.
      </P>

      <H2>📅 Schedule — Timeline & Publish</H2>
      <P>
        Hiển thị danh sách bài theo timeline (Today → Tomorrow → tuần này → ...). Nhấn vào bài để xem chi tiết, chọn platform (Facebook/Instagram), đặt thời gian, và publish.
      </P>
      <P>
        Có 3 hành động cho mỗi bài:
      </P>
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs bg-brand-600 text-white px-2 py-1 rounded-lg">📡 Post Now</span>
          <span className="text-xs text-gray-400">Đăng ngay lập tức</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-yellow-600 text-white px-2 py-1 rounded-lg">🗓️ Schedule</span>
          <span className="text-xs text-gray-400">Hẹn giờ đăng trên Facebook</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-gray-700 text-white px-2 py-1 rounded-lg">💾 Save time</span>
          <span className="text-xs text-gray-400">Lưu thời gian lên lịch (chưa đăng)</span>
        </div>
      </div>
    </>
  );
}

function CreateSection() {
  return (
    <>
      <H1>✍️ Create — Sản xuất nội dung</H1>

      <H2>✍️ Content Workshop — Trung tâm tạo nội dung</H2>
      <P>
        Đây là công cụ chính để tạo caption + ảnh marketing. Sử dụng O3 Content Framework với 7 biến:
      </P>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 mb-4">
        <div className="grid grid-cols-2 gap-1 text-xs">
          <div className="text-gray-400"><strong className="text-white">SKU</strong> — Sản phẩm (1 trong 6 loại trà)</div>
          <div className="text-gray-400"><strong className="text-white">Segment</strong> — Đối tượng (S1-S5)</div>
          <div className="text-gray-400"><strong className="text-white">RTB</strong> — Reason to Buy (lý do mua)</div>
          <div className="text-gray-400"><strong className="text-white">USP</strong> — Điểm khác biệt (pyramid bag, organic...)</div>
          <div className="text-gray-400"><strong className="text-white">Narrative</strong> — Cách kể (POV, Before-After, Tutorial...)</div>
          <div className="text-gray-400"><strong className="text-white">Context</strong> — Bối cảnh (sofa tối, bàn WFH, bếp...)</div>
          <div className="text-gray-400"><strong className="text-white">CTA</strong> — Kêu gọi hành động</div>
        </div>
      </div>

      <P><strong className="text-white">Single mode:</strong> Chọn từng biến → Generate → AI viết caption + tạo prompt ảnh → GPT-image-2 tạo ảnh → lưu vào Queue.</P>
      <P><strong className="text-white">Batch mode:</strong> Chọn nhiều SKU × nhiều biến → hệ thống tạo hàng loạt bài cùng lúc.</P>
      <P><strong className="text-white">Auto-post:</strong> Tick checkbox "Auto-post to Facebook" → sau khi tạo xong, tự động đăng lên Facebook.</P>

      <Tip>
        Variable Layer: chọn "SKU-first" để các biến segment/RTB/USP tự sắp xếp theo độ phù hợp với SKU đã chọn. Tiết kiệm thời gian khi tạo nội dung cho 1 sản phẩm cụ thể.
      </Tip>

      <H2>🖼️ Image Studio — Tạo ảnh AI</H2>
      <P>
        Tạo ảnh marketing bằng GPT-image-2 với 2 chế độ:
      </P>
      <div className="space-y-2 mb-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <p className="text-xs font-medium text-white mb-1">Edit Mode (khuyên dùng)</p>
          <p className="text-xs text-gray-400">Dùng ảnh sản phẩm gốc (từ tab Products) làm base → AI chỉnh sửa theo prompt. Giữ nguyên hình ảnh sản phẩm thật, chỉ thay đổi bối cảnh/style.</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <p className="text-xs font-medium text-white mb-1">Generate Mode</p>
          <p className="text-xs text-gray-400">Tạo ảnh hoàn toàn mới từ prompt text. Dùng khi cần ảnh concept/mood không cần hình sản phẩm thật.</p>
        </div>
      </div>

      <H2>📝 Blog Factory — Tạo bài blog</H2>
      <P>
        Viết bài blog SEO cho website. Chọn SKU focus, nhập topic → AI viết bài dài với SEO title, slug, excerpt, content. Lưu vào hệ thống để publish sau.
      </P>
    </>
  );
}

function PublishSection() {
  return (
    <>
      <H1>📡 Publish — Đăng bài & Quản lý</H1>

      <H2>📋 Queue — Hàng đợi nội dung</H2>
      <P>
        Tất cả bài viết được tạo nằm ở đây (draft/scheduled/published). Xem, chỉnh sửa caption, xóa, publish từng bài. Mỗi bài hiện SKU color dot, trạng thái, caption preview, ảnh.
      </P>

      <H2>📡 Channels — Kênh đăng bài</H2>
      <P>
        Quản lý kết nối Facebook Page & Instagram Business. Nhập Page ID + Access Token → kiểm tra kết nối → lưu. Đây là nơi cấu hình để hệ thống có quyền đăng bài lên các nền tảng.
      </P>
      <Tip>
        Cần tạo Facebook System User Token (không hết hạn) trong Business Settings. Token phải có quyền: pages_manage_posts, pages_read_engagement, instagram_basic, instagram_content_publish.
      </Tip>

      <H2>⏳ Job Queue — Theo dõi tạo ảnh</H2>
      <P>
        Hiển thị danh sách các job tạo ảnh GPT-image-2 đang chạy, hoàn thành, hoặc lỗi. Mỗi job có: trạng thái, prompt, thời gian, SKU, kết quả.
      </P>
      <P>
        Auto-refresh mỗi 5 giây khi có job đang chạy.
      </P>
    </>
  );
}

function MeasureSection() {
  return (
    <>
      <H1>📊 Measure — Phân tích hiệu quả</H1>
      <P>
        Tab Analytics gồm 3 sub-tab:
      </P>

      <H2>Overview — Tổng quan</H2>
      <P>
        Thống kê tổng: số bài đã publish, ảnh đã tạo, draft chưa dùng, blogs đã viết.
      </P>

      <H2>Per Post (FB) — Hiệu quả từng bài</H2>
      <P>
        Kéo dữ liệu từ Facebook Graph API cho từng bài đã publish. Hiển thị:
      </P>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 mb-4 space-y-1">
        <KeyValue label="Reach" value="Số người nhìn thấy bài" />
        <KeyValue label="Impressions" value="Tổng lượt hiển thị" />
        <KeyValue label="Engaged" value="Số người tương tác" />
        <KeyValue label="Reactions" value="Like, love, haha, wow..." />
        <KeyValue label="Comments" value="Số bình luận" />
        <KeyValue label="Shares" value="Số lượt chia sẻ" />
      </div>

      <P>
        <strong className="text-white">Rolling windows:</strong> Chọn khoảng thời gian 3/7/14/30 ngày để xem tổng hợp. So sánh hiệu quả giữa các giai đoạn.
      </P>

      <H2>Instagram — Thống kê IG</H2>
      <P>
        Số liệu tài khoản Instagram Business: followers, reach, impressions, profile views, website clicks.
      </P>
    </>
  );
}

function LibrarySection() {
  return (
    <>
      <H1>🗃️ Library — Kho tài nguyên</H1>

      <H2>🗃️ Image Library — Kho ảnh</H2>
      <P>
        Tất cả ảnh AI đã tạo được lưu ở đây. Có thể:
      </P>
      <div className="space-y-1 mb-4">
        <P>• Tìm kiếm theo SKU, prompt, tags</P>
        <P>• Đánh dấu ★ yêu thích</P>
        <P>• Xem ảnh full-size trong lightbox</P>
        <P>• Download ảnh gốc</P>
        <P>• Upload ảnh thủ công (từ bên ngoài)</P>
      </div>

      <H2>💬 Inbox — Tin nhắn & Bình luận</H2>
      <P>
        Tập trung tin nhắn Facebook & Instagram về 1 nơi:
      </P>
      <div className="space-y-1 mb-4">
        <P>• <strong className="text-white">Messages</strong> — Tin nhắn Messenger/IG DM</P>
        <P>• <strong className="text-white">Comments</strong> — Bình luận trên bài viết</P>
        <P>• <strong className="text-white">Feed</strong> — Bài viết mới nhất trên page</P>
      </div>
      <P>
        Nhấn Sync để kéo dữ liệu mới từ Facebook/Instagram API.
      </P>
    </>
  );
}

function WorkflowSection() {
  return (
    <>
      <H1>🔄 Quy trình vận hành hàng ngày</H1>
      <P>
        Dưới đây là quy trình đề xuất để vận hành marketing hàng ngày với LoveinTea Studio:
      </P>

      <H2>Bước 1: Lập kế hoạch (1 lần/tháng)</H2>
      <Step n={1}>Chuẩn bị file Excel content plan theo template (3 sheets).</Step>
      <Step n={2}>Vào <strong className="text-white">Content Plans</strong> → Upload file → Review plan items, stories rotation, summary.</Step>
      <Step n={3}>Vào <strong className="text-white">Post Calendar</strong> → Kiểm tra lịch đăng bài trên calendar. Drag-drop để điều chỉnh ngày nếu cần.</Step>

      <H2>Bước 2: Sản xuất nội dung (hàng ngày/hàng tuần)</H2>
      <Step n={1}>Vào <strong className="text-white">Content Workshop</strong> → Chọn SKU + biến theo plan → Generate.</Step>
      <Step n={2}>AI tự viết caption + tạo prompt ảnh + gọi GPT-image-2 tạo ảnh.</Step>
      <Step n={3}>Bài tự động lưu vào Queue. Nếu tick "Auto-post" → đăng luôn lên FB.</Step>

      <H2>Bước 3: Đăng bài (hàng ngày)</H2>
      <Step n={1}>Vào <strong className="text-white">Schedule</strong> → Xem danh sách bài hôm nay.</Step>
      <Step n={2}>Chọn bài → Chọn platform (FB/IG) → Post Now hoặc Schedule.</Step>
      <Step n={3}>Kiểm tra trạng thái: ✅ Published hiện FB/IG Post ID.</Step>

      <H2>Bước 4: Theo dõi hiệu quả (hàng tuần)</H2>
      <Step n={1}>Vào <strong className="text-white">Analytics → Per Post</strong> → Xem reach, engagement, comments, shares từng bài.</Step>
      <Step n={2}>So sánh rolling windows 3/7/14/30 ngày để phát hiện xu hướng.</Step>
      <Step n={3}>Rút kinh nghiệm: SKU nào, context nào, narrative nào hiệu quả nhất → điều chỉnh plan tháng sau.</Step>

      <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Mẹo vận hành</p>
        <div className="space-y-2 text-xs text-gray-300">
          <p>• <strong className="text-white">Upload ảnh sản phẩm trước</strong> (tab Products) — Image Studio edit mode cần ảnh gốc để tạo ảnh đẹp hơn.</p>
          <p>• <strong className="text-white">Dùng SKU-first variable layer</strong> — giúp chọn biến phù hợp nhất cho từng sản phẩm.</p>
          <p>• <strong className="text-white">Batch mode cho hiệu suất</strong> — chọn 3 SKU × 3 context → tạo 9 bài cùng lúc.</p>
          <p>• <strong className="text-white">Drag-drop trên Calendar</strong> — nhanh hơn việc chỉnh thời gian thủ công.</p>
          <p>• <strong className="text-white">Filter by plan</strong> — khi có nhiều plan, dùng dropdown filter ở Calendar và Schedule để xem theo plan.</p>
          <p>• <strong className="text-white">Check Analytics weekly</strong> — data giúp hiểu audience thích nội dung gì, từ đó tối ưu plan.</p>
        </div>
      </div>
    </>
  );
}

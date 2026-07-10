'use client';

import { useState } from 'react';

/**
 * Hướng dẫn sử dụng — trang sáng/sạch, theo đúng luồng công việc, dễ đọc dễ làm.
 * Đặt nổi bật ở đầu sidebar (group "Bắt đầu") để user thấy ngay sau khi đăng nhập.
 */

interface Section {
  id: string; icon: string; kicker?: string; title: string; intro: string;
  steps?: string[]; tip?: string; warn?: string; mock?: 'sidebar' | 'create' | 'overlay' | 'calendar';
}

const SECTIONS: Section[] = [
  {
    id: 'welcome', icon: '👋', title: 'Chào mừng đến Easy Creative Hub',
    intro: 'Đây là hệ điều hành marketing chạy bằng AI cho thương hiệu của bạn. Toàn bộ quy trình gói trong một chỗ: Chiến lược → Nội dung → Đăng bài → Đo lường → Học hỏi. Bạn nạp "chất" thương hiệu một lần, AI lo phần còn lại; bạn chỉ duyệt.',
    steps: [
      'Mỗi thương hiệu là một không gian RIÊNG BIỆT — dữ liệu, người dùng, kênh của bạn không lẫn với ai.',
      'Đi theo thứ tự 7 bước bên trái là mượt nhất: DNA → Sản phẩm → Tạo nội dung → Đăng → Đo lường.',
      'Bí kíp: điền càng kỹ ở Bước 1–2, nội dung AI tạo ra càng đúng chất thương hiệu.',
    ],
    tip: 'Mỗi màn hình đều có nút ❓ ở góc trên — bấm để xem hướng dẫn nhanh của đúng màn hình đó.',
  },
  {
    id: 'login', icon: '🔑', kicker: 'Bắt đầu', title: 'Đăng nhập & tài khoản',
    intro: 'Truy cập tại app.easycreativehub.com. Có 2 cách đăng nhập.',
    steps: [
      'Cách 1 — Email + mật khẩu: dùng email và mật khẩu quản trị viên đã cấp cho bạn.',
      'Cách 2 — Google: bấm "Continue with Google" nếu tài khoản của bạn dùng Google.',
      'Lần đầu vào, nên đổi mật khẩu: mở app.easycreativehub.com/change-password và đặt mật khẩu riêng.',
    ],
    warn: 'Nếu báo "chờ duyệt" — nghĩa là tài khoản chưa được gán vào thương hiệu. Liên hệ quản trị viên để được cấp quyền.',
  },
  {
    id: 'brand_dna', icon: '🌿', kicker: 'Bước 1', title: 'Thiết lập Brand DNA (bộ não thương hiệu)',
    intro: 'DNA là "chất" thương hiệu — giọng nói, màu sắc, đối tượng, insight, và những điều KHÔNG được nói. Mọi nội dung AI tạo ra đều bám theo đây.',
    mock: 'sidebar',
    steps: [
      'Vào tab 🌿 Brand DNA.',
      'Cách nhanh: bấm "📄 Nhập từ file khách gửi" và tải tài liệu (playbook, brief, guideline — .xlsx/.docx/.pdf). AI tự trích xuất chiến lược, đối tượng, giọng điệu.',
      'Hoặc bấm "✨ Tổng hợp từ tài liệu đã có" nếu đã có tài liệu trong hệ thống.',
      'Xem lại 4 ô (Đối tượng · Insight · Hành vi · Luật thương hiệu), chỉnh nếu cần rồi bấm Lưu.',
      'Sub-tab Knowledge & Rules: thêm tri thức chuyên gia / luật compliance để AI tránh nói sai.',
    ],
    tip: 'Điền kỹ mục "Đối tượng & Chiến lược" — đây là thứ được nhồi vào MỌI prompt tạo caption/ảnh/video.',
  },
  {
    id: 'products', icon: '📦', kicker: 'Bước 2', title: 'Thêm sản phẩm & ảnh',
    intro: 'Hồ sơ + kho ảnh của từng sản phẩm. AI dùng ảnh sản phẩm làm gốc để tạo ảnh quảng cáo (giữ nguyên bao bì).',
    steps: [
      'Vào tab 📦 Products → "Thêm sản phẩm", điền tên/mô tả/thành phần.',
      'Mở sản phẩm → mục "📦 Ảnh & Video" → tải ảnh sản phẩm (ưu tiên ảnh nền trắng, chụp thẳng — packshot).',
      'Gắn nhãn loại ảnh (packshot / lifestyle / macro…) để hệ thống chọn đúng ảnh khi tạo content.',
      'Mục "📋 Brief & Knowledge": tải tài liệu sản phẩm → AI tự điền 12 trường thông tin.',
    ],
    tip: 'Có ảnh sản phẩm nền trắng chụp thẳng thì ảnh quảng cáo AI tạo ra đẹp & giữ đúng bao bì nhất.',
  },
  {
    id: 'create', icon: '✨', kicker: 'Bước 3', title: 'Tạo nội dung (Create Studio)',
    intro: 'Sinh caption + ảnh quảng cáo AI bám đúng thương hiệu & sản phẩm, chỉ trong vài giây.',
    mock: 'create',
    steps: [
      'Vào tab ✨ Tạo Content.',
      'Chọn sản phẩm, chọn ngôn ngữ (🇬🇧 EN mặc định / 🇻🇳 VI) và độ dài.',
      'Bấm để sinh caption + hashtag. Muốn ảnh: bấm "Tạo ảnh" — AI dựng ảnh từ ảnh sản phẩm + template, chân thật như ảnh chụp.',
      'Ưng thì lưu thành bài nháp; bài sẽ vào Review & Queue để duyệt/đăng.',
    ],
    tip: 'Ảnh tạo ở chế độ chất lượng cao (photoreal) — da/vải/ánh sáng như ảnh thật, không bị "giả AI".',
  },
  {
    id: 'text_overlay', icon: '🔤', kicker: 'Bước 4', title: 'Chữ lên ảnh (bài dạng typography)',
    intro: 'Phủ tiêu đề / khẩu hiệu / khuyến mãi lên ảnh sản phẩm — chữ nét, đúng dấu tiếng Việt (không để AI vẽ chữ méo).',
    mock: 'overlay',
    steps: [
      'Vào tab 🔤 Chữ lên ảnh.',
      'Bước 1: chọn KIỂU (5 layout: Headline đáy · Banner đỉnh · Trích dẫn giữa · Liệt kê lợi ích · Khuyến mãi).',
      'Bước 2: chọn ẢNH NỀN từ kho ảnh bài/sản phẩm của bạn (hoặc dán link ảnh).',
      'Bước 3: nhập chữ (tiêu đề, phụ đề, CTA, badge). Bấm "Tạo ảnh có chữ".',
      'Xem kết quả bên phải → bấm ⬇ Tải ảnh, hoặc dùng làm ảnh cho bài đăng.',
    ],
    tip: 'Kiểu "Liệt kê lợi ích": gõ các lợi ích ngăn nhau bằng dấu | (vd: Ngủ ngon | Thư giãn | 0 calo).',
  },
  {
    id: 'video_studio', icon: '🎬', kicker: 'Video AI', title: 'Video Studio — video ngắn + Lịch tự động',
    intro: 'Từ ảnh sản phẩm + clip quay sẵn, AI dựng video Reels 9:16 hoàn chỉnh: kịch bản, cắt cảnh theo beat nhạc, chữ trên video, lồng tiếng. Đặt Lịch định kỳ một lần — hệ thống tự sản xuất video đều đặn.',
    steps: [
      'Upload clip quay sản phẩm/quán vào Kho clip (AI tự gắn tag cảnh/mood). Không có clip cũng được — AI dùng ảnh sản phẩm + ảnh AI.',
      'Chọn mục đích, sản phẩm, thời lượng, nhạc nền (mp3 hoặc video — tự bóc nhạc), bật 🎙️ Lồng tiếng → "🧠 Tạo storyboard" → "▶ Render" (~3-8 phút).',
      '⏰ LỊCH ĐỊNH KỲ: bấm "+ Lịch mới" → chọn xoay vòng sản phẩm, chu kỳ (vd mỗi 3 ngày lúc 9h), kênh FB/IG → hệ thống TỰ dựng + render + tạo bài theo chu kỳ.',
      'Chế độ ra bài: "📝 Tạo bài nháp" (bạn duyệt ở Review & Queue rồi mới đăng — khuyên dùng) hoặc "⚡ Tự đăng ngay khi render xong".',
      'Muốn video đúc theo công thức viral: gắn Khuôn từ tab 🕵️ Nguồn học vào lịch.',
    ],
    tip: 'Video đầu tiên của lịch chạy trong ≤5 phút sau khi tạo — vào Video projects xem tiến độ, xong sẽ thấy bài mới trong Review & Queue.',
  },
  {
    id: 'inspiration', icon: '🕵️', kicker: 'Video AI', title: 'Nguồn học — học công thức viral của đối thủ',
    intro: 'Thấy video đối thủ viral? Dán link vào đây — AI xem toàn bộ video, bóc từng cảnh (nhịp cắt, góc máy, hook, cảm xúc) thành "khuôn" + bài học, rồi dựng video của BẠN theo đúng công thức thắng đó.',
    steps: [
      'Thêm "Trang đang theo dõi" (page/kênh đối thủ) để nhóm bài — tùy chọn.',
      'Dán link video công khai (IG Reels / FB / TikTok / YouTube) vào ô "Nạp bài để học" → hệ thống tự tải + AI phân tích vài phút. Dán kèm caption gốc để học cả công thức caption.',
      'Link private hoặc tải lỗi → dùng nút "📁 Upload file" (screen record cũng được).',
      'Xem "📖 bài học" (vì sao viral: hook, pacing, CTA) trong Thư viện đã học.',
      'Bấm "🎬 Tạo video theo khuôn này" — AI giữ cấu trúc thắng (số cảnh, nhịp, góc máy), thay toàn bộ nội dung bằng sản phẩm/brand của bạn. Hoặc gắn khuôn vào Lịch định kỳ.',
    ],
    tip: 'Khuôn chỉ học CẤU TRÚC, không sao chép chữ/hình của đối thủ — an toàn bản quyền. Chọn video 15-40s có cấu trúc rõ để khuôn đẹp nhất.',
  },
  {
    id: 'plan', icon: '🗓️', kicker: 'Bước 5', title: 'Plan & Lịch — lên kế hoạch & duyệt',
    intro: 'Nơi lập kế hoạch nội dung cả tháng, sinh bài hàng loạt, kéo-thả lên lịch và duyệt.',
    mock: 'calendar',
    steps: [
      'Vào tab 🗓️ Plan & Lịch. Toggle giữa xem Lịch | Bảng.',
      'Có sẵn kế hoạch từ file Excel? Import để nạp cả tháng một lần.',
      '"Run All" / "Run step": AI sinh caption + ảnh cho từng mục theo kế hoạch (bám DNA + luật + template thắng).',
      'Duyệt: tick từng dòng hoặc "Duyệt tất cả". Kéo bài nháp vào ngày trống để xếp lịch.',
      'Bài đã đăng bị KHOÁ (🔒) — không kéo/đổi lịch được, tránh sửa nhầm.',
    ],
    tip: 'Bật "dùng template (rotate)" khi sinh bài — hệ thống tự xoay các bộ template hiệu quả nhất.',
  },
  {
    id: 'publish', icon: '📡', kicker: 'Bước 6', title: 'Đăng bài (Channels & Publisher)',
    intro: 'Nối Facebook/Instagram của thương hiệu và đăng/hẹn giờ tự động.',
    steps: [
      'Vào tab 📡 Channels → FB Setup. Dán System User token trang của bạn (hoặc bấm Connect với Facebook).',
      'Ở Review & Queue: duyệt bài → đăng ngay hoặc hẹn giờ. Scheduler tự đăng đúng giờ vàng.',
      'Bài carousel nhiều ảnh, Facebook + Instagram — đều đăng được từ một chỗ.',
    ],
    warn: 'Store CHƯA nối kênh sẽ không đăng được (hệ thống chặn để không đăng nhầm sang trang khác). Nối kênh trước khi đăng.',
  },
  {
    id: 'analyze', icon: '📊', kicker: 'Bước 7', title: 'Đo lường & tối ưu',
    intro: 'Số liệu tự đổ về nuôi kế hoạch tiếp theo — càng chạy càng khôn.',
    steps: [
      'Dashboard 🏠: sức khỏe hệ thống + phễu nội dung (nháp/đã lịch/đã đăng) của thương hiệu bạn.',
      'Analytics 📊: reach, engagement, insight từng bài (cần bài đã đăng + đồng bộ metrics ~6h/lần).',
      'Scoreboard 🏆: hệ thống chấm SCALE / HOLD / RETIRE cho từng góc nội dung — nhân cái thắng, bỏ cái yếu.',
      'Cost & P&L 💰: chi phí AI + lãi/lỗ.',
    ],
    tip: 'Số liệu = 0 cho tới khi có bài đã đăng và metrics được đồng bộ — bình thường, cứ đăng đều là có.',
  },
  {
    id: 'admin', icon: '🛠️', kicker: 'Quản trị viên', title: 'Platform Console (chỉ admin)',
    intro: 'Nếu bạn là quản trị nền tảng: quản lý tất cả thương hiệu và người dùng ở một chỗ riêng.',
    steps: [
      'Bấm 🛰 Platform ở góc trên (chỉ admin thấy) hoặc vào admin.easycreativehub.com.',
      'Tab Stores: tạo store mới, xem số bài/sản phẩm/thành viên/trạng thái nối FB từng store.',
      'Chọn store → Mời khách bằng email → hệ thống cấp mật khẩu tạm (hiện 1 lần, có nút Copy) → gửi cho khách.',
      'Tab 👥 Tất cả người dùng: duyệt tài khoản mới, đổi vai trò, khoá.',
    ],
    tip: 'Tab "Team & Access" trong app chỉ hiện người dùng của ĐÚNG thương hiệu đang xem — không lẫn store khác.',
  },
];

const FAQ: { q: string; a: string }[] = [
  { q: 'Tôi quên/muốn đổi mật khẩu?', a: 'Vào app.easycreativehub.com/change-password (khi đã đăng nhập). Nếu quên hẳn, nhờ quản trị viên cấp lại mật khẩu tạm ở tab Team.' },
  { q: 'Vì sao chưa đăng được bài?', a: 'Store chưa nối Facebook/Instagram. Vào Channels → FB Setup để nối kênh trước.' },
  { q: 'Ảnh AI trông chưa thật?', a: 'Hệ thống đã bật chế độ ảnh chất lượng cao + chỉ đạo nhiếp ảnh chân thật. Nếu vẫn muốn khác, dùng "Chữ lên ảnh" hoặc chọn ảnh nền khác.' },
  { q: 'Tôi thấy dữ liệu của thương hiệu khác?', a: 'Không thể — mỗi thương hiệu cách ly tuyệt đối. Nếu bạn là admin và thấy nhiều store, dùng nút chọn thương hiệu ở đầu sidebar để chuyển.' },
  { q: 'Chi phí tạo ảnh?', a: 'Ảnh chất lượng cao khoảng 4.500đ/ảnh. Admin có thể xem chi tiết ở tab Cost & P&L.' },
  { q: 'Video định kỳ tạo xong nằm ở đâu?', a: 'Ở 2 chỗ: tab Video Studio → Video projects (file video, preview/tải về) và Review & Queue (bài đăng kèm video, chờ bạn duyệt — trừ khi lịch đặt chế độ ⚡ tự đăng).' },
  { q: 'Dán link video đối thủ báo lỗi tải?', a: 'Link private, bị chặn vùng, hoặc nền tảng chặn tải. Cách chắc chắn nhất: screen record video đó rồi dùng nút "📁 Upload file" trong tab Nguồn học — AI phân tích y hệt.' },
  { q: 'Video có tự đăng lên Instagram được không?', a: 'Có — hệ thống đăng dạng Reels (cần store đã nối IG ở Channels). Facebook đăng dạng video Page. Chọn kênh ngay khi tạo Lịch định kỳ.' },
];

function Mock({ kind }: { kind: NonNullable<Section['mock']> }) {
  const nav = (labels: string[], on = 0) => (
    <div className="ug-mk-side">{labels.map((l, i) => <div key={i} className={`ug-mk-nav ${i === on ? 'on' : ''}`}>{l}</div>)}</div>
  );
  return (
    <div className="ug-mock">
      <div className="ug-mk-bar"><i /><i /><i /><span>app.easycreativehub.com</span></div>
      {kind === 'sidebar' && (
        <div className="ug-mk-body">{nav(['🏠 Dashboard', '🌿 Brand DNA', '📦 Products', '✨ Tạo Content', '🔤 Chữ lên ảnh'], 1)}
          <div className="ug-mk-main"><div className="ug-mk-h" /><div className="ug-mk-row"><span className="ug-tag-a">📄 Nhập từ file</span><span className="ug-tag-b">✨ Tổng hợp</span></div><div className="ug-mk-block" /><div className="ug-mk-block" /></div></div>
      )}
      {kind === 'create' && (
        <div className="ug-mk-body">{nav(['✨ Tạo Content', '🔤 Chữ lên ảnh', '🎬 Video'], 0)}
          <div className="ug-mk-main"><div className="ug-mk-row"><span className="ug-pill">Sản phẩm ▾</span><span className="ug-pill">🇬🇧 EN</span></div><div className="ug-mk-cap" /><div className="ug-mk-row"><span className="ug-tag-a">✍️ Tạo caption</span><span className="ug-tag-b">🖼 Tạo ảnh</span></div></div></div>
      )}
      {kind === 'overlay' && (
        <div className="ug-mk-body"><div className="ug-mk-main2">
          <div><div className="ug-mk-lbl">1. Chọn kiểu</div><div className="ug-mk-grid"><span className="ug-cell on" /><span className="ug-cell" /><span className="ug-cell" /><span className="ug-cell" /></div><div className="ug-mk-lbl">3. Nhập chữ</div><div className="ug-mk-inp" /><div className="ug-mk-inp" /></div>
          <div className="ug-mk-preview"><div className="ug-mk-photo"><div className="ug-mk-scrim"><b>Tiêu đề lớn</b><span>Phụ đề</span></div></div></div>
        </div></div>
      )}
      {kind === 'calendar' && (
        <div className="ug-mk-body"><div className="ug-mk-main"><div className="ug-mk-row"><span className="ug-pill on">Lịch</span><span className="ug-pill">Bảng</span><span className="ug-tag-b" style={{ marginLeft: 'auto' }}>Run All</span></div>
          <div className="ug-mk-cal">{Array.from({ length: 14 }).map((_, i) => <span key={i} className={i % 5 === 2 ? 'has' : ''} />)}</div></div></div>
      )}
    </div>
  );
}

export function UserGuideView() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const go = (id: string) => document.getElementById(`ug-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="ug">
      <style>{UG_CSS}</style>
      <div className="ug-shell">
        {/* TOC */}
        <aside className="ug-toc">
          <div className="ug-toc-brand"><span className="ug-mark">⚡</span> Hướng dẫn</div>
          <nav>
            {SECTIONS.map(s => (
              <button key={s.id} onClick={() => go(s.id)} className="ug-toc-item">
                <span>{s.icon}</span>{s.kicker ? `${s.kicker}: ` : ''}{s.title.replace(/\s*\(.*\)/, '')}
              </button>
            ))}
            <button onClick={() => go('faq')} className="ug-toc-item"><span>❓</span>Câu hỏi thường gặp</button>
          </nav>
        </aside>

        {/* CONTENT */}
        <main className="ug-content">
          <header className="ug-hero">
            <div className="ug-hero-mark">⚡</div>
            <h1>Hướng dẫn sử dụng</h1>
            <p>Làm theo 7 bước bên dưới là bạn vận hành được thương hiệu như một studio chuyên nghiệp. Đọc một lần, làm được ngay.</p>
          </header>

          {SECTIONS.map((s, i) => (
            <section key={s.id} id={`ug-${s.id}`} className="ug-sec">
              <div className="ug-sec-head">
                <div className="ug-sec-icon">{s.icon}</div>
                <div>
                  {s.kicker && <div className="ug-kicker">{s.kicker}</div>}
                  <h2>{s.title}</h2>
                </div>
              </div>
              <p className="ug-intro">{s.intro}</p>
              {s.mock && <Mock kind={s.mock} />}
              {s.steps && (
                <ol className="ug-steps">
                  {s.steps.map((st, j) => <li key={j}><span className="ug-num">{j + 1}</span><span>{st}</span></li>)}
                </ol>
              )}
              {s.tip && <div className="ug-note ug-tip"><b>💡 Mẹo:</b> {s.tip}</div>}
              {s.warn && <div className="ug-note ug-warn"><b>⚠️ Lưu ý:</b> {s.warn}</div>}
              {i < SECTIONS.length - 1 && <div className="ug-div" />}
            </section>
          ))}

          {/* FAQ */}
          <section id="ug-faq" className="ug-sec">
            <div className="ug-sec-head"><div className="ug-sec-icon">❓</div><div><div className="ug-kicker">Hỗ trợ</div><h2>Câu hỏi thường gặp</h2></div></div>
            <div className="ug-faq">
              {FAQ.map((f, i) => (
                <div key={i} className={`ug-faq-item ${openFaq === i ? 'open' : ''}`}>
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)}><span>{f.q}</span><i>{openFaq === i ? '−' : '+'}</i></button>
                  {openFaq === i && <p>{f.a}</p>}
                </div>
              ))}
            </div>
          </section>

          <footer className="ug-foot">Easy Creative Hub · Cần hỗ trợ thêm? Liên hệ quản trị viên của bạn.</footer>
        </main>
      </div>
    </div>
  );
}

const UG_CSS = `
.ug { background:#f6f7f9; color:#1e2230; height:100%; overflow-y:auto; font-family:'Be Vietnam Pro',system-ui,sans-serif; }
.ug-shell { display:grid; grid-template-columns:250px 1fr; max-width:1120px; margin:0 auto; gap:0; }
.ug-toc { position:sticky; top:0; align-self:start; height:100vh; overflow-y:auto; padding:22px 14px; border-right:1px solid #e6e8ee; background:#fff; }
.ug-toc-brand { font-weight:800; font-size:15px; display:flex; align-items:center; gap:8px; margin-bottom:14px; color:#111; }
.ug-mark { width:26px; height:26px; border-radius:8px; display:grid; place-items:center; color:#fff; font-size:14px; background:linear-gradient(135deg,#8b5cf6,#22d3ee); }
.ug-toc nav { display:flex; flex-direction:column; gap:2px; }
.ug-toc-item { text-align:left; font-size:13px; color:#4a5060; padding:8px 10px; border-radius:8px; border:none; background:none; cursor:pointer; display:flex; gap:8px; align-items:center; line-height:1.3; }
.ug-toc-item:hover { background:#f2f0fb; color:#6d28d9; }
.ug-content { padding:0 26px 60px; min-width:0; }
.ug-hero { padding:40px 0 24px; }
.ug-hero-mark { width:54px; height:54px; border-radius:15px; display:grid; place-items:center; color:#fff; font-size:26px; background:linear-gradient(135deg,#8b5cf6,#22d3ee); box-shadow:0 10px 30px rgba(139,92,246,.35); margin-bottom:16px; }
.ug-hero h1 { font-size:34px; font-weight:900; letter-spacing:-.02em; }
.ug-hero p { margin-top:10px; color:#5a6070; font-size:16px; line-height:1.6; max-width:620px; }
.ug-sec { padding:26px 0; }
.ug-sec-head { display:flex; align-items:center; gap:14px; }
.ug-sec-icon { width:46px; height:46px; border-radius:13px; display:grid; place-items:center; font-size:23px; background:#fff; border:1px solid #e6e8ee; box-shadow:0 2px 10px rgba(30,34,48,.05); flex-shrink:0; }
.ug-kicker { font-size:11.5px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#8b5cf6; }
.ug-sec h2 { font-size:22px; font-weight:800; letter-spacing:-.01em; }
.ug-intro { margin-top:12px; color:#4a5060; font-size:15.5px; line-height:1.65; }
.ug-steps { margin-top:16px; display:flex; flex-direction:column; gap:10px; list-style:none; }
.ug-steps li { display:flex; gap:12px; align-items:flex-start; font-size:15px; line-height:1.55; color:#2b3040; }
.ug-num { flex-shrink:0; width:26px; height:26px; border-radius:50%; display:grid; place-items:center; font-size:13px; font-weight:800; color:#fff; background:linear-gradient(135deg,#8b5cf6,#7c3aed); }
.ug-note { margin-top:16px; border-radius:12px; padding:13px 16px; font-size:14px; line-height:1.55; }
.ug-tip { background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46; }
.ug-warn { background:#fffbeb; border:1px solid #fde68a; color:#92400e; }
.ug-div { margin-top:30px; height:1px; background:#e6e8ee; }
.ug-mock { margin-top:18px; border-radius:14px; overflow:hidden; border:1px solid #e2e5ec; background:#fbfbfd; box-shadow:0 8px 30px rgba(30,34,48,.07); max-width:560px; }
.ug-mk-bar { display:flex; align-items:center; gap:6px; padding:9px 12px; background:#f0f1f4; border-bottom:1px solid #e6e8ee; }
.ug-mk-bar i { width:9px; height:9px; border-radius:50%; background:#cfd3db; } .ug-mk-bar i:first-child{background:#ff5f57} .ug-mk-bar i:nth-child(2){background:#febc2e} .ug-mk-bar i:nth-child(3){background:#28c840}
.ug-mk-bar span { margin-left:8px; font-size:10.5px; color:#9aa0ad; font-family:monospace; }
.ug-mk-body { display:grid; grid-template-columns:130px 1fr; min-height:170px; }
.ug-mk-side { border-right:1px solid #eceef3; padding:10px 8px; display:flex; flex-direction:column; gap:3px; }
.ug-mk-nav { font-size:10.5px; color:#8890a0; padding:6px 8px; border-radius:7px; } .ug-mk-nav.on { background:#efeafe; color:#6d28d9; font-weight:700; }
.ug-mk-main { padding:14px; display:flex; flex-direction:column; gap:10px; }
.ug-mk-main2 { grid-column:1/-1; display:grid; grid-template-columns:1fr 150px; gap:14px; padding:14px; }
.ug-mk-h { height:16px; width:55%; border-radius:5px; background:#e4e7ee; }
.ug-mk-block { height:34px; border-radius:9px; background:#eef0f5; }
.ug-mk-cap { height:52px; border-radius:9px; background:#eef0f5; }
.ug-mk-row { display:flex; gap:8px; align-items:center; }
.ug-tag-a,.ug-tag-b,.ug-pill { font-size:10.5px; font-weight:700; padding:6px 12px; border-radius:8px; }
.ug-tag-a { background:#efeafe; color:#6d28d9; } .ug-tag-b { background:#8b5cf6; color:#fff; }
.ug-pill { background:#eef0f5; color:#6b7280; } .ug-pill.on { background:#111827; color:#fff; }
.ug-mk-lbl { font-size:10.5px; font-weight:700; color:#6b7280; margin-bottom:6px; }
.ug-mk-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:5px; margin-bottom:12px; }
.ug-cell { aspect-ratio:1; border-radius:7px; background:#eef0f5; } .ug-cell.on { background:#8b5cf6; }
.ug-mk-inp { height:24px; border-radius:6px; background:#eef0f5; margin-bottom:6px; }
.ug-mk-preview { display:grid; place-items:center; }
.ug-mk-photo { width:130px; aspect-ratio:4/5; border-radius:10px; background:linear-gradient(135deg,#a7d0a0,#7fae7a); position:relative; overflow:hidden; }
.ug-mk-scrim { position:absolute; inset:0; display:flex; flex-direction:column; justify-content:flex-end; padding:10px; background:linear-gradient(transparent,rgba(0,0,0,.6)); color:#fff; }
.ug-mk-scrim b { font-size:12px; } .ug-mk-scrim span { font-size:9px; opacity:.9; }
.ug-mk-cal { display:grid; grid-template-columns:repeat(7,1fr); gap:5px; } .ug-mk-cal span { aspect-ratio:1; border-radius:6px; background:#eef0f5; } .ug-mk-cal span.has { background:#c4b5fd; }
.ug-faq { margin-top:14px; display:flex; flex-direction:column; gap:8px; }
.ug-faq-item { border:1px solid #e6e8ee; border-radius:12px; background:#fff; overflow:hidden; }
.ug-faq-item button { width:100%; display:flex; justify-content:space-between; align-items:center; padding:14px 16px; background:none; border:none; cursor:pointer; font-size:15px; font-weight:600; color:#1e2230; text-align:left; }
.ug-faq-item i { font-style:normal; font-size:20px; color:#8b5cf6; font-weight:700; }
.ug-faq-item p { padding:0 16px 14px; color:#5a6070; font-size:14.5px; line-height:1.6; }
.ug-foot { margin-top:40px; padding-top:20px; border-top:1px solid #e6e8ee; color:#9aa0ad; font-size:13px; }
@media (max-width:820px) { .ug-shell { grid-template-columns:1fr; } .ug-toc { display:none; } .ug-mk-main2 { grid-template-columns:1fr; } }
`;

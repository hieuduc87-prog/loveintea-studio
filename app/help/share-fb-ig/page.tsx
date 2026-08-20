/**
 * PUBLIC PAGE — /help/share-fb-ig
 * Hướng dẫn CHI TIẾT cho khách chia sẻ quyền Fanpage + Instagram cho Business
 * Portfolio của Easy Creative Hub. Public (không cần login) — khách vừa nhận
 * welcome message qua Zalo có thể mở link này xem trước khi login.
 *
 * Cấu trúc: hero → 4 bước có screenshot placeholder → FAQ → CTA liên hệ Zalo.
 * Style: dark + brand-500 accent — đồng bộ với app.
 */

export const metadata = {
  title: 'Hướng dẫn chia sẻ Facebook + Instagram cho Easy Creative Hub',
  description: 'Chi tiết từng bước chia sẻ Fanpage + IG cho Business Portfolio ECH. Business ID 247211154665626. Làm 1 lần, dùng mãi (token không hết hạn).',
};

const BUSINESS_ID = '247211154665626';

interface StepProps {
  no: number;
  title: string;
  children: React.ReactNode;
  screenshotHint: string;
}

function Step({ no, title, children, screenshotHint }: StepProps) {
  return (
    <div className="border border-gray-800 bg-gray-900/50 rounded-2xl p-6 md:p-8">
      <div className="flex items-start gap-4 mb-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-500 text-white font-bold flex items-center justify-center">
          {no}
        </div>
        <h2 className="text-xl md:text-2xl font-bold text-white mt-1">{title}</h2>
      </div>
      <div className="ml-14 space-y-4 text-gray-300 text-sm md:text-base leading-relaxed">
        {children}
      </div>
      {/* Screenshot placeholder — founder chèn ảnh thật vào /public/help/*.png sau */}
      <div className="ml-14 mt-4 border-2 border-dashed border-gray-700 rounded-xl p-8 bg-gray-950 text-center">
        <div className="text-4xl mb-2 opacity-40">🖼️</div>
        <div className="text-xs text-gray-500">Ảnh minh hoạ: {screenshotHint}</div>
      </div>
    </div>
  );
}

export default function ShareFbIgHelpPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header đơn giản */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="text-lg font-bold text-white">Easy Creative Hub</a>
          <a href="/login" className="text-xs text-gray-400 hover:text-white">Đăng nhập →</a>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 py-12 md:py-16">
        <div className="inline-block bg-brand-500/10 border border-brand-500/30 rounded-full px-3 py-1 text-xs text-brand-300 mb-4">
          🤝 Hướng dẫn kết nối kênh
        </div>
        <h1 className="text-3xl md:text-5xl font-black text-white leading-tight">
          Chia sẻ Facebook + Instagram<br/>
          <span className="text-brand-400">cho Easy Creative Hub</span>
        </h1>
        <p className="mt-4 text-lg text-gray-400">
          Làm 1 lần, dùng mãi mãi — token không bao giờ hết hạn, không phải xin lại như OAuth cũ.
          Chuẩn agency mà Meta khuyến nghị cho SaaS quản lý nhiều Fanpage.
        </p>

        {/* Business ID card */}
        <div className="mt-8 bg-gradient-to-br from-brand-500/20 to-transparent border-2 border-brand-500 rounded-2xl p-6">
          <div className="text-xs text-brand-300 font-semibold uppercase tracking-wider mb-2">
            📌 ID Business Portfolio của ECH (copy để dán)
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <code className="bg-gray-950 px-5 py-3 rounded-lg text-brand-300 text-2xl md:text-3xl font-mono font-bold select-all">
              {BUSINESS_ID}
            </code>
            <span className="text-xs text-gray-500">← click để bôi đen, Ctrl+C copy</span>
          </div>
        </div>

        {/* Bảng so sánh nhanh */}
        <div className="mt-8 grid md:grid-cols-2 gap-4">
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
            <div className="text-xs font-semibold text-red-400 mb-2">❌ CÁCH CŨ — Login FB trực tiếp (OAuth)</div>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Token hết hạn 60 ngày → phải xin lại</li>
              <li>• Phải share password FB cho ai đó</li>
              <li>• Meta liên tục siết → hay bị vô hiệu</li>
              <li>• Cần app pass App Review (weeks chờ)</li>
            </ul>
          </div>
          <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
            <div className="text-xs font-semibold text-green-400 mb-2">✅ CÁCH NÀY — Business Portfolio share</div>
            <ul className="text-xs text-gray-300 space-y-1">
              <li>• Token vĩnh viễn — 1 lần setup, dùng mãi</li>
              <li>• KHÔNG share password — chỉ chia sẻ quyền</li>
              <li>• Chuẩn agency, Meta khuyến khích chính thức</li>
              <li>• Có thể REVOKE bất cứ lúc nào từ Business Suite</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 4 bước chi tiết */}
      <section className="max-w-4xl mx-auto px-4 pb-16 space-y-6">
        <h2 className="text-2xl font-bold text-white mb-2">4 bước làm trong 5 phút</h2>
        <p className="text-sm text-gray-500 mb-6">Cần: 1 tài khoản Facebook cá nhân là admin Fanpage + 1 Business Portfolio (chưa có thì tạo miễn phí ở bước 1).</p>

        <Step
          no={1}
          title="Mở Meta Business Suite"
          screenshotHint="Trang chủ business.facebook.com hiện danh sách Business Portfolio của bạn"
        >
          <p>Mở trình duyệt → truy cập:</p>
          <a href="https://business.facebook.com" target="_blank" rel="noreferrer"
            className="inline-block bg-brand-500 hover:bg-brand-400 text-white font-semibold px-4 py-2 rounded-lg text-sm">
            business.facebook.com →
          </a>
          <p>Đăng nhập bằng tài khoản Facebook cá nhân đang quản lý Fanpage.</p>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-300">
            <b>❓ Chưa có Business Portfolio?</b> Bấm nút <b>&quot;Create a business account&quot;</b> — điền tên shop + email → xong trong 2 phút, hoàn toàn miễn phí.
          </div>
          <p>Chọn Business Portfolio của shop bạn (nếu có nhiều Business).</p>
        </Step>

        <Step
          no={2}
          title="Chia sẻ FANPAGE cho ECH"
          screenshotHint="Menu Accounts → Pages → click Fanpage → tab 'Assign Partners' → nhập Business ID"
        >
          <ol className="list-decimal ml-6 space-y-2">
            <li>Menu trái: <b>Accounts</b> → <b>Pages</b></li>
            <li>Click vào Fanpage của shop cần kết nối</li>
            <li>Sang tab <b>&quot;Partners&quot;</b> hoặc <b>&quot;Assign Partners&quot;</b> (tuỳ giao diện, cùng nghĩa)</li>
            <li>Bấm nút <b>&quot;Assign partner&quot;</b> hoặc <b>&quot;+ Add&quot;</b></li>
            <li>
              Ô Business ID: nhập <code className="bg-gray-800 px-2 py-0.5 rounded text-brand-300 select-all">{BUSINESS_ID}</code>
              → bấm <b>Continue</b>
            </li>
            <li>
              Bảng permissions hiện ra — tick <b>ĐỦ 4 quyền</b> sau:
              <ul className="list-disc ml-6 mt-2 space-y-1 text-sm">
                <li>✅ <b>Create content</b> (đăng bài, ảnh, video)</li>
                <li>✅ <b>Manage Page</b> (sửa post, xoá comment spam)</li>
                <li>✅ <b>Send messages</b> (Messenger tự động, nếu bật)</li>
                <li>✅ <b>Access Page Insights</b> (đọc reach/engagement)</li>
              </ul>
            </li>
            <li>Bấm <b>&quot;Save changes&quot;</b></li>
          </ol>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm text-blue-300">
            <b>ℹ️ Fanpage đã có agency khác quản lý?</b> Không sao — share song song được, ECH không đá access của họ.
          </div>
        </Step>

        <Step
          no={3}
          title="Chia sẻ INSTAGRAM cho ECH"
          screenshotHint="Menu Accounts → Instagram accounts → click IG → tab 'Assign Partners' → nhập cùng Business ID"
        >
          <ol className="list-decimal ml-6 space-y-2">
            <li>Menu trái: <b>Accounts</b> → <b>Instagram accounts</b></li>
            <li>Click account Instagram của shop</li>
            <li>Tab <b>&quot;Partners&quot;</b> → <b>&quot;Assign partner&quot;</b></li>
            <li>
              Nhập cùng Business ID: <code className="bg-gray-800 px-2 py-0.5 rounded text-brand-300 select-all">{BUSINESS_ID}</code>
              → <b>Continue</b>
            </li>
            <li>
              Tick 2 quyền:
              <ul className="list-disc ml-6 mt-2 space-y-1 text-sm">
                <li>✅ <b>Create content</b></li>
                <li>✅ <b>Access Insights</b></li>
              </ul>
            </li>
            <li>Bấm <b>&quot;Save changes&quot;</b></li>
          </ol>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-300">
            <b>❓ IG chưa là Business account?</b> Mở app Instagram trên điện thoại → Settings → Account → &quot;Switch to Business account&quot; → chọn danh mục shop → link với Fanpage Facebook đã share ở bước 2. Sau đó quay lại làm bước 3 này.
          </div>
        </Step>

        <Step
          no={4}
          title="Báo cho Easy Creative Hub"
          screenshotHint="Ảnh chụp Zalo/Messenger nhắn tên Fanpage + tên IG cho admin ECH"
        >
          <p>Sau khi bấm Save xong 2 bước trên, nhắn qua kênh Zalo/Messenger (nơi bạn nhận link đăng nhập shop) với 2 thông tin:</p>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 font-mono text-sm">
            <div className="text-gray-500">// Mẫu tin nhắn</div>
            <div className="mt-2 text-gray-200">Chào admin, mình đã share Fanpage + IG cho Business ECH rồi:</div>
            <div className="text-brand-300 mt-1">① Tên Fanpage: &quot;Oliva Pilates Studio&quot;</div>
            <div className="text-brand-300">② Tên IG: @olivapilates.vn</div>
            <div className="text-gray-200 mt-1">Nhờ team verify và bật đăng bài giúp mình.</div>
          </div>
          <p>ECH sẽ verify quyền đã nhận và bật tính năng đăng bài tự động trong <b className="text-brand-300">~2 phút</b>. Sau đó bạn có thể tạo post → duyệt → &quot;Post Now&quot; hoặc &quot;Đặt lịch&quot; là đăng thẳng lên FB + IG.</p>
        </Step>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-bold text-white mb-6">Câu hỏi thường gặp</h2>
        <div className="space-y-3">
          {[
            {
              q: 'ECH có quyền gì với Fanpage/IG của tôi?',
              a: 'CHỈ những quyền bạn tick khi Assign: đăng bài, đọc insights, quản lý comment (nếu tick). ECH KHÔNG có quyền đổi mật khẩu, xoá Fanpage, hoặc mời admin mới. Bạn revoke lúc nào cũng được.',
            },
            {
              q: 'Làm sao thu hồi quyền nếu tôi không dùng ECH nữa?',
              a: 'Vào chính chỗ đã Assign → tìm "Easy Creative Hub" trong list Partners → bấm "Remove". Ngay lập tức ECH mất quyền, không thể đăng nữa.',
            },
            {
              q: 'Token có thật sự không hết hạn không?',
              a: 'Có. ECH dùng System User token gắn với Business Portfolio ECH — Meta document rõ token này KHÔNG expire. Chỉ mất khi bạn revoke Partner hoặc ECH bị Meta ban (chưa từng xảy ra).',
            },
            {
              q: 'Tôi có nhiều Fanpage — làm sao chọn cái nào share?',
              a: 'Chỉ share Fanpage nào bạn muốn ECH đăng thay. Các Fanpage khác ECH KHÔNG thấy, KHÔNG đụng được. Muốn thêm sau → làm lại bước 2 với Fanpage đó.',
            },
            {
              q: 'Không tìm thấy nút "Assign Partners"?',
              a: 'Meta thi thoảng đổi giao diện. Thử tìm các từ tương đương: "Partner Access", "Business Assets Partners", "Partners". Nếu vẫn không thấy, chụp màn hình gửi Zalo — team ECH hướng dẫn tận nơi.',
            },
            {
              q: 'Fanpage tôi chỉ mới lập, chưa đủ điều kiện gì đó?',
              a: 'Meta yêu cầu Fanpage phải hoạt động ít nhất vài ngày + đã đăng vài bài trước khi cho phép API đăng bài. Cứ share cho ECH, ECH sẽ báo lại khi Meta chưa cho phép.',
            },
          ].map((item, i) => (
            <details key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
              <summary className="cursor-pointer px-5 py-4 hover:bg-gray-900 text-white font-semibold text-sm md:text-base">
                {item.q}
              </summary>
              <div className="px-5 pb-4 text-sm text-gray-400 leading-relaxed">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* CTA cuối */}
      <section className="max-w-4xl mx-auto px-4 pb-20">
        <div className="bg-gradient-to-br from-brand-500/20 to-brand-500/5 border border-brand-500/40 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold text-white mb-2">Vướng ở đâu? Team ECH support tận tay.</h3>
          <p className="text-gray-400 mb-6">Chụp màn hình đang stuck, gửi Zalo/Messenger nơi bạn nhận link shop — team hỗ trợ trong ~30 phút giờ hành chính.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <a href="https://zalo.me/hieuduc87" target="_blank" rel="noreferrer"
              className="bg-brand-500 hover:bg-brand-400 text-white font-semibold px-6 py-3 rounded-lg text-sm">
              💬 Nhắn Zalo hỗ trợ
            </a>
            <a href="/login" className="bg-gray-800 hover:bg-gray-700 text-white font-semibold px-6 py-3 rounded-lg text-sm">
              ← Về trang đăng nhập
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-800 py-6 text-center text-xs text-gray-600">
        © 2026 Easy Creative Hub — AI + Đội ngũ chuyên gia marketing cho shop Việt.
      </footer>
    </div>
  );
}

'use client';

import { useState } from 'react';

type Section =
  | 'overview' | 'brain' | 'plan' | 'create'
  | 'publish' | 'engage' | 'learn'
  | 'library' | 'pipeline' | 'system';

const SECTIONS: { id: Section; icon: string; label: string; step?: number }[] = [
  { id: 'overview',  icon: '🏠', label: 'Tổng quan hệ thống' },
  { id: 'brain',     icon: '🧠', label: '① Brain — Nền tảng', step: 1 },
  { id: 'plan',      icon: '📋', label: '② Plan — Lập kế hoạch', step: 2 },
  { id: 'create',    icon: '✍️', label: '③ Create — Sản xuất', step: 3 },
  { id: 'publish',   icon: '📡', label: '④ Publish — Đăng bài', step: 4 },
  { id: 'engage',    icon: '💬', label: '⑤ Engage — Tương tác', step: 5 },
  { id: 'learn',     icon: '📊', label: '⑥ Learn — Học hỏi', step: 6 },
  { id: 'library',   icon: '🗃️', label: 'Library — Kho tài nguyên' },
  { id: 'pipeline',  icon: '🔄', label: 'Pipeline vận hành hàng ngày' },
  { id: 'system',    icon: '⚙️', label: 'System & Billing' },
];

export function UserGuideView() {
  const [active, setActive] = useState<Section>('overview');

  return (
    <div className="flex h-full">
      {/* Sidebar TOC */}
      <div className="w-56 flex-shrink-0 border-r border-gray-800 bg-gray-900/30 overflow-y-auto hidden md:block">
        <div className="px-3 py-4">
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 px-2">Hướng dẫn vận hành</p>
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

          {/* Pipeline mini-map */}
          <div className="mt-4 px-2 py-3 border-t border-gray-800">
            <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-2">Closed-Loop Flow</p>
            <div className="space-y-1 text-[10px] font-mono text-gray-500">
              {['Brain','Plan','Create','Publish','Engage','Learn'].map((s, i) => {
                const sec = SECTIONS.find(x => x.step === i + 1);
                const isActive = sec?.id === active;
                return (
                  <div key={s} className="flex items-center gap-1.5">
                    <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${isActive ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-600'}`}>{i + 1}</span>
                    <span className={isActive ? 'text-brand-400' : ''}>{s}</span>
                    {i < 5 && <span className="text-gray-700 ml-auto">&darr;</span>}
                    {i === 5 && <span className="text-gray-600 ml-auto">&circlearrowleft;</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile tab bar */}
      <div className="md:hidden flex-shrink-0 border-b border-gray-800 overflow-x-auto">
        <div className="flex">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActive(s.id)}
              className={`px-3 py-2.5 text-xs whitespace-nowrap ${active === s.id ? 'text-white border-b-2 border-brand-600' : 'text-gray-500'}`}>
              {s.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-4xl">
        {active === 'overview' && <OverviewSection />}
        {active === 'brain' && <BrainSection />}
        {active === 'plan' && <PlanSection />}
        {active === 'create' && <CreateSection />}
        {active === 'publish' && <PublishSection />}
        {active === 'engage' && <EngageSection />}
        {active === 'learn' && <LearnSection />}
        {active === 'library' && <LibrarySection />}
        {active === 'pipeline' && <PipelineSection />}
        {active === 'system' && <SystemSection />}
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
function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-red-600/10 border border-red-600/30 rounded-lg px-3 py-2.5 mb-3">
      <p className="text-xs text-red-300 leading-relaxed">{children}</p>
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
function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 mb-1">
      <span className="text-xs text-gray-500 w-36 flex-shrink-0">{label}</span>
      <span className="text-xs text-gray-300">{value}</span>
    </div>
  );
}
function TabRef({ name }: { name: string }) {
  return <strong className="text-white">{name}</strong>;
}

/* ═══════════════════════════════════════════════════════════════════
   SECTIONS
   ═══════════════════════════════════════════════════════════════════ */

function OverviewSection() {
  return (
    <>
      <H1>LoveinTea Studio — Hệ thống Closed-Loop Content Engine</H1>
      <P>
        Hệ thống quản lý marketing khép kín: mỗi bài đăng mang lineage (brief_id + rule_version) để attribute performance ngược về quyết định gốc. Không phải nhà máy content một chiều — mà là vòng lặp tự cải thiện.
      </P>

      {/* Pipeline visual */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
        <div className="flex flex-wrap items-center justify-center gap-1 text-xs font-mono">
          {[
            { step: '①', name: 'Brain', desc: 'Knowledge + Rules', color: 'text-emerald-400' },
            { step: '②', name: 'Plan', desc: 'Calendar + Brief', color: 'text-blue-400' },
            { step: '③', name: 'Create', desc: 'Copy + Visual', color: 'text-purple-400' },
            { step: '④', name: 'Publish', desc: 'Review + Post', color: 'text-amber-400' },
            { step: '⑤', name: 'Engage', desc: 'Inbox + Signals', color: 'text-pink-400' },
            { step: '⑥', name: 'Learn', desc: 'Analytics + Score', color: 'text-cyan-400' },
          ].map((s, i) => (
            <span key={s.name} className="flex items-center gap-1">
              <span className={`${s.color} font-bold`}>{s.step} {s.name}</span>
              <span className="text-gray-600">({s.desc})</span>
              {i < 5 && <span className="text-gray-600 mx-1">&rarr;</span>}
              {i === 5 && <span className="text-gray-600 mx-1">&circlearrowleft;</span>}
            </span>
          ))}
        </div>
      </div>

      <H2>Luận điểm trung tâm</H2>
      <P>
        Kiến trúc 2 tầng: <TabRef name="Fixed Core" /> (brand identity — không đổi) + <TabRef name="Flex Edge" /> (content variables — test nhanh). Identity được khoá cứng trong Brain; tốc độ đến từ việc test biến nhanh trong Create.
      </P>

      <H2>Lineage — Truy vết nhân quả</H2>
      <P>
        Mỗi post mang <TabRef name="brief_id" /> + <TabRef name="rule_version" /> + <TabRef name="cell_id" />. Khi Analytics thấy post thắng/thua → attribute ngược về brief + rule → Scoreboard cập nhật verdict → Rules Engine tiến hóa. Đây là closed-loop.
      </P>

      <H2>Sản phẩm (6 SKU)</H2>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { name: 'Dandelion', color: '#F4A020', brew: 'golden amber', moment: 'Morning' },
          { name: 'Ginger', color: '#A8B525', brew: 'warm amber-gold', moment: 'Morning' },
          { name: 'Hibiscus', color: '#5B8C3E', brew: 'deep ruby', moment: 'Afternoon' },
          { name: 'Lemon Balm', color: '#8BBF5C', brew: 'pale straw-green', moment: 'Evening' },
          { name: 'Peppermint', color: '#5BBCD2', brew: 'light celadon', moment: 'Afternoon' },
          { name: 'Nighty Night', color: '#3F3D99', brew: 'soft golden', moment: 'Evening' },
        ].map(s => (
          <div key={s.name} className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg p-2.5">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
            <div>
              <p className="text-xs text-white font-medium">{s.name}</p>
              <p className="text-[10px] text-gray-500">{s.moment} · {s.brew}</p>
            </div>
          </div>
        ))}
      </div>
      <Tip>Mỗi SKU có Beverage HARD LOCK (brew color + vessel + visual cue) — AI tự động áp dụng khi tạo ảnh và viết copy.</Tip>
    </>
  );
}

function BrainSection() {
  return (
    <>
      <H1>① Brain — Nền tảng thương hiệu & tri thức</H1>
      <P>
        Brain là lớp tham chiếu tĩnh — luật bất biến của brand. Mọi bước sau (Plan, Create, Review) đều phải tuân theo Brain. Brain gồm 4 tab:
      </P>

      <H2>🧠 Knowledge Hub — Kho tài liệu chiến lược</H2>
      <P>
        Trung tâm quản lý toàn bộ tài liệu nguồn nuôi pipeline. Hiện có 9 docs (~121KB) bao gồm playbook, IA, detail spec, case study, workflow.
      </P>
      <Step n={1}>Mở tab <TabRef name="Knowledge Hub" /> — xem danh sách tài liệu xếp theo type (playbook → guideline → research → workflow → flowmap).</Step>
      <Step n={2}><TabRef name="Reading Order Banner" /> ở đầu trang chỉ thứ tự đọc khuyến nghị: README → Flow Map → IA → Detail Spec → Case Study → Playbook.</Step>
      <Step n={3}>Click <TabRef name="View" /> trên card để mở inline viewer — đọc full nội dung markdown ngay trong app.</Step>
      <Step n={4}>Dùng <TabRef name="Search" /> + <TabRef name="Type Filter" /> để tìm nhanh tài liệu cần.</Step>
      <Tip>
        AI engine tự động đọc knowledge_docs khi generate content. Playbook compliance rules + claim-safe language + master-prompt trà đều được inject vào mọi lần gọi AI. Bạn không cần copy-paste — chỉ cần đảm bảo tài liệu đầy đủ ở đây.
      </Tip>

      <H2>🌿 Brand DNA — Nền tảng thương hiệu</H2>
      <P>
        Hiển thị tagline, archetype, through-line, bảng màu, typography, tone of voice, compliance gate (từ cấm/bắt buộc), hashtags.
      </P>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 mb-4 space-y-1">
        <KV label="Tagline" value="Timeless Remedies" />
        <KV label="Archetype" value="The Joyful Healer" />
        <KV label="Tone of Voice" value="Warmly Wise · Cheerfully Simple · Proudly Vietnamese" />
        <KV label="Compliance" value="NEVER: cures, treats, heals, detox, liver, heart, exotic" />
      </div>
      <P>
        Upload file brand voice (.txt, .md) — nội dung lưu vào hệ thống và AI sẽ tham khảo.
      </P>

      <H2>📦 Products — Quản lý sản phẩm</H2>
      <P>
        6 SKU trà. Mỗi sản phẩm có: theme, màu, thành phần, use cases, pitch, beverage HARD LOCK. Nhấn sản phẩm → quản lý <TabRef name="Product Photography" /> (packshot, lifestyle, macro, flat-lay).
      </P>
      <Tip>Upload ảnh sản phẩm chất lượng cao ở đây. Image Studio dùng ảnh gốc + GPT-image-2 edit mode để tạo ảnh marketing.</Tip>

      <H2>⚙️ Rules Engine — Quản lý quy tắc content</H2>
      <P>
        Tối đa 30 rule active, có version. Mỗi rule sinh từ learning có bằng chứng. AI tự động đọc toàn bộ active rules khi generate content.
      </P>
      <Step n={1}>Lần đầu → nhấn <TabRef name="Seed Defaults" /> để tạo 8 rule nền tảng (v1.0).</Step>
      <Step n={2}>Thêm rule mới: nhập nội dung + evidence → <TabRef name="Add Rule" />. Version tự tăng (v1.1, v1.2...).</Step>
      <Step n={3}>Rule cũ không còn phù hợp → nhấn <TabRef name="Retire" /> (giữ lịch sử, không xoá).</Step>
      <Step n={4}>Quá 30 rule → phải retire rule yếu nhất trước khi thêm mới.</Step>
      <Warn>Rules trực tiếp ảnh hưởng mọi output AI. Thêm rule "không dùng từ X" → AI sẽ tuân theo ngay lập tức ở tất cả content mới.</Warn>
      <Tip>Khi Learn engine phân tích data và đề xuất rule mới → review + approve thủ công ở đây. Không tự động thêm rule — human-in-the-loop.</Tip>
    </>
  );
}

function PlanSection() {
  return (
    <>
      <H1>② Plan — Lập kế hoạch nội dung</H1>
      <P>
        Plan chuyển verdicts từ Scoreboard + quy chuẩn từ Brain thành lịch content cụ thể. Mỗi slot phải có Channel (FB/IG), Funnel-stage, SKU, Segment, RTB.
      </P>

      <H2>📋 Content Plans — Import & quản lý plan</H2>
      <Step n={1}>Nhấn <TabRef name="Upload Plan (.xlsx)" /> hoặc kéo thả file Excel.</Step>
      <Step n={2}>Hệ thống đọc 3 sheet: Content Plan (danh sách slot), Stories Rotation, Summary.</Step>
      <Step n={3}>Tự động tạo draft posts với ngày lên lịch từ plan.</Step>
      <Step n={4}>Plan hiện ở sidebar trái — nhấn vào xem chi tiết.</Step>
      <P>Cấu trúc file Excel:</P>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 mb-4 space-y-1 text-xs text-gray-400">
        <p><TabRef name="Sheet 1 — Content Plan:" /> Date | Day | Wave | Surface | Purpose | Pillar | Segment | RTB | USP | SKU | Context | Hook | Copy Direction | Visual Direction | Hashtags</p>
        <p><TabRef name="Sheet 2 — Stories:" /> Daily rotation (Mon-Sun themes) + Highlights storefront</p>
        <p><TabRef name="Sheet 3 — Summary:" /> Purpose mix, format mix, context split, balance check</p>
      </div>
      <Tip>Thanh tiến độ trên mỗi plan: xanh=published, vàng=scheduled, xám=draft.</Tip>

      <H2>🗓️ Post Calendar — Lịch đăng bài</H2>
      <P>
        Hiển thị bài viết trên calendar tháng. Mỗi bài = color dot SKU + thời gian.
      </P>
      <P>
        <TabRef name="Plan Items (Blueprint)" />: Nhấn nút 📋 Plan góc trên phải → bật hiển thị plan items (ô xanh nhạt) = "bản thiết kế" cho bài chưa sản xuất. Nhấn vào xem brief chi tiết.
      </P>
      <P>
        <TabRef name="Brief Builder" /> (API): Từ plan item, hệ thống có thể auto-generate brief với lineage (brief_id + rule_version). Brief ràng buộc: đúng 1 purpose + 1 variable_cell → đảm bảo attribution rõ ràng trong Learn.
      </P>
      <Tip>Cần ~120 cell cho 6 tháng phủ O3 coverage (không phải ~12). IG = brand/discovery; FB = community/trust/conversion — slot phải tách rõ ý đồ theo kênh.</Tip>
    </>
  );
}

function CreateSection() {
  return (
    <>
      <H1>③ Create — Sản xuất nội dung</H1>
      <P>
        Create tách 2 track song song: Copy (text) + Visual (image). Cả 2 đều được AI inject knowledge_docs + active rules + per-SKU HARD LOCK.
      </P>

      <H2>✍️ Content Workshop — Track Copy</H2>
      <P>
        O3 Content Framework: chọn 7 biến → AI viết caption theo 4-beat structure + image prompt.
      </P>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 mb-4 grid grid-cols-2 gap-1 text-xs">
        <div className="text-gray-400"><TabRef name="SKU" /> — Sản phẩm (1 trong 6 trà)</div>
        <div className="text-gray-400"><TabRef name="Segment" /> — Đối tượng (S1-S5)</div>
        <div className="text-gray-400"><TabRef name="RTB" /> — Reason to Buy</div>
        <div className="text-gray-400"><TabRef name="USP" /> — Điểm khác biệt</div>
        <div className="text-gray-400"><TabRef name="Narrative" /> — Cách kể (POV, Before-After...)</div>
        <div className="text-gray-400"><TabRef name="Context" /> — Bối cảnh (sofa, WFH desk...)</div>
        <div className="text-gray-400"><TabRef name="CTA" /> — Kêu gọi hành động</div>
      </div>
      <P><TabRef name="Single mode:" /> Chọn biến → Generate → AI viết + tạo ảnh → lưu Queue.</P>
      <P><TabRef name="Batch mode:" /> Chọn nhiều SKU × biến → tạo hàng loạt.</P>
      <P><TabRef name="Auto-post:" /> Tick checkbox → sau khi tạo xong tự đăng FB.</P>

      <H2>AI đã được nâng cấp (Closed-Loop)</H2>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 mb-4 space-y-2 text-xs text-gray-400">
        <p>✅ <TabRef name="Knowledge injection:" /> 121KB tài liệu chiến lược (playbook, compliance, master-prompt) tự động inject vào mọi AI call.</p>
        <p>✅ <TabRef name="Active rules:" /> 8+ rules versioned feed trực tiếp vào prompt.</p>
        <p>✅ <TabRef name="Scoreboard verdicts:" /> Angles đã verdict SCALE/RETIRE được nhắc trong prompt để AI ưu tiên/tránh.</p>
        <p>✅ <TabRef name="Beverage HARD LOCK:" /> Per-SKU brew color + vessel + visual cue — AI bắt buộc tuân theo.</p>
        <p>✅ <TabRef name="Extended compliance:" /> 17 banned terms (detox, liver, heart, anti-inflammatory...) + claim-safe framing.</p>
        <p>✅ <TabRef name="Lineage:" /> Mỗi post tự động gắn rule_version + cell_id để attribute về sau.</p>
      </div>
      <Tip>Variable Layer: chọn "SKU-first" → các biến segment/RTB/USP tự sắp xếp theo độ phù hợp.</Tip>

      <H2>🖼️ Image Studio — Track Visual</H2>
      <P>Tạo ảnh marketing bằng GPT-image-2:</P>
      <div className="space-y-2 mb-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <p className="text-xs font-medium text-white mb-1">Edit Mode (khuyên dùng)</p>
          <p className="text-xs text-gray-400">Dùng ảnh sản phẩm gốc → AI chỉnh sửa bối cảnh. Giữ nguyên bao bì, thêm per-SKU HARD LOCK (brew color, vessel, visual cue).</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <p className="text-xs font-medium text-white mb-1">Generate Mode</p>
          <p className="text-xs text-gray-400">Tạo ảnh hoàn toàn mới. Tag: 1 white LoveinTea logo tag — NOT red, NOT kraft.</p>
        </div>
      </div>

      <H2>📝 Blog Factory — Tạo blog SEO</H2>
      <P>Chọn SKU + topic → AI viết bài dài SEO với title, slug, excerpt, content.</P>
    </>
  );
}

function PublishSection() {
  return (
    <>
      <H1>④ Publish — Review & Đăng bài</H1>
      <P>
        Publish bây giờ có <TabRef name="Review Desk" /> tự động — cổng cứng chặn content sai trước khi đăng. Không phải check mềm.
      </P>

      <H2>✅ Review & Queue — Review Desk + Hàng đợi</H2>
      <P>Tất cả bài được tạo nằm ở đây. Khi nhấn Publish, hệ thống tự động chạy 3 gate:</P>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 mb-4 space-y-2">
        <div className="flex items-start gap-2">
          <span className="text-xs bg-red-600/30 text-red-300 px-2 py-0.5 rounded flex-shrink-0">Gate 1</span>
          <div>
            <p className="text-xs text-white font-medium">FDA Claim Safety</p>
            <p className="text-xs text-gray-400">Scan 17 banned terms: cures, treats, heals, detox, liver, heart, anti-inflammatory, antioxidant-rich, boosts immune, fights cancer, reduces cholesterol, burns fat, weight loss, anti-aging, cleanses, flushes toxins, prevents.</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-xs bg-amber-600/30 text-amber-300 px-2 py-0.5 rounded flex-shrink-0">Gate 2</span>
          <div>
            <p className="text-xs text-white font-medium">Anti-AI Quality</p>
            <p className="text-xs text-gray-400">Detect AI-slop words (delve, tapestry, embark, elevate, resonate, leverage), repetitive text, cliché openings (imagine, picture this, close your eyes).</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-xs bg-blue-600/30 text-blue-300 px-2 py-0.5 rounded flex-shrink-0">Gate 3</span>
          <div>
            <p className="text-xs text-white font-medium">Dedup Check</p>
            <p className="text-xs text-gray-400">So sánh với 50 bài gần nhất (30 ngày). Nếu &gt;70% giống → FAIL. Tránh đăng content trùng lặp.</p>
          </div>
        </div>
      </div>
      <Warn>FAIL bất kỳ gate nào → bài bị chặn + hiển thị lý do cụ thể. Sửa caption rồi thử lại.</Warn>
      <P>PASS cả 3 gate → bài được đăng lên Facebook/Instagram kèm lineage (Post Object).</P>

      <H2>📅 Schedule — Timeline & Publish</H2>
      <P>Danh sách bài theo timeline (Today → Tomorrow → tuần này). 3 hành động:</P>
      <div className="space-y-1.5 mb-4">
        <div className="flex items-center gap-2"><span className="text-xs bg-brand-600 text-white px-2 py-1 rounded-lg">📡 Post Now</span><span className="text-xs text-gray-400">Đăng ngay (qua Review Desk)</span></div>
        <div className="flex items-center gap-2"><span className="text-xs bg-yellow-600 text-white px-2 py-1 rounded-lg">🗓️ Schedule</span><span className="text-xs text-gray-400">Hẹn giờ trên Facebook</span></div>
        <div className="flex items-center gap-2"><span className="text-xs bg-gray-700 text-white px-2 py-1 rounded-lg">💾 Save time</span><span className="text-xs text-gray-400">Lưu thời gian (chưa đăng)</span></div>
      </div>

      <H2>📡 Channels — Kênh đăng bài</H2>
      <P>Quản lý kết nối Facebook Page & Instagram Business. Nhập Page ID + Access Token → kiểm tra → lưu.</P>
      <Tip>Cần Facebook System User Token (không hết hạn). Quyền: pages_manage_posts, pages_read_engagement, instagram_basic, instagram_content_publish.</Tip>
    </>
  );
}

function EngageSection() {
  return (
    <>
      <H1>⑤ Engage — Tương tác cộng đồng</H1>
      <P>
        Quản lý tương tác sau đăng: trả lời comment, DM, thu tín hiệu định tính (objection, câu hỏi lặp) → input cho Learn.
      </P>

      <H2>💬 Inbox & Comments</H2>
      <P>Tập trung tin nhắn Facebook & Instagram về 1 nơi:</P>
      <div className="space-y-1 mb-4 text-sm text-gray-300">
        <P>• <TabRef name="Messages" /> — Tin nhắn Messenger/IG DM</P>
        <P>• <TabRef name="Comments" /> — Bình luận trên bài viết</P>
        <P>• <TabRef name="Feed" /> — Bài viết mới nhất trên page</P>
      </div>
      <P>Nhấn <TabRef name="Sync" /> kéo dữ liệu mới từ Facebook/Instagram API.</P>

      <H2>Thu tín hiệu cho Learn</H2>
      <P>
        Khi engage community, ghi nhận:
      </P>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 mb-4 space-y-1 text-xs text-gray-400">
        <p>• Câu hỏi lặp lại → gợi ý angle mới cho Plan</p>
        <p>• Objection phổ biến → gợi ý rule mới cho Rules Engine</p>
        <p>• Comment tích cực trên angle cụ thể → evidence cho Scoreboard SCALE</p>
      </div>
      <Tip>FB ưu tiên depth (trust/conversion); IG ưu tiên reach/discovery. Engage strategy khác nhau theo kênh.</Tip>
    </>
  );
}

function LearnSection() {
  return (
    <>
      <H1>⑥ Learn — Phân tích & Phản hồi</H1>
      <P>
        Learn đóng vòng lặp: phân tích performance → attribute nhân quả về brief/rule → cập nhật Scoreboard → đề xuất rules mới → quay về Brain.
      </P>

      <H2>📊 Analytics — Đo lường hiệu quả</H2>
      <P>3 sub-tab:</P>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 mb-4 space-y-1.5">
        <KV label="Overview" value="Tổng: published, scheduled, draft, failed, blogs, images" />
        <KV label="Per Post (FB)" value="Từng bài: reach, impressions, engaged, reactions, comments, shares" />
        <KV label="Instagram" value="Account metrics: followers, reach, profile views, website clicks" />
      </div>
      <P><TabRef name="Rolling windows:" /> Chọn 3/7/14/30 ngày → so sánh hiệu quả giữa các giai đoạn.</P>

      <H2>🏆 Scoreboard — Verdict per Angle</H2>
      <P>
        Bảng tổng hợp performance theo từng angle (variable_cell) và channel. Mỗi angle nhận verdict:
      </P>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 mb-4 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs bg-green-600/30 text-green-400 px-2 py-0.5 rounded font-bold">SCALE</span>
          <span className="text-xs text-gray-400">Vượt saves floor + baseline → nhân rộng angle này</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-yellow-600/30 text-yellow-400 px-2 py-0.5 rounded font-bold">HOLD</span>
          <span className="text-xs text-gray-400">Chưa đủ data (sample &lt; 3) → tiếp tục test</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-red-600/30 text-red-400 px-2 py-0.5 rounded font-bold">RETIRE</span>
          <span className="text-xs text-gray-400">Dưới saves floor sau đủ sample → dừng angle này</span>
        </div>
      </div>
      <Step n={1}>Nhấn <TabRef name="Recompute" /> để tính lại verdicts từ post metrics.</Step>
      <Step n={2}>SCALE angles tự động được nhắc trong AI prompt → ưu tiên.</Step>
      <Step n={3}>RETIRE angles tự động bị nhắc → AI tránh.</Step>
      <Warn>Scoreboard cần ≥10 published posts để compute. Trước đó tất cả angles là HOLD — bình thường. Không kết luận trên outlier 1 post.</Warn>
      <Tip>Saves là KPI chính (leading indicator cho intent). Reach và ER là secondary. Absolute saves floor — không phải bội số baseline.</Tip>

      <H2>Learn Engine — Phân tích AI (API)</H2>
      <P>
        Learn engine (POST /api/learn) phân tích 30-day data → attribute performance về brief_id + rule_version → đề xuất scoreboard updates + rules mới.
      </P>
      <P>
        Cần ≥5 published posts có metrics. Output: scoreboard_updates + proposed_rules + summary. Rules đề xuất phải được approve thủ công trong Rules Engine.
      </P>
    </>
  );
}

function LibrarySection() {
  return (
    <>
      <H1>Library — Kho tài nguyên</H1>

      <H2>🗃️ Asset DAM — Quản lý tài sản</H2>
      <P>Digital Asset Management: tất cả ảnh, file → quản lý tập trung. Tags theo product, format, season, content_goal. Filter + search.</P>

      <H2>🖼️ Image Library — Kho ảnh AI</H2>
      <P>Tất cả ảnh GPT-image-2 đã tạo. Tìm theo SKU, prompt, tags. Đánh dấu ★ yêu thích. Xem lightbox full-size. Download gốc. Upload thủ công.</P>

      <H2>📜 Content Log — Nhật ký nội dung</H2>
      <P>Log toàn bộ content đã sản xuất: post, reel, story, carousel, video, blog. Filter theo status (draft/scheduled/aired), platform, product.</P>

      <H2>⏳ Job Queue — Theo dõi tạo ảnh</H2>
      <P>Jobs GPT-image-2: đang chạy, hoàn thành, lỗi. Auto-refresh mỗi 5 giây khi có job đang chạy.</P>
    </>
  );
}

function PipelineSection() {
  return (
    <>
      <H1>🔄 Pipeline vận hành — Quy trình hàng ngày</H1>
      <P>
        Dưới đây là quy trình vận hành closed-loop engine, từ setup ban đầu đến vòng lặp hàng tuần.
      </P>

      <H2>Setup ban đầu (1 lần)</H2>
      <Step n={1}><TabRef name="Brain → Knowledge Hub:" /> Kiểm tra 9 tài liệu chiến lược đã có. Upload thêm nếu cần.</Step>
      <Step n={2}><TabRef name="Brain → Rules Engine:" /> Nhấn "Seed Defaults" tạo 8 rules nền tảng v1.0.</Step>
      <Step n={3}><TabRef name="Brain → Products:" /> Upload ảnh sản phẩm chất lượng cao cho 6 SKU.</Step>
      <Step n={4}><TabRef name="Publish → Channels:" /> Kết nối Facebook Page + Instagram Business.</Step>

      <H2>Lập kế hoạch (1 lần/tháng)</H2>
      <Step n={1}>Chuẩn bị file Excel content plan (3 sheets) theo O3 framework.</Step>
      <Step n={2}><TabRef name="Plan → Content Plans:" /> Upload file → review plan items.</Step>
      <Step n={3}><TabRef name="Plan → Post Calendar:" /> Kiểm tra calendar. Bật Plan Items overlay để xem blueprint.</Step>
      <Step n={4}>Tham khảo Scoreboard verdicts: ưu tiên SCALE angles, tránh RETIRE angles trong plan.</Step>

      <H2>Sản xuất nội dung (hàng ngày)</H2>
      <Step n={1}><TabRef name="Create → Content Workshop:" /> Chọn biến theo plan → Generate.</Step>
      <Step n={2}>AI tự inject knowledge + rules + beverage HARD LOCK → viết caption + image prompt.</Step>
      <Step n={3}>GPT-image-2 tạo ảnh → lưu vào Queue với lineage (rule_version + cell_id).</Step>
      <Step n={4}>Nếu tick "Auto-post" → tự chạy Review Desk → đăng FB.</Step>

      <H2>Đăng bài (hàng ngày)</H2>
      <Step n={1}><TabRef name="Publish → Review & Queue:" /> Xem bài draft → nhấn Publish.</Step>
      <Step n={2}><TabRef name="Review Desk tự động:" /> 3 gates (claim safety + AI quality + dedup). PASS → đăng. FAIL → sửa.</Step>
      <Step n={3}><TabRef name="Publish → Schedule:" /> Hoặc hẹn giờ đăng.</Step>

      <H2>Tương tác (hàng ngày)</H2>
      <Step n={1}><TabRef name="Engage → Inbox:" /> Sync + trả lời comment/DM.</Step>
      <Step n={2}>Ghi nhận câu hỏi lặp, objection → input cho Learn.</Step>

      <H2>Phân tích & cải tiến (hàng tuần)</H2>
      <Step n={1}><TabRef name="Learn → Analytics:" /> Per Post → xem reach, saves, ER từng bài.</Step>
      <Step n={2}><TabRef name="Learn → Scoreboard:" /> Nhấn "Recompute" → xem verdict SCALE/HOLD/RETIRE.</Step>
      <Step n={3}>Gọi Learn Engine (API) để AI analyze + propose rules.</Step>
      <Step n={4}><TabRef name="Brain → Rules Engine:" /> Review proposed rules → Approve/Reject.</Step>
      <Step n={5}>Quay lại Plan → điều chỉnh plan tháng sau dựa trên verdicts mới.</Step>

      <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Mẹo vận hành Closed-Loop</p>
        <div className="space-y-2 text-xs text-gray-300">
          <p>• <TabRef name="Lineage là bắt buộc" /> — thiếu brief_id/rule_version → không attribute được. Luôn generate qua Workshop (tự gắn lineage).</p>
          <p>• <TabRef name="Review Desk bảo vệ brand" /> — đừng bypass. Nếu bị chặn, sửa caption cho đúng thay vì tắt review.</p>
          <p>• <TabRef name="Đừng kết luận trên outlier" /> — Scoreboard cần ≥3 posts/angle. 1 post viral không chứng minh gì.</p>
          <p>• <TabRef name="Rules có trần 30" /> — ép kỷ luật: rule yếu phải retire trước khi thêm mới. Giữ lean.</p>
          <p>• <TabRef name="Saves &gt; Likes" /> — Saves là leading indicator cho purchase intent. Optimise for saves, not vanity metrics.</p>
          <p>• <TabRef name="IG ≠ FB" /> — Slot phải tách: IG cho discovery/brand, FB cho trust/conversion. Đừng cross-post y nguyên.</p>
          <p>• <TabRef name="Batch mode cho hiệu suất" /> — 3 SKU × 3 context → 9 bài có lineage cùng lúc.</p>
          <p>• <TabRef name="Knowledge Hub là nguồn sống" /> — Thêm case study, competitive analysis, customer quotes → AI output tốt hơn.</p>
        </div>
      </div>
    </>
  );
}

function SystemSection() {
  return (
    <>
      <H1>System & Billing</H1>

      <H2>💳 Billing — Thanh toán</H2>
      <P>Quản lý gói dịch vụ Studio Setup (2M VND) + Studio Pro monthly (990K VND/tháng). Hỗ trợ bank transfer + MoMo.</P>

      <H2>📖 Guide — Hướng dẫn</H2>
      <P>Trang bạn đang đọc.</P>

      <H2>👥 Team & Access — Quản lý team</H2>
      <P>Chỉ admin/root_admin. Phê duyệt user mới, phân quyền (root_admin, admin, editor, viewer).</P>

      <H2>Kanban & Flow Builder (External)</H2>
      <P>
        <TabRef name="Kanban:" /> Board quản lý task kiểu Trello. Sidebar → Tools → Kanban.
      </P>
      <P>
        <TabRef name="Flow Builder:" /> Thiết kế workflow visual. Hiện có 2 workflows: "Image Generation — Product Photos" và "LoveinTea Closed-Loop Content Engine" (13 nodes, 18 edges). Sidebar → Tools → Flow Builder.
      </P>
      <Tip>Flowmap HTML interactive: truy cập trực tiếp tại /brand/flowmap.html</Tip>
    </>
  );
}

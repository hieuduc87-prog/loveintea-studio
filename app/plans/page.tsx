/**
 * PUBLIC /plans — catalog gói dịch vụ Easy Creative Hub.
 * SSR đọc từ service_plans (global DB). Middleware exclude → không cần login.
 *
 * Layout: hero USP → grid 4 category (Social / Combo / Brand Identity / Web-SEO)
 *   → testimonial band → FAQ → CTA final.
 * Mỗi PlanCard link tới /plans/[slug] detail. Card 'featured' được highlight.
 */
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { PlansExitPopup } from '@/components/plans/PlansExitPopup';

export const metadata = {
  title: 'Gói dịch vụ — Easy Creative Hub',
  description: 'Từ Trial 30 ngày miễn phí đến gói Combo trọn gói + Brand Identity + Logo + Website SEO. AI + Đội ngũ chuyên gia marketing Việt.',
};

interface ServicePlan {
  slug: string;
  name: string;
  category: string;
  price_display: string;
  price_note: string;
  tagline: string;
  features_json: string;
  is_featured: number;
  sort_order: number;
  billing_type: string;
}

const CATEGORY_LABELS: Record<string, { title: string; icon: string; desc: string }> = {
  'trial': { title: 'Dùng thử', icon: '🎁', desc: 'Trải nghiệm trước, không cần thẻ' },
  'social-image': { title: 'Ảnh social', icon: '🖼️', desc: 'Cho shop ưu tiên ảnh chất lượng cao' },
  'social-video': { title: 'Video Reel', icon: '🎬', desc: 'Reel + video sản phẩm' },
  'combo': { title: '⭐ COMBO trọn gói', icon: '🎯', desc: 'Bán chạy nhất — ảnh + video + đăng bài' },
  'brand-identity': { title: 'Brand Identity', icon: '🧠', desc: 'Xây thương hiệu từ đầu' },
  'logo': { title: 'Thiết kế Logo', icon: '🎨', desc: 'Designer thật + AI phác thảo' },
  'website-seo': { title: 'Website + SEO', icon: '🌐', desc: 'Landing shop + AI viết blog SEO' },
};

export default async function PlansPage() {
  // Đọc thẳng service_plans từ DB (global) — không cần API layer.
  let plans: ServicePlan[] = [];
  try {
    plans = getDb().prepare(`SELECT slug, name, category, price_display, price_note, tagline,
      features_json, is_featured, sort_order, billing_type
      FROM service_plans WHERE is_active=1 ORDER BY sort_order ASC`).all() as ServicePlan[];
  } catch { /* bảng chưa có (chưa boot) → hiển thị empty */ }

  // Group theo category giữ thứ tự sort_order
  const byCategory = new Map<string, ServicePlan[]>();
  for (const p of plans) {
    const arr = byCategory.get(p.category) ?? [];
    arr.push(p);
    byCategory.set(p.category, arr);
  }
  const categoryOrder = ['trial', 'combo', 'social-image', 'social-video', 'brand-identity', 'logo', 'website-seo'];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PlansExitPopup />

      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="text-lg font-bold text-white">Easy Creative Hub</a>
          <div className="flex gap-3 items-center">
            <a href="/#features" className="hidden md:inline text-xs text-gray-400 hover:text-white">Tính năng</a>
            <a href="/help/share-fb-ig" className="hidden md:inline text-xs text-gray-400 hover:text-white">Hướng dẫn</a>
            <a href="/login" className="bg-brand-500 hover:bg-brand-400 text-white text-xs font-semibold px-4 py-2 rounded-lg">Đăng nhập →</a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 pt-16 pb-8 text-center">
        <div className="inline-block bg-brand-500/10 border border-brand-500/30 rounded-full px-4 py-1 text-xs text-brand-300 mb-6">
          💼 Gói dịch vụ — Chọn gói phù hợp shop bạn
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-white leading-tight tracking-tight">
          Không phó thác cho AI.<br/>
          <span className="text-brand-400">Có chuyên gia marketing lên plan.</span>
        </h1>
        <p className="mt-6 text-lg md:text-xl text-gray-400 max-w-3xl mx-auto">
          Đội ngũ marketing Việt duyệt content plan mỗi tháng, AI tăng tốc thực thi caption + ảnh + video + đăng bài FB/IG.
          Chọn gói theo nhu cầu shop bạn — từ 30 ngày dùng thử miễn phí đến trọn gói agency-lite.
        </p>
        <div className="mt-8 flex gap-3 justify-center flex-wrap">
          <a href="#gói" className="bg-brand-500 hover:bg-brand-400 text-white font-semibold px-6 py-3 rounded-lg">
            Xem 7 gói →
          </a>
          <a href="#faq" className="bg-gray-800 hover:bg-gray-700 text-white font-semibold px-6 py-3 rounded-lg">
            Câu hỏi thường gặp
          </a>
        </div>
        <div className="mt-6 text-xs text-gray-500">
          ✓ Không cần thẻ tín dụng &nbsp;·&nbsp; ✓ Trial 30 ngày &nbsp;·&nbsp; ✓ Huỷ bất cứ lúc nào
        </div>
      </section>

      {/* Plans grid */}
      <section id="gói" className="max-w-7xl mx-auto px-4 py-12 space-y-16">
        {categoryOrder.map(cat => {
          const items = byCategory.get(cat);
          if (!items?.length) return null;
          const label = CATEGORY_LABELS[cat] ?? { title: cat, icon: '📦', desc: '' };
          return (
            <div key={cat}>
              <div className="flex items-baseline gap-3 mb-6">
                <span className="text-3xl">{label.icon}</span>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-white">{label.title}</h2>
                  {label.desc && <p className="text-sm text-gray-500 mt-1">{label.desc}</p>}
                </div>
              </div>
              <div className={`grid gap-4 ${items.length === 1 ? 'md:grid-cols-1 max-w-2xl' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
                {items.map(p => {
                  const features: string[] = JSON.parse(p.features_json || '[]');
                  const featured = p.is_featured === 1;
                  return (
                    <Link key={p.slug} href={`/plans/${p.slug}`}
                      className={`block relative p-6 rounded-2xl transition group ${
                        featured
                          ? 'bg-gradient-to-br from-brand-500/20 to-brand-500/5 border-2 border-brand-500 hover:border-brand-400'
                          : 'bg-gray-900/50 border border-gray-800 hover:border-brand-500/50'
                      }`}>
                      {featured && (
                        <div className="absolute -top-3 left-6 bg-brand-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                          🔥 Bán chạy nhất
                        </div>
                      )}
                      <h3 className="text-lg font-bold text-white mb-2">{p.name}</h3>
                      {p.tagline && <p className="text-xs text-gray-400 mb-4 leading-relaxed">{p.tagline}</p>}
                      <div className="mb-4">
                        <div className={`text-2xl font-black ${featured ? 'text-brand-300' : 'text-white'}`}>{p.price_display}</div>
                        {p.price_note && <div className="text-xs text-gray-500">{p.price_note}</div>}
                      </div>
                      <ul className="space-y-2 text-xs text-gray-300 mb-4">
                        {features.slice(0, 5).map((f, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-brand-400 flex-shrink-0">✓</span>
                            <span>{f}</span>
                          </li>
                        ))}
                        {features.length > 5 && <li className="text-gray-500 italic pl-5">+ {features.length - 5} tính năng khác</li>}
                      </ul>
                      <div className={`text-xs font-semibold ${featured ? 'text-brand-300' : 'text-gray-400'} group-hover:text-brand-400 transition`}>
                        Xem chi tiết + báo giá →
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {plans.length === 0 && (
          <div className="text-center text-gray-500 py-16">
            Đang cập nhật danh sách gói. Liên hệ Zalo để nhận báo giá riêng.
          </div>
        )}
      </section>

      {/* Testimonial band placeholder */}
      <section className="bg-gray-900/50 border-y border-gray-800 py-12">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-4">Đã tin dùng bởi</div>
          <div className="flex gap-8 justify-center items-center flex-wrap opacity-60">
            <div className="text-lg font-bold text-gray-400">Loveintea</div>
            <div className="text-lg font-bold text-gray-400">Bazan Coffee</div>
            <div className="text-lg font-bold text-gray-400">Rootin</div>
            <div className="text-lg font-bold text-gray-400">Gossby</div>
            <div className="text-lg font-bold text-gray-400">Oliva Pilates</div>
            <div className="text-lg font-bold text-gray-400">WhiteLotus</div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-4xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-white mb-8 text-center">Câu hỏi thường gặp</h2>
        <div className="space-y-3">
          {[
            {
              q: 'Trial 30 ngày có thật sự miễn phí không? Có tự động tính tiền sau đó?',
              a: 'Có, miễn phí thật, không cần nhập thẻ. Sau 30 ngày nếu bạn không nâng gói, chỉ mất quyền tạo content mới — data + shop vẫn còn nguyên. Muốn tiếp tục thì chọn gói phù hợp, không tự động charge.',
            },
            {
              q: 'Đội ngũ chuyên gia là ai? Làm việc như thế nào?',
              a: 'Team marketing người Việt, có kinh nghiệm 3-8 năm ngành D2C. Mỗi shop có 1 account manager chính, họp review content plan 1 lần/tháng qua Zalo, duyệt template + tone voice từng tuần. AI thực thi phần sản xuất hàng ngày.',
            },
            {
              q: 'Sao không phải là "full AI" như đối thủ?',
              a: 'AI hiện tại giỏi thực thi (viết, render, đăng), nhưng chưa biết chiến lược thương hiệu. Đối thủ "full AI" thường ra content generic, sai giọng, sai insight thị trường Việt. Chúng tôi giữ chuyên gia người ở tầng plan để đảm bảo mỗi bài đăng có ý nghĩa marketing thật.',
            },
            {
              q: 'Có cam kết kết quả (KPI/reach/leads) không?',
              a: 'Gói tháng có KPI chuẩn ngành (reach, engagement rate, CTR). Không cam kết doanh số — vì phụ thuộc sản phẩm + giá + audience của shop. Chuyên gia sẽ tư vấn kỳ vọng thực tế trước khi ký.',
            },
            {
              q: 'Muốn kết hợp nhiều gói (vd Combo + Brand Identity)?',
              a: 'Được. Thường khách mới sẽ Brand Identity trước (1 lần) rồi vào Combo tháng. Liên hệ Zalo để chốt combo giá tốt.',
            },
            {
              q: 'Data + tài khoản FB/IG của tôi có an toàn?',
              a: 'DB tách per-tenant (mỗi shop 1 file DB riêng), FB/IG dùng Business Portfolio share (KHÔNG share password, revoke bất cứ lúc nào). Backup 3-2-1 (live + on-server + offsite). Chưa từng có sự cố lộ data.',
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

      {/* CTA final */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="bg-gradient-to-br from-brand-500/20 to-brand-500/5 border border-brand-500/40 rounded-3xl p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Chưa chắc gói nào? Chat 15 phút với chuyên gia — miễn phí.
          </h2>
          <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
            Kể qua shop bạn, mục tiêu tháng tới. Chuyên gia sẽ đề xuất gói phù hợp (kể cả gói tuỳ chỉnh nếu cần).
            Không có sales pressure, không cam kết.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <a href="https://zalo.me/hieuduc87" target="_blank" rel="noreferrer"
              className="bg-brand-500 hover:bg-brand-400 text-white font-bold px-8 py-4 rounded-xl">
              💬 Chat Zalo ngay
            </a>
            <a href="/login" className="bg-gray-800 hover:bg-gray-700 text-white font-bold px-8 py-4 rounded-xl">
              🎁 Thử miễn phí 30 ngày
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-800 py-8 text-center text-xs text-gray-600">
        © 2026 Easy Creative Hub · AI + Đội ngũ chuyên gia Marketing cho shop Việt
      </footer>
    </div>
  );
}

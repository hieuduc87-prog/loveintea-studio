/**
 * PUBLIC /plans/[slug] — chi tiết 1 gói + form nhận báo giá.
 * SSR đọc plan từ service_plans. 404 nếu không tồn tại hoặc is_active=0.
 * Form gửi POST /api/leads → tạo card kanban 'sales-lead' cho team follow-up.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { LeadForm } from '@/components/plans/LeadForm';

interface ServicePlanRow {
  slug: string; name: string; category: string; price_display: string; price_note: string;
  tagline: string; features_json: string; billing_type: string;
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  try {
    const p = getDb().prepare('SELECT name, tagline FROM service_plans WHERE slug=? AND is_active=1').get(params.slug) as { name?: string; tagline?: string } | undefined;
    if (!p) return { title: 'Gói không tồn tại — Easy Creative Hub' };
    return {
      title: `${p.name} — Easy Creative Hub`,
      description: p.tagline || `Chi tiết gói ${p.name} + nhận báo giá qua Zalo.`,
    };
  } catch { return { title: 'Easy Creative Hub' }; }
}

export default async function PlanDetailPage({ params }: { params: { slug: string } }) {
  let plan: ServicePlanRow | undefined;
  try {
    plan = getDb().prepare(`SELECT slug, name, category, price_display, price_note, tagline,
      features_json, billing_type FROM service_plans WHERE slug=? AND is_active=1`).get(params.slug) as ServicePlanRow | undefined;
  } catch { /* bảng chưa có */ }
  if (!plan) notFound();

  const features: string[] = JSON.parse(plan.features_json || '[]');
  const isSelfServe = plan.billing_type === 'self-serve-monthly' && plan.category === 'trial';

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/plans" className="text-sm text-gray-400 hover:text-white">← Tất cả gói</Link>
          <a href="/login" className="bg-brand-500 hover:bg-brand-400 text-white text-xs font-semibold px-4 py-2 rounded-lg">Đăng nhập →</a>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-12 grid md:grid-cols-5 gap-8">
        {/* Cột trái — chi tiết gói */}
        <div className="md:col-span-3 space-y-6">
          <div>
            <div className="inline-block bg-brand-500/10 border border-brand-500/30 rounded-full px-3 py-1 text-xs text-brand-300 mb-4">
              {plan.category}
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight">{plan.name}</h1>
            {plan.tagline && <p className="mt-4 text-lg text-gray-400">{plan.tagline}</p>}
          </div>

          {/* Price */}
          <div className="bg-gradient-to-br from-brand-500/20 to-transparent border-2 border-brand-500 rounded-2xl p-6">
            <div className="text-xs text-brand-300 font-semibold uppercase tracking-wider mb-2">💰 Giá</div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-4xl md:text-5xl font-black text-white">{plan.price_display}</span>
              {plan.price_note && <span className="text-lg text-gray-400">{plan.price_note}</span>}
            </div>
            {plan.price_display === 'Liên hệ báo giá' && (
              <p className="text-xs text-gray-500 mt-3">Giá tuỳ nhu cầu shop (số lượng bài, độ phức tạp brand). Điền form bên phải hoặc chat Zalo — báo giá cụ thể trong 30 phút giờ hành chính.</p>
            )}
          </div>

          {/* Features */}
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Gói này gồm:</h2>
            <ul className="space-y-3">
              {features.map((f, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full bg-brand-500/20 border border-brand-500 text-brand-300 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">✓</span>
                  <span className="text-gray-300 leading-relaxed">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Trust signals */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-2 text-sm text-gray-400">
            <div>🇻🇳 <b className="text-white">Team Việt</b> — hiểu ngôn ngữ, insight, văn hoá shop D2C VN</div>
            <div>🔒 <b className="text-white">Data cách ly</b> — DB per-tenant, backup 3-2-1</div>
            <div>💬 <b className="text-white">Support Zalo</b> — trả lời trong 30 phút giờ hành chính</div>
            <div>❌ <b className="text-white">Huỷ bất cứ lúc nào</b> — không lock-in, không phí ẩn</div>
          </div>
        </div>

        {/* Cột phải — form lead + CTA */}
        <div className="md:col-span-2">
          <div className="sticky top-8 space-y-4">
            {isSelfServe ? (
              <div className="bg-brand-500/10 border-2 border-brand-500 rounded-2xl p-6 text-center">
                <div className="text-4xl mb-3">🎁</div>
                <h3 className="text-xl font-bold text-white mb-2">Bắt đầu ngay — miễn phí 30 ngày</h3>
                <p className="text-sm text-gray-400 mb-6">Không cần thẻ. Huỷ lúc nào cũng được. Data giữ nguyên sau khi hết trial.</p>
                <a href="/login"
                  className="block bg-brand-500 hover:bg-brand-400 text-white font-bold py-4 rounded-xl">
                  Tạo shop miễn phí →
                </a>
                <div className="mt-4 text-xs text-gray-500">Đã có tài khoản? <a href="/login" className="text-brand-300 hover:underline">Đăng nhập</a></div>
              </div>
            ) : (
              <div className="bg-gray-900 border border-brand-500/50 rounded-2xl p-6">
                <h3 className="text-xl font-bold text-white mb-2">📞 Nhận báo giá cho shop bạn</h3>
                <p className="text-xs text-gray-500 mb-4">Điền 3 ô, chuyên gia sẽ chat Zalo lại trong 30 phút giờ hành chính (thứ 2-7, 8h-18h). Không sales pressure.</p>
                <LeadForm planSlug={plan.slug} planName={plan.name} />
                <div className="mt-4 pt-4 border-t border-gray-800 text-center">
                  <div className="text-xs text-gray-500 mb-2">Hoặc chat trực tiếp</div>
                  <a href="https://zalo.me/hieuduc87" target="_blank" rel="noreferrer"
                    className="inline-block bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold px-4 py-2 rounded-lg">
                    💬 Chat Zalo ngay →
                  </a>
                </div>
              </div>
            )}

            <a href="/plans" className="block text-center text-xs text-gray-500 hover:text-white py-2">← Xem gói khác</a>
          </div>
        </div>
      </div>

      <footer className="border-t border-gray-800 py-6 text-center text-xs text-gray-600">
        © 2026 Easy Creative Hub · AI + Đội ngũ chuyên gia Marketing
      </footer>
    </div>
  );
}

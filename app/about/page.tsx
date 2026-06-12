/**
 * Public marketing page — no auth required (middleware excludes /about).
 * Purpose: Meta Tech Provider access verification + customers need a public
 * URL that describes the service. Bilingual EN/VI.
 */
export const metadata = {
  title: 'LoveinTea Studio — Social Media Marketing Platform for SMEs',
  description:
    'A closed-loop social media marketing platform: plan, create with AI, publish to Facebook & Instagram, measure results and learn — built for small & medium businesses in Vietnam.',
};

const FEATURES = [
  {
    icon: '🧠',
    title: 'Brand Brain',
    desc: 'Brand DNA, products, audiences and content rules stored once — every piece of content stays on-brand automatically.',
  },
  {
    icon: '✍️',
    title: 'AI Content Studio',
    desc: 'Generate captions and product photography with AI, guided by your brand guidelines and proven content templates.',
  },
  {
    icon: '📡',
    title: 'Publish & Schedule',
    desc: 'Review, approve, schedule and auto-publish posts to your Facebook Page and Instagram Business account.',
  },
  {
    icon: '📊',
    title: 'Measure & Learn',
    desc: 'Post metrics flow back automatically. A scoreboard tells you which content angles to scale and which to retire.',
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-14 text-center">
        <div className="inline-flex items-center gap-2 mb-6">
          <span className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-lg font-bold text-white">L</span>
          <span className="text-lg font-bold tracking-tight">LoveinTea Studio</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-5">
          Social media marketing,<br className="hidden md:block" /> on autopilot for SMEs
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto text-base md:text-lg mb-3">
          A closed-loop marketing platform: <b className="text-gray-200">Strategy → Plan → Create → Publish → Measure → Learn</b>.
          We help small &amp; medium businesses run professional Facebook and Instagram marketing
          with a fraction of the workload, powered by AI and a packaged marketing knowledge system.
        </p>
        <p className="text-gray-500 max-w-2xl mx-auto text-sm mb-8">
          Nền tảng marketing khép kín cho doanh nghiệp vừa và nhỏ: lập kế hoạch, tạo nội dung bằng AI,
          đăng bài Facebook/Instagram tự động, đo lường và tự học từ kết quả.
        </p>
        <div className="flex items-center justify-center gap-3">
          <a href="/login" className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors">
            Sign in to Studio
          </a>
          <a href="mailto:hieuduc87@gmail.com" className="px-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-semibold transition-colors">
            Contact us
          </a>
        </div>
      </section>

      {/* How it works with Meta */}
      <section className="max-w-4xl mx-auto px-6 pb-14">
        <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6 md:p-8">
          <h2 className="text-lg font-bold mb-3">How the platform works with Facebook &amp; Instagram</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            LoveinTea Studio connects to the Meta Graph API on behalf of each client business.
            Clients connect their own Facebook Page and Instagram Business account to the platform.
            The platform then publishes the content they approve, and reads post engagement metrics
            (reach, reactions, comments, saves) to compute a performance scoreboard that guides the
            next content plan. Access tokens are stored encrypted (AES-256-GCM) and each client brand
            is isolated with its own connection and team permissions.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="grid md:grid-cols-4 gap-4">
          {FEATURES.map(f => (
            <div key={f.title} className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5">
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="text-sm font-bold mb-1.5">{f.title}</h3>
              <p className="text-xs text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Business info */}
      <footer className="border-t border-gray-800/60">
        <div className="max-w-4xl mx-auto px-6 py-10 text-center space-y-2">
          <p className="text-sm font-semibold text-gray-300">Operated by Hoa Lang Thang</p>
          <p className="text-xs text-gray-500">
            Technology provider of marketing software services for small &amp; medium businesses in Vietnam.
          </p>
          <p className="text-xs text-gray-500">
            Contact: <a href="mailto:hieuduc87@gmail.com" className="text-emerald-400 hover:underline">hieuduc87@gmail.com</a>
            {' · '}Website: <a href="https://hoalangthang.com" className="text-emerald-400 hover:underline">hoalangthang.com</a>
          </p>
          <p className="text-[11px] text-gray-600 pt-2">© 2026 LoveinTea Studio. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}

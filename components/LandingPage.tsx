'use client';

import { useEffect, useRef } from 'react';

const APP_URL = 'https://app.easycreativehub.com';

const CHIPS = [
  '🤖 AI tạo ảnh', '✍️ AI viết content', '📘 Facebook', '📸 Instagram', '🎬 Video',
  '🗓 Đăng tự động', '📊 Đo lường', '🏆 Tối ưu hiệu quả', '🧠 Brand DNA', '🎯 Template',
  '📦 Đa thương hiệu', '🔁 Tự học',
];

const FEATURES = [
  { icon: '🧠', span: 3, tag: 'Bộ não', title: 'Brand DNA — thương hiệu có trí nhớ', desc: 'Kéo thả tài liệu, playbook, brief của khách — AI tự chắt lọc thành DNA: giọng nói, màu sắc, đối tượng, insight, luật compliance. Mọi nội dung sinh ra đều bám đúng chất thương hiệu.' },
  { icon: '✍️', span: 3, tag: 'Sáng tạo', title: 'AI Content Studio', desc: 'Caption chuẩn ngôn ngữ thị trường, ảnh sản phẩm bám template thắng, carousel nhiều slide theo đúng bố cục — sinh hàng loạt từ content plan, bạn chỉ việc duyệt.' },
  { icon: '🎬', span: 2, title: 'Video Studio', desc: 'AI đọc kho clip, dựng storyboard theo beat nhạc, voiceover đa ngôn ngữ, render tự động.' },
  { icon: '🚀', span: 2, title: 'Đăng tự động FB / IG', desc: 'Scheduler 24/7 đăng đúng giờ vàng theo lịch. Mỗi store một kênh riêng, không lẫn.' },
  { icon: '📊', span: 2, title: 'Đo lường & Scoreboard', desc: 'Metrics tự đồng bộ. Hệ thống chấm SCALE / HOLD / RETIRE cho từng góc content.' },
  { icon: '🔁', span: 4, tag: 'Khép kín', title: 'Learning Loop — càng chạy càng khôn', desc: 'Số liệu bài đăng quay ngược lại nuôi plan tiếp theo: template thắng được ưu tiên, góc yếu bị loại, tri thức chuyên gia áp dụng ngay lập tức. Marketing không còn là đoán.' },
  { icon: '🏬', span: 2, title: 'Multi-brand SaaS', desc: 'Mỗi thương hiệu một không gian riêng biệt tuyệt đối — data, user, kênh, kanban độc lập.' },
];

const STEPS = [
  { n: '01', t: 'Nạp Brand DNA', d: 'Upload tài liệu thương hiệu — AI tự trích xuất chiến lược, đối tượng, giọng điệu.' },
  { n: '02', t: 'AI lên plan & content', d: 'Content plan cả tháng, caption + ảnh + video sinh tự động theo từng ngày.' },
  { n: '03', t: 'Duyệt & xếp lịch', d: 'Kéo thả trên calendar, duyệt hàng loạt. Bài khoá sau khi đăng — an toàn tuyệt đối.' },
  { n: '04', t: 'Đo lường & tự học', d: 'Metrics đổ về, scoreboard chấm điểm, vòng lặp học hỏi tối ưu plan kế tiếp.' },
];

const LOOP_ITEMS = [
  { c: '#8b5cf6', t: 'Strategy', d: 'Brand DNA + audience + USP làm nền cho mọi quyết định.' },
  { c: '#22d3ee', t: 'Plan & Create', d: 'AI sinh plan tháng, content bám template hiệu quả nhất.' },
  { c: '#34d399', t: 'Publish', d: 'Đăng tự động đa kênh, đúng giờ, đúng định dạng.' },
  { c: '#fbbf24', t: 'Measure & Learn', d: 'Số liệu thật quay lại dạy hệ thống — chu kỳ sau tốt hơn chu kỳ trước.' },
];

export function LandingPage() {
  const mockRef = useRef<HTMLDivElement>(null);
  const starsRef = useRef<HTMLCanvasElement>(null);
  const heroRef = useRef<HTMLElement>(null);

  // ── 3D particle depth field (perspective projection, no deps) ──
  useEffect(() => {
    const canvas = starsRef.current;
    if (!canvas || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const DPR = Math.min(2, devicePixelRatio || 1);
    let W = 0, H = 0, raf = 0;
    const F = 320; // focal length
    const COLORS = ['#8b5cf6', '#22d3ee', '#34d399', '#c4b5fd'];
    const P = Array.from({ length: 170 }, () => ({
      x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2, z: Math.random(),
      s: 0.6 + Math.random() * 1.6, c: COLORS[Math.floor(Math.random() * COLORS.length)],
      v: 0.0006 + Math.random() * 0.0018,
    }));
    const resize = () => {
      W = canvas.offsetWidth; H = canvas.offsetHeight;
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of P) {
        p.z -= p.v;                       // bay về phía camera
        if (p.z <= 0.02) { p.z = 1; p.x = (Math.random() - 0.5) * 2; p.y = (Math.random() - 0.5) * 2; }
        const k = F / (F * p.z + 40);     // perspective scale
        const sx = W / 2 + p.x * W * 0.55 * k * p.z;
        const sy = H / 2 + p.y * H * 0.55 * k * p.z;
        const r = Math.max(0.3, p.s * k * 0.55);
        const a = Math.min(0.9, (1 - p.z) * 1.1);
        ctx.globalAlpha = a * 0.85;
        ctx.fillStyle = p.c;
        ctx.shadowColor = p.c; ctx.shadowBlur = r * 4;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  // ── Mouse parallax engine — lerp mượt cho mọi [data-depth] + mockup ──
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const layers = Array.from(document.querySelectorAll<HTMLElement>('[data-depth]'));
    const mock = mockRef.current;
    const onMove = (e: MouseEvent) => {
      tx = (e.clientX / innerWidth - 0.5) * 2;
      ty = (e.clientY / innerHeight - 0.5) * 2;
    };
    const loop = () => {
      cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06; // lerp
      for (const el of layers) {
        const d = parseFloat(el.dataset.depth || '10');
        el.style.transform = `translate3d(${(-cx * d).toFixed(2)}px, ${(-cy * d).toFixed(2)}px, 0)`;
      }
      if (mock) mock.style.transform = `rotateX(${(14 - cy * 7).toFixed(2)}deg) rotateY(${(cx * 8).toFixed(2)}deg)`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('mousemove', onMove); };
  }, []);

  useEffect(() => {
    // Scroll reveal
    const io = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('ech-in'); io.unobserve(e.target); } }),
      { threshold: 0.12 }
    );
    document.querySelectorAll('.ech-reveal').forEach(el => io.observe(el));

    // Counter animation
    const cio = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        cio.unobserve(e.target);
        const el = e.target as HTMLElement;
        const target = parseInt(el.dataset.count || '0');
        const suffix = el.dataset.suffix || '';
        const t0 = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / 1400);
          el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString() + suffix;
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.5 });
    document.querySelectorAll('[data-count]').forEach(el => cio.observe(el));

    return () => { io.disconnect(); cio.disconnect(); };
  }, []);

  return (
    <div className="ech">
      <div className="ech-aurora">
        <div className="ech-blob ech-blob-1" />
        <div className="ech-blob ech-blob-2" />
        <div className="ech-blob ech-blob-3" />
      </div>

      <div className="ech-wrap">
        {/* NAV */}
        <nav className="ech-nav">
          <div className="ech-container ech-nav-inner">
            <div className="ech-logo">
              <div className="ech-logo-mark">⚡</div>
              Easy Creative Hub
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <a className="ech-btn ech-btn-ghost ech-btn-sm" href={`${APP_URL}/login`}>Đăng nhập</a>
              <a className="ech-btn ech-btn-primary ech-btn-sm" href={`${APP_URL}/login`}>Vào Studio →</a>
            </div>
          </div>
        </nav>

        {/* HERO — 3D depth stage */}
        <header className="ech-hero ech-container" ref={heroRef}>
          <canvas className="ech-stars" ref={starsRef} />
          <div className="ech-floor" />
          <div data-depth="4">
            <div className="ech-badge ech-reveal ech-in">✦ Marketing OS thế hệ AI — cho thương hiệu D2C</div>
          </div>
          <div data-depth="7">
            <h1 className="ech-h1 ech-reveal ech-in ech-d1">
              Cỗ máy content chạy bằng AI<br />
              <span className="ech-h1-grad">cho thương hiệu của bạn</span>
            </h1>
          </div>
          <div data-depth="5">
            <p className="ech-sub ech-reveal ech-in ech-d2">
              Gói trọn <b>Strategy → Content → Publish → Learn</b> vào một hệ điều hành duy nhất.
              AI viết caption, tạo ảnh, dựng video, đăng bài đúng giờ và tự học từ số liệu — bạn chỉ việc duyệt.
            </p>
          </div>
          <div className="ech-hero-ctas ech-reveal ech-in ech-d3" data-depth="3">
            <a className="ech-btn ech-btn-primary" href={`${APP_URL}/login`}>Bắt đầu ngay →</a>
            <a className="ech-btn ech-btn-ghost" href="#features">Khám phá tính năng</a>
          </div>

          <div className="ech-stats ech-reveal ech-d4">
            <div className="ech-stat"><div className="ech-stat-num" data-count="390" data-suffix="+">0</div><div className="ech-stat-label">bài đăng đã xuất bản</div></div>
            <div className="ech-stat"><div className="ech-stat-num" data-count="1200" data-suffix="+">0</div><div className="ech-stat-label">visual AI đã tạo</div></div>
            <div className="ech-stat"><div className="ech-stat-num" data-count="24" data-suffix="/7">0</div><div className="ech-stat-label">scheduler tự vận hành</div></div>
            <div className="ech-stat"><div className="ech-stat-num" data-count="1" data-suffix=" nền tảng">0</div><div className="ech-stat-label">thay cả một team content</div></div>
          </div>

          {/* Dashboard mockup — 3D stage với floating glass chips */}
          <div className="ech-mock-stage ech-reveal ech-d3">
            <div className="ech-float" data-depth="22" style={{ top: '-8%', left: '2%', animationDelay: '0s' }}>
              <div className="ech-float-ico" style={{ background: 'rgba(52,211,153,0.18)' }}>📈</div>
              <div>+38% reach<small>7 ngày qua</small></div>
            </div>
            <div className="ech-float" data-depth="30" style={{ top: '12%', right: '-1%', animationDelay: '1.3s' }}>
              <div className="ech-float-ico" style={{ background: 'rgba(139,92,246,0.2)' }}>✨</div>
              <div>128 visuals<small>AI đã tạo tuần này</small></div>
            </div>
            <div className="ech-float" data-depth="26" style={{ bottom: '18%', left: '-3%', animationDelay: '2.2s' }}>
              <div className="ech-float-ico" style={{ background: 'rgba(34,211,238,0.16)' }}>🗓</div>
              <div>Đã lên lịch 21:00<small>tự đăng Facebook + IG</small></div>
            </div>
            <div className="ech-float" data-depth="34" style={{ bottom: '4%', right: '4%', animationDelay: '0.7s' }}>
              <div className="ech-float-ico" style={{ background: 'rgba(251,191,36,0.16)' }}>🏆</div>
              <div>Template #7 → SCALE<small>scoreboard tự chấm</small></div>
            </div>
            <div className="ech-mock" ref={mockRef}>
              <div className="ech-mock-bar">
                <div className="ech-dot" style={{ background: '#ff5f57' }} />
                <div className="ech-dot" style={{ background: '#febc2e' }} />
                <div className="ech-dot" style={{ background: '#28c840' }} />
                <div className="ech-mock-url">app.easycreativehub.com</div>
              </div>
              <div className="ech-mock-body">
                <div className="ech-mock-side">
                  <div className="ech-mock-nav on">🏠 Dashboard</div>
                  <div className="ech-mock-nav">🌿 Brand DNA</div>
                  <div className="ech-mock-nav">📅 Plan & Lịch</div>
                  <div className="ech-mock-nav">✍️ Create Studio</div>
                  <div className="ech-mock-nav">🎬 Video Studio</div>
                  <div className="ech-mock-nav">🚀 Publisher</div>
                  <div className="ech-mock-nav">📊 Analytics</div>
                </div>
                <div className="ech-mock-main">
                  <div className="ech-mock-cards">
                    <div className="ech-mock-kpi"><b style={{ color: '#a78bfa' }}>108</b><span>Đã đăng</span></div>
                    <div className="ech-mock-kpi"><b style={{ color: '#22d3ee' }}>47</b><span>Đã xếp lịch</span></div>
                    <div className="ech-mock-kpi"><b style={{ color: '#34d399' }}>4.8%</b><span>Engagement</span></div>
                    <div className="ech-mock-kpi"><b style={{ color: '#fbbf24' }}>12</b><span>Template thắng</span></div>
                  </div>
                  <div className="ech-mock-chart">
                    {[38, 55, 44, 70, 62, 85, 58, 92, 76, 100, 88, 96].map((h, i) => (
                      <div key={i} className="ech-mock-col" style={{ height: `${h}%`, animationDelay: `${i * 0.07}s` }} />
                    ))}
                  </div>
                  <div className="ech-mock-row">
                    <div className="ech-mock-pill" /><div className="ech-mock-pill" /><div className="ech-mock-pill" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* MARQUEE */}
        <div className="ech-marquee">
          <div className="ech-marquee-track">
            {[...CHIPS, ...CHIPS].map((c, i) => <span key={i} className="ech-chip">{c}</span>)}
          </div>
        </div>

        {/* FEATURES BENTO */}
        <section className="ech-section ech-container" id="features">
          <div className="ech-reveal">
            <span className="ech-kicker">Tính năng</span>
            <h2 className="ech-h2">Một studio marketing hoàn chỉnh, thu gọn trong một tab trình duyệt</h2>
            <p className="ech-lead">Không cần 5 công cụ rời rạc và một team vận hành. Mọi mắt xích — từ chiến lược đến số liệu — sống trong cùng một vòng lặp.</p>
          </div>
          <div className="ech-bento">
            {FEATURES.map((f, i) => (
              <div key={i} className={`ech-card ech-card-${f.span} ech-reveal ech-d${(i % 3) + 1}`}>
                {f.tag && <span className="ech-card-tag">{f.tag}</span>}
                <div className="ech-card-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="ech-section ech-container">
          <div className="ech-reveal">
            <span className="ech-kicker">Quy trình</span>
            <h2 className="ech-h2">Từ tài liệu thô đến bài đăng — 4 bước</h2>
          </div>
          <div className="ech-steps">
            {STEPS.map((s, i) => (
              <div key={i} className={`ech-step ech-reveal ech-d${i + 1}`}>
                <div className="ech-step-glow" />
                <div className="ech-step-num">{s.n}</div>
                <h4>{s.t}</h4>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* LOOP */}
        <section className="ech-section ech-container">
          <div className="ech-loop">
            <div className="ech-reveal">
              <span className="ech-kicker">Vòng lặp khép kín</span>
              <h2 className="ech-h2">Marketing không còn là đoán</h2>
              <div style={{ marginTop: 28 }}>
                {LOOP_ITEMS.map((l, i) => (
                  <div key={i} className="ech-loop-item">
                    <div className="ech-loop-dot" style={{ background: l.c, boxShadow: `0 0 12px ${l.c}` }} />
                    <div><b>{l.t}</b><span>{l.d}</span></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="ech-reveal ech-d2">
              <svg className="ech-loop-svg" viewBox="0 0 400 400" fill="none">
                <defs>
                  <linearGradient id="echRing" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" /><stop offset="50%" stopColor="#22d3ee" /><stop offset="100%" stopColor="#34d399" />
                  </linearGradient>
                </defs>
                <g className="ech-loop-ring">
                  <circle cx="200" cy="200" r="150" stroke="url(#echRing)" strokeWidth="2.5" strokeDasharray="14 10" opacity="0.9" />
                  <circle cx="200" cy="50" r="7" fill="#8b5cf6" />
                  <circle cx="350" cy="200" r="7" fill="#22d3ee" />
                  <circle cx="200" cy="350" r="7" fill="#34d399" />
                  <circle cx="50" cy="200" r="7" fill="#fbbf24" />
                </g>
                <circle cx="200" cy="200" r="105" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
                <text x="200" y="192" textAnchor="middle" fill="#f4f4f6" fontSize="21" fontWeight="800" fontFamily="'Be Vietnam Pro',sans-serif">Học liên tục</text>
                <text x="200" y="218" textAnchor="middle" fill="#a3a3b2" fontSize="12.5" fontFamily="'Be Vietnam Pro',sans-serif">mỗi chu kỳ tốt hơn chu kỳ trước</text>
              </svg>
            </div>
          </div>

          {/* Visual band */}
          <div className="ech-band ech-reveal">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/landing/hero-visual.jpg" alt="Easy Creative Hub — AI visual" loading="lazy" />
            <div className="ech-band-overlay">
              <h3>Visual thương hiệu chuẩn chất lượng quảng cáo</h3>
              <p>AI học từ bộ nhận diện và những mẫu hiệu quả nhất của bạn để tạo hình ảnh đúng chất thương hiệu.</p>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="ech-final">
          <h2 className="ech-reveal">Sẵn sàng vận hành thương hiệu<br />như một studio chuyên nghiệp?</h2>
          <p className="ech-reveal ech-d1">Đăng nhập và cảm nhận sự khác biệt ngay từ bài đăng đầu tiên.</p>
          <div className="ech-final-ctas ech-reveal ech-d2">
            <a className="ech-btn ech-btn-primary" href={`${APP_URL}/login`}>Vào Studio ngay →</a>
            <a className="ech-btn ech-btn-ghost" href="mailto:hieuduc87@gmail.com">Liên hệ hợp tác</a>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="ech-footer">
          <div className="ech-container ech-footer-inner">
            <div className="ech-logo" style={{ fontSize: 14 }}>
              <div className="ech-logo-mark" style={{ width: 24, height: 24, fontSize: 12, borderRadius: 7 }}>⚡</div>
              Easy Creative Hub
            </div>
            <div style={{ display: 'flex', gap: 22 }}>
              <a href={`${APP_URL}/login`}>Đăng nhập</a>
              <a href="https://admin.easycreativehub.com">Quản trị</a>
              <a href="mailto:hieuduc87@gmail.com">Liên hệ</a>
            </div>
            <div>© 2026 Easy Creative Hub · Marketing OS chạy bằng AI</div>
          </div>
        </footer>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';

const LAYOUTS = [
  { id: 'bottom-headline', name: 'Headline đáy', desc: 'Tiêu đề lớn + phụ đề, nền tối gradient. Phổ biến nhất.' },
  { id: 'top-banner',      name: 'Banner đỉnh',  desc: 'Dải màu thương hiệu ở đỉnh, ảnh lộ dưới.' },
  { id: 'center-quote',    name: 'Trích dẫn giữa', desc: 'Quote/khẩu hiệu căn giữa. Hợp testimonial.' },
  { id: 'benefit-list',    name: 'Liệt kê lợi ích', desc: 'Tiêu đề + gạch đầu dòng (ngăn bằng dấu |).' },
  { id: 'promo-badge',     name: 'Khuyến mãi',    desc: 'Badge tròn + CTA. Hợp sale/ra mắt.' },
] as const;

type LayoutId = typeof LAYOUTS[number]['id'];
interface ImgItem { url: string; label?: string }

export function TextOverlayView({ brandId, brandName }: { brandId: string; brandName?: string }) {
  const [base, setBase] = useState('');
  const [layout, setLayout] = useState<LayoutId>('bottom-headline');
  const [headline, setHeadline] = useState('');
  const [sub, setSub] = useState('');
  const [cta, setCta] = useState('');
  const [badge, setBadge] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [result, setResult] = useState('');
  const [err, setErr] = useState('');
  // Carousel ≤5 ảnh (card 80981061) + đưa vào Review & Queue (card ca3a7b94)
  const [carSel, setCarSel] = useState<string[]>([]);
  const [carResults, setCarResults] = useState<string[]>([]);
  type SlideFields = { headline: string; sub: string; cta: string; badge: string };
  const [carSlides, setCarSlides] = useState<SlideFields[]>([]);
  const [carLayout, setCarLayout] = useState<LayoutId>('bottom-headline');
  const [carBaseUrls, setCarBaseUrls] = useState<string[]>([]); // ảnh nền gốc để render lại từng slide
  const [reRendering, setReRendering] = useState<number | null>(null);
  const [pushing, setPushing] = useState(false);
  const [queueMsg, setQueueMsg] = useState('');

  const [gallery, setGallery] = useState<ImgItem[]>([]);
  // Kho ảnh nền để phủ chữ: lấy từ ảnh bài đã tạo + ảnh sản phẩm của brand.
  const loadGallery = useCallback(async () => {
    try {
      const [posts, prods] = await Promise.all([
        fetch(`/api/posts?brand=${brandId}`).then(r => r.json()).catch(() => ({ posts: [] })),
        fetch(`/api/products?brand=${brandId}`).then(r => r.json()).catch(() => ({ products: [] })),
      ]);
      // Bài carousel: lấy ĐỦ mọi ảnh trong images_json, không chỉ ảnh bìa (card 3ba0801d)
      const a: ImgItem[] = (posts.posts || [])
        .flatMap((p: { image_url?: string; images_json?: string }) => {
          let imgs: string[] = [];
          try { const j = JSON.parse(p.images_json || '[]'); if (Array.isArray(j)) imgs = j.map(String); } catch { /* bài thường */ }
          return [p.image_url, ...imgs];
        })
        .filter((u?: string): u is string => Boolean(u && u.includes('/api/images/')))
        .map((u: string) => ({ url: u.split('?')[0] }));
      const b: ImgItem[] = (prods.products || [])
        .map((p: { image_url?: string; name?: string }) => p.image_url ? { url: p.image_url, label: p.name } : null).filter(Boolean);
      const seen = new Set<string>();
      setGallery([...a, ...b].filter(i => i.url && !seen.has(i.url) && seen.add(i.url)).slice(0, 40));
    } catch { /* ignore */ }
  }, [brandId]);
  useEffect(() => { loadGallery(); }, [loadGallery]);

  // Kho ảnh mẫu / reference cho ĐÚNG layout đang chọn (card #2).
  const [refs, setRefs] = useState<{ id: string; image_url: string; layout: string }[]>([]);
  const [refUploading, setRefUploading] = useState(false);
  const loadRefs = useCallback(async () => {
    try {
      const r = await fetch(`/api/content/text-overlay/references?brand=${brandId}&layout=${layout}`);
      const d = await r.json();
      setRefs(d.references || []);
    } catch { setRefs([]); }
  }, [brandId, layout]);
  useEffect(() => { loadRefs(); }, [loadRefs]);

  async function uploadRef(file: File) {
    setRefUploading(true); setErr('');
    try {
      const fd = new FormData();
      fd.append('file', file); fd.append('layout', layout);
      const r = await fetch(`/api/content/text-overlay/references?brand=${brandId}`, { method: 'POST', body: fd });
      const d = await r.json();
      if (r.ok && d.reference) setRefs(prev => [d.reference, ...prev]);
      else setErr(d.error || 'Lỗi upload ảnh mẫu');
    } finally { setRefUploading(false); }
  }
  async function deleteRef(id: string) {
    setRefs(prev => prev.filter(x => x.id !== id));
    await fetch(`/api/content/text-overlay/references?brand=${brandId}&id=${id}`, { method: 'DELETE' });
  }

  async function suggest() {
    setSuggesting(true); setErr('');
    try {
      const r = await fetch(`/api/content/text-overlay/suggest?brand=${brandId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: headline.trim() || undefined }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'Lỗi gợi ý'); return; }
      if (d.layout) setLayout(d.layout);
      setHeadline(d.headline || ''); setSub(d.sub || ''); setCta(d.cta || ''); setBadge(d.badge || '');
    } finally { setSuggesting(false); }
  }

  // TỰ ĐỘNG hoàn toàn: đọc ảnh mẫu (nếu có) → sinh chữ brand đúng bố cục → render, 1 lần.
  async function autoOverlay() {
    if (!base) { setErr('Chọn hoặc dán 1 ảnh nền trước'); return; }
    setBusy(true); setErr(''); setResult('');
    try {
      const r = await fetch(`/api/content/text-overlay/auto?brand=${brandId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseImageUrl: base, layout, brandName }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'Lỗi tự động'); return; }
      if (d.layout) setLayout(d.layout);
      setHeadline(d.headline || ''); setSub(d.sub || ''); setCta(d.cta || ''); setBadge(d.badge || '');
      setResult(d.url);
    } finally { setBusy(false); }
  }

  function toggleCarousel(url: string) {
    setCarSel(prev => prev.includes(url) ? prev.filter(u => u !== url) : (prev.length >= 5 ? prev : [...prev, url]));
  }

  // Carousel: AI viết bộ chữ NỐI TIẾP cho 2-5 ảnh rồi render từng ảnh cùng layout
  async function carouselOverlay() {
    if (carSel.length < 2) { setErr('Chọn ít nhất 2 ảnh cho carousel (bấm dấu + trên ảnh)'); return; }
    setBusy(true); setErr(''); setCarResults([]); setQueueMsg('');
    try {
      const r = await fetch(`/api/content/text-overlay/carousel?brand=${brandId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls: carSel, topic: headline.trim() || undefined, brandName }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'Lỗi tạo carousel'); return; }
      setCarResults(d.urls || []);
      setCarSlides((d.slides || []).map((s: Partial<SlideFields>) => ({ headline: s.headline || '', sub: s.sub || '', cta: s.cta || '', badge: s.badge || '' })));
      setCarLayout((d.layout as LayoutId) || layout);
      setCarBaseUrls([...carSel]);
      setResult('');
    } finally { setBusy(false); }
  }

  // Sửa text 1 slide trong carousel rồi render lại RIÊNG ảnh đó (card 40b556ba —
  // sửa gồm cả xóa hết text/thêm bớt). Giữ nguyên các ảnh còn lại.
  function editSlideField(i: number, field: keyof SlideFields, val: string) {
    setCarSlides(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  }
  async function reRenderSlide(i: number) {
    const f = carSlides[i]; const base = carBaseUrls[i];
    if (!base) { setErr('Không tìm thấy ảnh nền gốc của slide này'); return; }
    setReRendering(i); setErr('');
    try {
      const r = await fetch(`/api/content/text-overlay?brand=${brandId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseImageUrl: base, layout: carLayout, headline: f.headline, sub: f.sub, cta: f.cta, badge: f.badge, brandName }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'Lỗi render lại ảnh'); return; }
      setCarResults(prev => prev.map((u, idx) => idx === i ? `${d.url}?t=${Date.now()}` : u));
    } finally { setReRendering(null); }
  }

  // Đưa thành phẩm vào Review & Queue thành bài draft — bấm Schedule ở đó
  async function pushToQueue(urls: string[], caption: string) {
    if (!urls.length) return;
    setPushing(true); setQueueMsg('');
    try {
      const r = await fetch(`/api/posts?brand=${brandId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption,
          imageUrl: urls[0],
          ...(urls.length > 1 ? { imagesJson: urls } : {}),
          platforms: 'facebook,instagram',
          notes: 'Tạo từ Chữ lên ảnh',
        }),
      });
      const d = await r.json() as { ok?: boolean; id?: string; error?: string };
      setQueueMsg(d.ok ? `✓ Đã tạo bài nháp${urls.length > 1 ? ` carousel ${urls.length} ảnh` : ''} — mở tab Review & Queue để duyệt/Schedule` : `✗ ${d.error || 'Lỗi tạo bài'}`);
    } catch (e) { setQueueMsg(`✗ ${String(e)}`); }
    finally { setPushing(false); }
  }

  async function render() {
    if (!base) { setErr('Chọn hoặc dán 1 ảnh nền trước'); return; }
    setBusy(true); setErr(''); setResult('');
    try {
      const r = await fetch(`/api/content/text-overlay?brand=${brandId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseImageUrl: base, layout, headline, sub, cta, badge, brandName }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'Lỗi render'); return; }
      setResult(d.url);
    } finally { setBusy(false); }
  }

  const cur = LAYOUTS.find(l => l.id === layout)!;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-white">Tạo chữ lên ảnh (Text on Image)</h1>
        <p className="text-sm text-gray-400 mt-1">Phủ tiêu đề/khẩu hiệu lên ảnh sản phẩm — chữ nét, đúng dấu tiếng Việt (render bằng bố cục, không để AI vẽ chữ méo).</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-6">
        {/* LEFT: controls */}
        <div className="space-y-4">
          {/* layout picker = list kiểu mẫu */}
          <div>
            <div className="text-sm font-semibold text-white mb-2">1. Chọn kiểu (layout)</div>
            <div className="grid grid-cols-2 gap-2">
              {LAYOUTS.map(l => (
                <button key={l.id} onClick={() => setLayout(l.id)}
                  className={`text-left p-3 rounded-lg border ${layout === l.id ? 'border-brand-500 bg-brand-600/15' : 'border-gray-800 bg-gray-900 hover:border-gray-700'}`}>
                  <div className="text-sm font-semibold text-white">{l.name}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">{l.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Kho ảnh mẫu / reference cho ĐÚNG kiểu đang chọn */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-white">Ảnh mẫu cho kiểu «{cur.name}»</div>
              <label className={`text-xs px-3 py-1.5 rounded-lg cursor-pointer font-medium ${refUploading ? 'bg-gray-700 text-gray-400' : 'bg-brand-600/20 border border-brand-600/40 text-brand-200 hover:bg-brand-600/30'}`}>
                {refUploading ? '⟳ Đang tải…' : '⬆ Upload ảnh mẫu'}
                <input type="file" accept="image/*" className="hidden" disabled={refUploading}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadRef(f); e.currentTarget.value = ''; }} />
              </label>
            </div>
            <p className="text-[11px] text-gray-500 mb-2">Tải post đẹp thật lên làm mẫu — nhân viên xem để chọn phong cách &amp; căn chỉnh bố cục cho kiểu này.</p>
            {refs.length ? (
              <div className="grid grid-cols-4 gap-1.5">
                {refs.map(r => (
                  <div key={r.id} className="relative group aspect-[4/5] rounded-lg overflow-hidden border border-gray-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <a href={r.image_url} target="_blank" rel="noreferrer"><img src={`${r.image_url}?w=200`} alt="mẫu" className="w-full h-full object-cover" /></a>
                    <button onClick={() => deleteRef(r.id)} title="Xoá"
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-600 border border-dashed border-gray-800 rounded-lg py-4 text-center">Chưa có ảnh mẫu cho kiểu này — bấm «Upload ảnh mẫu» để thêm.</div>
            )}
          </div>

          {/* base image */}
          <div>
            <div className="text-sm font-semibold text-white mb-2">2. Ảnh nền</div>
            <input value={base} onChange={e => setBase(e.target.value)} placeholder="Dán link ảnh (/api/images/…) hoặc chọn bên dưới"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white mb-2" />
            <div className="grid grid-cols-5 gap-1.5 max-h-44 overflow-y-auto">
              {gallery.map((g, i) => {
                const pos = carSel.indexOf(g.url);
                return (
                  <div key={i} onClick={() => setBase(g.url)} role="button" tabIndex={0}
                    className={`relative group aspect-[4/5] rounded overflow-hidden border-2 cursor-pointer ${base === g.url ? 'border-brand-500' : 'border-transparent'}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`${g.url}?w=160`} alt="" className="w-full h-full object-cover" />
                    <span onClick={e => { e.stopPropagation(); toggleCarousel(g.url); }} role="button"
                      title={pos >= 0 ? 'Bỏ khỏi carousel' : 'Thêm vào carousel (≤5 ảnh)'}
                      className={`absolute top-1 right-1 w-5 h-5 rounded-full grid place-items-center text-[11px] font-bold transition-opacity ${pos >= 0 ? 'bg-brand-500 text-white' : 'bg-black/60 text-white opacity-0 group-hover:opacity-100'}`}>
                      {pos >= 0 ? pos + 1 : '+'}
                    </span>
                  </div>
                );
              })}
              {!gallery.length && <div className="col-span-5 text-xs text-gray-600 py-4 text-center">Chưa có ảnh — tạo ảnh ở Create Studio trước, hoặc dán link.</div>}
            </div>
            {carSel.length > 0 && (
              <div className="mt-2 flex items-center justify-between gap-2 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-400">🎠 Carousel: <span className="text-white font-medium">{carSel.length}/5 ảnh</span> — thứ tự theo số trên ảnh. Ghi chủ đề vào ô tiêu đề (tuỳ chọn) rồi bấm tạo.</p>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => { setCarSel([]); setCarResults([]); }} className="text-xs text-gray-500 hover:text-white">Bỏ chọn</button>
                  <button onClick={carouselOverlay} disabled={busy || carSel.length < 2}
                    className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium">
                    {busy ? '⟳ Đang tạo…' : `🎠 Tạo chữ nối tiếp ${carSel.length} ảnh`}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* text fields */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white">3. Nội dung chữ</div>
              <button onClick={suggest} disabled={suggesting}
                className="text-xs px-3 py-1.5 rounded-lg bg-brand-600/20 border border-brand-600/40 text-brand-200 hover:bg-brand-600/30 disabled:opacity-50 font-medium">
                {suggesting ? '⟳ AI đang nghĩ…' : '✨ AI gợi ý chữ (theo brand)'}
              </button>
            </div>
            <p className="text-[11px] text-gray-500 -mt-1">Gõ ý chính vào ô tiêu đề (tuỳ chọn) rồi bấm gợi ý — AI đề xuất kiểu + tiêu đề/CTA đúng chất brand.</p>
            <input value={headline} onChange={e => setHeadline(e.target.value)} placeholder="Tiêu đề chính (bắt buộc)"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
            <input value={sub} onChange={e => setSub(e.target.value)}
              placeholder={layout === 'benefit-list' ? 'Lợi ích, ngăn bằng dấu | (vd: Ngủ ngon | Thư giãn | 0 calo)' : layout === 'center-quote' ? 'Tên người nói (tuỳ chọn)' : 'Phụ đề (tuỳ chọn)'}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
            {(layout === 'top-banner' || layout === 'benefit-list' || layout === 'promo-badge') && (
              <input value={cta} onChange={e => setCta(e.target.value)} placeholder="Nút CTA (vd: Mua ngay)"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
            )}
            {layout === 'promo-badge' && (
              <input value={badge} onChange={e => setBadge(e.target.value)} placeholder="Badge tròn (vd: MỚI, -20%)"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
            )}
          </div>

          <button onClick={autoOverlay} disabled={busy || !base}
            className="w-full bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-lg">
            {busy ? 'Đang xử lý…' : '🤖 Tự động chèn chữ (đọc ảnh mẫu → tự viết → phủ)'}
          </button>
          <button onClick={render} disabled={busy || !base || !headline}
            className="w-full bg-brand-600/80 hover:bg-brand-500 disabled:opacity-50 text-white font-medium text-sm py-2 rounded-lg">
            {busy ? 'Đang render…' : `Hoặc render tay (${cur.name})`}
          </button>
          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>

        {/* RIGHT: preview */}
        <div>
          <div className="text-sm font-semibold text-white mb-2">Kết quả</div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 grid place-items-center min-h-[420px]">
            {carResults.length ? (
              <div className="w-full">
                <p className="text-[11px] text-gray-500 mb-2">Sửa chữ từng ảnh (xoá hết cũng được) rồi bấm «Render lại ảnh này». Xong đưa cả bộ sang Review & Queue.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {carResults.map((u, i) => (
                    <div key={i} className="bg-gray-800/40 border border-gray-800 rounded-lg p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt={`slide ${i + 1}`} className="rounded-lg w-full" />
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[11px] text-gray-400 font-medium">Ảnh {i + 1}</span>
                        <a href={u} download className="text-[11px] text-brand-400 hover:underline">⬇ Tải</a>
                      </div>
                      {carSlides[i] && (
                        <div className="space-y-1 mt-1.5">
                          <input value={carSlides[i].headline} onChange={e => editSlideField(i, 'headline', e.target.value)} placeholder="Tiêu đề (để trống = không chữ)"
                            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[11px] text-white" />
                          <input value={carSlides[i].sub} onChange={e => editSlideField(i, 'sub', e.target.value)} placeholder={carLayout === 'benefit-list' ? 'Lợi ích, ngăn bằng |' : 'Phụ đề'}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[11px] text-white" />
                          {(carLayout === 'top-banner' || carLayout === 'benefit-list' || carLayout === 'promo-badge') && (
                            <input value={carSlides[i].cta} onChange={e => editSlideField(i, 'cta', e.target.value)} placeholder="CTA"
                              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[11px] text-white" />
                          )}
                          {carLayout === 'promo-badge' && (
                            <input value={carSlides[i].badge} onChange={e => editSlideField(i, 'badge', e.target.value)} placeholder="Badge"
                              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[11px] text-white" />
                          )}
                          <button onClick={() => reRenderSlide(i)} disabled={reRendering !== null}
                            className="w-full py-1 rounded bg-brand-600/80 hover:bg-brand-500 disabled:opacity-50 text-white text-[11px] font-medium">
                            {reRendering === i ? '⟳ Đang render…' : '🔄 Render lại ảnh này'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={() => pushToQueue(carResults.map(u => u.split('?')[0]), carSlides.map(s => [s.headline, s.sub].filter(Boolean).join(' — ')).filter(Boolean).join('\n'))}
                  disabled={pushing || reRendering !== null}
                  className="w-full mt-3 py-2 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-medium">
                  {pushing ? '⟳ Đang tạo bài…' : `➕ Đưa carousel ${carResults.length} ảnh vào Review & Queue`}
                </button>
                {queueMsg && <p className={`text-xs mt-2 text-center ${queueMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{queueMsg}</p>}
              </div>
            ) : result ? (
              <div className="text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result} alt="result" className="max-h-[540px] rounded-lg mx-auto" />
                <div className="flex items-center justify-center gap-4 mt-3">
                  <a href={result} download className="text-xs text-brand-400 hover:underline">⬇ Tải ảnh</a>
                  <button onClick={() => pushToQueue([result], [headline, sub].filter(Boolean).join('\n'))} disabled={pushing}
                    className="text-xs px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-medium">
                    {pushing ? '⟳ Đang tạo bài…' : '➕ Đưa vào Review & Queue'}
                  </button>
                </div>
                {queueMsg && <p className={`text-xs mt-2 ${queueMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{queueMsg}</p>}
              </div>
            ) : base ? (
              <div className="text-center text-gray-600 text-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${base}?w=400`} alt="base" className="max-h-[420px] rounded-lg mx-auto opacity-60" />
                <p className="mt-2">Nhập chữ + bấm Tạo để phủ lên ảnh này</p>
              </div>
            ) : <div className="text-gray-600 text-sm">Chọn ảnh nền + kiểu + nhập chữ</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

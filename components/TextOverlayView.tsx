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

  const [gallery, setGallery] = useState<ImgItem[]>([]);
  // Kho ảnh nền để phủ chữ: lấy từ ảnh bài đã tạo + ảnh sản phẩm của brand.
  const loadGallery = useCallback(async () => {
    try {
      const [posts, prods] = await Promise.all([
        fetch(`/api/posts?brand=${brandId}`).then(r => r.json()).catch(() => ({ posts: [] })),
        fetch(`/api/products?brand=${brandId}`).then(r => r.json()).catch(() => ({ products: [] })),
      ]);
      const a: ImgItem[] = (posts.posts || [])
        .map((p: { image_url?: string }) => p.image_url).filter((u: string) => u && u.includes('/api/images/'))
        .map((u: string) => ({ url: u.split('?')[0] }));
      const b: ImgItem[] = (prods.products || [])
        .map((p: { image_url?: string; name?: string }) => p.image_url ? { url: p.image_url, label: p.name } : null).filter(Boolean);
      const seen = new Set<string>();
      setGallery([...a, ...b].filter(i => i.url && !seen.has(i.url) && seen.add(i.url)).slice(0, 30));
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
              {gallery.map((g, i) => (
                <button key={i} onClick={() => setBase(g.url)}
                  className={`aspect-[4/5] rounded overflow-hidden border-2 ${base === g.url ? 'border-brand-500' : 'border-transparent'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${g.url}?w=160`} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
              {!gallery.length && <div className="col-span-5 text-xs text-gray-600 py-4 text-center">Chưa có ảnh — tạo ảnh ở Create Studio trước, hoặc dán link.</div>}
            </div>
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
            {result ? (
              <div className="text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result} alt="result" className="max-h-[540px] rounded-lg mx-auto" />
                <a href={result} download className="inline-block mt-3 text-xs text-brand-400 hover:underline">⬇ Tải ảnh</a>
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

'use client';

/**
 * CreateLab — sandbox để thử content (thủ công hoặc AI), xem preview hiển thị
 * trên FB/IG (cấp post + cấp wall), rồi thêm vào lịch.
 */

import { useCallback, useEffect, useState } from 'react';

interface Product { id: string; name: string; color?: string; image_url?: string }
interface Variant { caption: string; hashtags: string; image_prompt: string; targeting?: Record<string, string> }

const BRAND_NAME = 'Loveintea Offical';

export function CreateLabView({ brandId }: { brandId: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [mode, setMode] = useState<'manual' | 'ai'>('ai');
  const [surface, setSurface] = useState<'post' | 'wall'>('post');
  const [platform, setPlatform] = useState<'fb' | 'ig'>('fb');

  // composer (2-4 fields)
  const [productId, setProductId] = useState('');
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState('');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const [variants, setVariants] = useState<Variant[]>([]);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [schedAt, setSchedAt] = useState('');

  const load = useCallback(async () => {
    const r = await fetch(`/api/products?brand=${brandId}`).catch(() => null);
    if (r?.ok) setProducts(((await r.json()).products ?? []) as Product[]);
  }, [brandId]);
  useEffect(() => { load(); }, [load]);

  async function aiGenerate() {
    if (!message.trim()) { setMsg('Nhập ý chính trước'); return; }
    setBusy('ai'); setMsg('');
    try {
      const r = await fetch('/api/content/quick', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, productId: productId || undefined, message, tone: tone || undefined, n: 3 }),
      });
      const d = await r.json() as { ok?: boolean; variants?: Variant[]; error?: string };
      if (d.ok && d.variants?.length) {
        setVariants(d.variants);
        applyVariant(d.variants[0]);
        setMsg(`✓ ${d.variants.length} biến thể — tự suy giọng/đối tượng/USP từ DNA`);
      } else setMsg('✗ ' + (d.error ?? 'Lỗi'));
    } catch (e) { setMsg('✗ ' + String(e)); }
    setBusy('');
  }
  function applyVariant(v: Variant) { setCaption(v.caption); setHashtags(v.hashtags); setImagePrompt(v.image_prompt); }

  async function genImage() {
    const p = imagePrompt || caption.slice(0, 200);
    if (!p) { setMsg('Cần image prompt hoặc caption'); return; }
    setBusy('img'); setMsg('');
    try {
      const r = await fetch('/api/image/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: p, productId: productId || undefined, brandId }),
      });
      const d = await r.json() as { ok?: boolean; url?: string; error?: string };
      if (d.ok && d.url) setImageUrl(d.url); else setMsg('✗ ' + (d.error ?? 'Lỗi tạo ảnh'));
    } catch (e) { setMsg('✗ ' + String(e)); }
    setBusy('');
  }

  async function addToCalendar() {
    if (!caption.trim()) { setMsg('Cần caption'); return; }
    setBusy('add'); setMsg('');
    try {
      const r = await fetch('/api/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, skuId: productId, caption: caption + (hashtags ? `\n\n${hashtags}` : ''), imageUrl, imagePrompt, platforms: 'facebook,instagram', notes: 'CreateLab' }),
      });
      const d = await r.json() as { id?: string; ok?: boolean };
      if (d.ok && d.id && schedAt) {
        await fetch(`/api/posts/${d.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scheduled_at: new Date(schedAt).toISOString(), status: 'scheduled' }) });
      }
      setMsg('✓ Đã thêm vào lịch (Plan & Lịch / Review & Queue)');
    } catch (e) { setMsg('✗ ' + String(e)); }
    setBusy('');
  }

  const fullCaption = caption + (hashtags ? `\n\n${hashtags}` : '');

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-lg font-semibold text-white">🧪 CreateLab</h2>
        <span className="text-xs text-gray-500">Thử content → xem hiển thị FB/IG → thêm vào lịch</span>
        <div className="ml-auto flex items-center gap-1 bg-gray-800 rounded-lg p-0.5">
          {(['ai', 'manual'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} className={`px-3 py-1 rounded-md text-xs font-medium ${mode === m ? 'bg-brand-600 text-white' : 'text-gray-400'}`}>
              {m === 'ai' ? '✨ Thử nghiệm (AI)' : '✍️ Thủ công'}
            </button>
          ))}
        </div>
      </div>
      {msg && <p className={`text-xs ${msg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>{msg}</p>}

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Composer */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 space-y-2.5">
          <select value={productId} onChange={e => setProductId(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white">
            <option value="">— Sản phẩm (tùy chọn) —</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          {mode === 'ai' ? (
            <>
              <input value={message} onChange={e => setMessage(e.target.value)} placeholder="Ý chính (vd: nhắc khách uống trà thư giãn tối Chủ nhật)"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white" />
              <input value={tone} onChange={e => setTone(e.target.value)} placeholder="Tông (tùy chọn: ấm áp / hài / sang…)"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white" />
              <button onClick={aiGenerate} disabled={busy === 'ai'} className="w-full py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-bold">
                {busy === 'ai' ? '⟳ AI đang viết…' : '✨ Tạo nhanh (auto-detect từ DNA)'}
              </button>
              <p className="text-[10px] text-gray-600">Chỉ cần 2-4 trường — giọng, đối tượng, USP, compliance tự suy từ Brand DNA + tri thức.</p>
              {variants.length > 1 && (
                <div className="flex gap-1 flex-wrap">
                  {variants.map((v, i) => (
                    <button key={i} onClick={() => applyVariant(v)} className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-[10px] text-gray-300">Biến thể {i + 1}</button>
                  ))}
                </div>
              )}
            </>
          ) : null}

          <textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="Caption" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white resize-none h-28" />
          <input value={hashtags} onChange={e => setHashtags(e.target.value)} placeholder="#hashtags" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white" />
          <div className="flex gap-2">
            <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="Ảnh URL (hoặc tạo AI)" className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white" />
            <button onClick={genImage} disabled={busy === 'img'} className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs disabled:opacity-50">{busy === 'img' ? '⟳' : '🖼 Tạo ảnh'}</button>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-gray-800">
            <input type="datetime-local" value={schedAt} onChange={e => setSchedAt(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white" />
            <button onClick={addToCalendar} disabled={busy === 'add'} className="flex-1 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold">📅 Thêm vào lịch</button>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-0.5">
              {(['fb', 'ig'] as const).map(pf => (
                <button key={pf} onClick={() => setPlatform(pf)} className={`px-3 py-1 rounded-md text-xs font-medium ${platform === pf ? 'bg-brand-600 text-white' : 'text-gray-400'}`}>{pf === 'fb' ? '📘 Facebook' : '📸 Instagram'}</button>
              ))}
            </div>
            <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-0.5 ml-auto">
              {(['post', 'wall'] as const).map(s => (
                <button key={s} onClick={() => setSurface(s)} className={`px-3 py-1 rounded-md text-xs font-medium ${surface === s ? 'bg-brand-600 text-white' : 'text-gray-400'}`}>{s === 'post' ? 'Cấp post' : 'Cấp wall'}</button>
              ))}
            </div>
          </div>

          <div className={`bg-gray-100 rounded-lg overflow-hidden ${surface === 'wall' ? 'p-2 space-y-2' : ''}`}>
            {surface === 'wall' && <div className="bg-white rounded-lg p-3 text-gray-400 text-xs">Bài khác trên tường…</div>}
            {platform === 'fb'
              ? <FbCard caption={fullCaption} imageUrl={imageUrl} />
              : <IgCard caption={fullCaption} imageUrl={imageUrl} />}
            {surface === 'wall' && <div className="bg-white rounded-lg p-3 text-gray-400 text-xs">Bài khác trên tường…</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function FbCard({ caption, imageUrl }: { caption: string; imageUrl: string }) {
  return (
    <div className="bg-white text-gray-900">
      <div className="flex items-center gap-2 p-3">
        <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-white text-sm font-bold">L</div>
        <div><p className="text-sm font-semibold leading-tight">{BRAND_NAME}</p><p className="text-[11px] text-gray-500">Vừa xong · 🌐</p></div>
      </div>
      {caption && <p className="px-3 pb-2 text-sm whitespace-pre-wrap">{caption}</p>}
      {imageUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={imageUrl} alt="" className="w-full object-cover max-h-[420px]" />}
      <div className="flex items-center justify-around border-t border-gray-200 py-1.5 text-gray-500 text-xs">
        <span>👍 Thích</span><span>💬 Bình luận</span><span>↪ Chia sẻ</span>
      </div>
    </div>
  );
}

function IgCard({ caption, imageUrl }: { caption: string; imageUrl: string }) {
  return (
    <div className="bg-white text-gray-900">
      <div className="flex items-center gap-2 p-2.5">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 to-pink-600 p-0.5"><div className="w-full h-full rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold">L</div></div>
        <p className="text-sm font-semibold">loveintea.official</p>
      </div>
      {imageUrl
        ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={imageUrl} alt="" className="w-full aspect-square object-cover" />
        : <div className="w-full aspect-square bg-gray-200 flex items-center justify-center text-gray-400 text-xs">Ảnh sẽ hiển thị ở đây</div>}
      <div className="flex items-center gap-3 p-2.5 text-lg">❤️ 💬 ✈️</div>
      {caption && <p className="px-2.5 pb-3 text-sm"><span className="font-semibold">loveintea.official</span> <span className="whitespace-pre-wrap">{caption}</span></p>}
    </div>
  );
}

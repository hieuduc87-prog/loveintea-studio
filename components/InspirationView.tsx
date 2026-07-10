'use client';

/**
 * Nguồn học — theo dõi page/IG/TikTok đối thủ, nạp video/post của họ (link công khai
 * hoặc upload file), AI phân tích → bài học + khuôn (recipe) tái dùng cho video mới
 * và cho Lịch video định kỳ.
 */

import { useCallback, useEffect, useState } from 'react';

interface Source { id: string; platform: string; name: string; url: string; notes: string; item_count: number }
interface Item {
  id: string; source_id: string | null; source_name: string | null; url: string | null;
  media_type: string; filename: string | null; caption: string | null; status: string;
  analysis_json: string; recipe_json: string; learnings: string; error: string | null; created_at: string;
}

const PLATFORM_ICON: Record<string, string> = { instagram: '📸', facebook: '📘', tiktok: '🎵', youtube: '▶️', other: '🌐' };

export function InspirationView({ brandId }: { brandId: string }) {
  const [sources, setSources] = useState<Source[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string>('');
  // form nguồn
  const [srcPlatform, setSrcPlatform] = useState('instagram');
  const [srcName, setSrcName] = useState('');
  const [srcUrl, setSrcUrl] = useState('');
  // form item
  const [itemUrl, setItemUrl] = useState('');
  const [itemCaption, setItemCaption] = useState('');
  const [itemSourceId, setItemSourceId] = useState('');
  const [creatingVideoFor, setCreatingVideoFor] = useState('');
  // bulk paste (nhân viên dán nhiều link 1 lúc — lưu hết)
  const [bulkUrls, setBulkUrls] = useState('');
  const [bulkAnalyze, setBulkAnalyze] = useState(false);

  const load = useCallback(async () => {
    try {
      const [sr, ir] = await Promise.all([
        fetch(`/api/inspiration/sources?brandId=${brandId}`),
        fetch(`/api/inspiration/items?brandId=${brandId}`),
      ]);
      setSources(((await sr.json()).sources ?? []) as Source[]);
      setItems(((await ir.json()).items ?? []) as Item[]);
    } catch { /* keep */ }
  }, [brandId]);
  useEffect(() => { load(); }, [load]);

  // Poll khi có item đang tải/phân tích (kể cả hàng đợi bulk: item 'new' chờ tới lượt)
  useEffect(() => {
    const busy = items.some(i => i.status === 'downloading' || i.status === 'analyzing' || (i.status === 'new' && i.url));
    if (!busy) return;
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [items, load]);

  async function bulkSave() {
    if (!bulkUrls.trim()) { setMsg('❌ Dán ít nhất 1 link (mỗi dòng 1 link)'); return; }
    setBusy(true); setMsg('');
    const r = await fetch('/api/inspiration/items/bulk', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId, urls: bulkUrls, sourceId: itemSourceId || undefined, analyze: bulkAnalyze }),
    });
    const d = await r.json() as { ok?: boolean; message?: string; error?: string };
    if (!d.ok) setMsg('❌ ' + (d.error ?? 'Lỗi'));
    else { setMsg('✅ ' + (d.message ?? 'Đã nhận, đang lưu lần lượt')); setBulkUrls(''); await load(); }
    setBusy(false);
  }

  async function addSource() {
    if (!srcName.trim() && !srcUrl.trim()) { setMsg('❌ Nhập tên hoặc link nguồn'); return; }
    const r = await fetch('/api/inspiration/sources', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId, platform: srcPlatform, name: srcName, url: srcUrl }),
    });
    const d = await r.json() as { ok?: boolean; error?: string };
    if (!d.ok) setMsg('❌ ' + (d.error ?? 'Lỗi'));
    else { setMsg('✅ Đã thêm nguồn'); setSrcName(''); setSrcUrl(''); await load(); }
  }

  async function addItem() {
    if (!itemUrl.trim() && !itemCaption.trim()) { setMsg('❌ Dán link video hoặc caption để học'); return; }
    setBusy(true);
    const r = await fetch('/api/inspiration/items', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId, url: itemUrl || undefined, caption: itemCaption || undefined, sourceId: itemSourceId || undefined }),
    });
    const d = await r.json() as { ok?: boolean; id?: string; error?: string };
    if (!d.ok) setMsg('❌ ' + (d.error ?? 'Lỗi'));
    else {
      setMsg('✅ Đã thêm — bấm 🧠 Phân tích để AI học');
      setItemUrl(''); setItemCaption('');
      await load();
      if (d.id) analyze(d.id); // tự chạy phân tích luôn
    }
    setBusy(false);
  }

  async function uploadItem(file: File) {
    setBusy(true); setMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file); fd.append('brandId', brandId);
      if (itemSourceId) fd.append('sourceId', itemSourceId);
      if (itemCaption) fd.append('caption', itemCaption);
      const r = await fetch('/api/inspiration/items', { method: 'POST', body: fd });
      const d = await r.json() as { ok?: boolean; id?: string; error?: string };
      if (!d.ok) setMsg('❌ ' + (d.error ?? 'Upload lỗi'));
      else { setMsg('✅ Đã upload — AI đang phân tích…'); setItemCaption(''); await load(); if (d.id) analyze(d.id); }
    } catch (e) { setMsg('❌ ' + String(e)); }
    setBusy(false);
  }

  async function analyze(id: string) {
    await fetch(`/api/inspiration/items/${id}/analyze`, { method: 'POST' });
    await load();
  }

  async function removeItem(id: string) {
    if (!confirm('Xóa item này?')) return;
    await fetch(`/api/inspiration/items?id=${id}`, { method: 'DELETE' });
    await load();
  }
  async function removeSource(id: string) {
    if (!confirm('Xóa nguồn này? (Các item đã phân tích vẫn giữ)')) return;
    await fetch(`/api/inspiration/sources?id=${id}`, { method: 'DELETE' });
    await load();
  }

  /** Tạo video project mới theo khuôn item đã phân tích. */
  async function createVideoFromItem(item: Item) {
    setCreatingVideoFor(item.id); setMsg('');
    try {
      const r = await fetch('/api/video/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, purpose: 'promo', targetDurationS: 20, useVoiceover: true, inspirationItemId: item.id }),
      });
      const d = await r.json() as { ok?: boolean; error?: string; recipe?: { scenes: number } | null };
      if (!d.ok) setMsg('❌ ' + (d.error ?? 'Tạo video thất bại'));
      else setMsg(`✅ Đã dựng storyboard theo khuôn${d.recipe ? ` (${d.recipe.scenes} cảnh)` : ''} — sang tab Video Studio để render.`);
    } catch (e) { setMsg('❌ ' + String(e)); }
    setCreatingVideoFor('');
  }

  const statusBadge = (s: string) => ({
    new: 'bg-gray-700 text-gray-300', downloading: 'bg-sky-600/30 text-sky-300 animate-pulse',
    saved: 'bg-teal-600/30 text-teal-300',
    analyzing: 'bg-amber-600/30 text-amber-300 animate-pulse', analyzed: 'bg-emerald-600/30 text-emerald-300',
    failed: 'bg-red-600/30 text-red-300',
  }[s] ?? 'bg-gray-700 text-gray-300');
  const statusLabel: Record<string, string> = { new: 'chờ lưu', downloading: 'đang tải', saved: 'đã lưu video', analyzing: 'AI đang học', analyzed: 'đã học xong', failed: 'lỗi' };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h2 className="text-sm font-bold text-white">🕵️ Nguồn học — sao chép công thức thắng của đối thủ</h2>
        <p className="text-[11px] text-gray-500 mt-1">Dán link Reels/TikTok/YouTube công khai (hoặc upload file) → AI phân tích cấu trúc cảnh, nhịp cắt, hook, caption → thành <b>khuôn</b> để dựng video của bạn (dùng ở Video Studio hoặc gắn vào Lịch định kỳ).</p>
      </div>
      {msg && <p className={`text-xs ${msg.startsWith('✅') ? 'text-emerald-400' : 'text-red-400'}`}>{msg}</p>}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* ── Sources ── */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 space-y-3">
          <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wide">📡 Trang đang theo dõi ({sources.length})</h3>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {sources.map(s => (
              <div key={s.id} className="rounded-lg bg-gray-800/50 border border-gray-700/40 p-2.5 flex items-center gap-2">
                <span>{PLATFORM_ICON[s.platform] ?? '🌐'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-white truncate">{s.name || s.url}</p>
                  {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="text-[9px] text-sky-400 truncate block">{s.url}</a>}
                  <p className="text-[9px] text-gray-500">{s.item_count} bài đã nạp</p>
                </div>
                <button onClick={() => removeSource(s.id)} className="text-gray-600 hover:text-red-400 text-xs">✕</button>
              </div>
            ))}
            {sources.length === 0 && <p className="text-[11px] text-gray-600 text-center py-2">Thêm page/kênh đối thủ hoặc kênh bạn ngưỡng mộ.</p>}
          </div>
          <div className="space-y-2 border-t border-gray-800 pt-3">
            <div className="flex gap-2">
              <select value={srcPlatform} onChange={e => setSrcPlatform(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-xs text-white">
                <option value="instagram">📸 IG</option><option value="facebook">📘 FB</option>
                <option value="tiktok">🎵 TikTok</option><option value="youtube">▶️ YT</option><option value="other">🌐 Khác</option>
              </select>
              <input value={srcName} onChange={e => setSrcName(e.target.value)} placeholder="Tên (vd: Phê La)"
                className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white" />
            </div>
            <input value={srcUrl} onChange={e => setSrcUrl(e.target.value)} placeholder="Link trang (tùy chọn)"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white" />
            <button onClick={addSource} className="w-full py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold">+ Thêm nguồn</button>
          </div>
        </div>

        {/* ── Add item ── */}
        <div className="lg:col-span-2 rounded-xl border border-gray-800 bg-gray-900/60 p-4 space-y-3">
          <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wide">➕ Nạp bài để học</h3>
          <div className="grid md:grid-cols-2 gap-2.5">
            <input value={itemUrl} onChange={e => setItemUrl(e.target.value)}
              placeholder="Dán link video công khai (IG Reels / FB / TikTok / YouTube)"
              className="md:col-span-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white" />
            <textarea value={itemCaption} onChange={e => setItemCaption(e.target.value)}
              placeholder="Caption gốc của bài (dán vào để AI học cả công thức caption — tùy chọn)"
              className="md:col-span-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white resize-none h-16" />
            <select value={itemSourceId} onChange={e => setItemSourceId(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white">
              <option value="">— Gắn vào nguồn (tùy chọn) —</option>
              {sources.map(s => <option key={s.id} value={s.id}>{PLATFORM_ICON[s.platform]} {s.name || s.url}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={addItem} disabled={busy}
                className="flex-1 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-bold">
                {busy ? 'Đang xử lý…' : '🧠 Nạp & phân tích'}
              </button>
              <label className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-semibold cursor-pointer whitespace-nowrap">
                📁 Upload file
                <input type="file" accept="video/*" className="hidden" disabled={busy}
                  onChange={e => e.target.files?.[0] && uploadItem(e.target.files[0])} />
              </label>
            </div>
          </div>
          <p className="text-[10px] text-gray-600">Link private / bị chặn tải → dùng nút Upload file (screen record hoặc tải tay). AI phân tích: cấu trúc cảnh · nhịp cắt · góc máy · hook · cảm xúc · caption.</p>

          <div className="border-t border-gray-800 pt-3 space-y-2">
            <h4 className="text-[11px] font-bold text-gray-300">📥 Dán hàng loạt — lưu hết (cho nhân viên sưu tầm)</h4>
            <textarea value={bulkUrls} onChange={e => setBulkUrls(e.target.value)}
              placeholder={'Dán nhiều link, MỖI DÒNG 1 LINK (tối đa 50):\nhttps://www.instagram.com/reel/...\nhttps://www.tiktok.com/@shop/video/...\nhttps://youtube.com/shorts/...'}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white resize-none h-24 font-mono" />
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={bulkSave} disabled={busy}
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold">
                📥 Lưu hết vào kho
              </button>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={bulkAnalyze} onChange={e => setBulkAnalyze(e.target.checked)} className="rounded accent-brand-500" />
                <span className="text-[11px] text-gray-300">🧠 Phân tích luôn từng bài (chậm hơn, tốn AI — thường để sau)</span>
              </label>
            </div>
            <p className="text-[10px] text-gray-600">Hệ thống tải LẦN LƯỢT từng video về kho (status &quot;đã lưu&quot;) — link trùng tự bỏ qua. Phân tích lúc nào cũng được bằng nút 🧠 trên từng bài.</p>
          </div>
        </div>
      </div>

      {/* ── Items ── */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
        <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wide mb-3">📚 Thư viện đã học ({items.length})</h3>
        {items.length === 0 ? (
          <p className="text-xs text-gray-600 py-4 text-center">Chưa có bài nào. Dán link video viral của đối thủ vào ô trên để bắt đầu học.</p>
        ) : (
          <div className="space-y-3">
            {items.map(it => {
              let sceneCount = 0; let structure = '';
              try { const r = JSON.parse(it.recipe_json || '{}'); sceneCount = r?.scenes?.length ?? 0; structure = r?.structure ?? ''; } catch { /* */ }
              const open = expanded === it.id;
              return (
                <div key={it.id} className="rounded-lg bg-gray-800/50 border border-gray-700/40 p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${statusBadge(it.status)}`}>{statusLabel[it.status] ?? it.status}</span>
                    <p className="text-xs font-semibold text-white flex-1 min-w-0 truncate">
                      {it.source_name ? `${it.source_name} · ` : ''}{it.caption?.slice(0, 70) || it.url || '(file upload)'}
                    </p>
                    {it.url && <a href={it.url} target="_blank" rel="noreferrer" className="text-[10px] text-sky-400">mở bài gốc ↗</a>}
                  </div>
                  {it.status === 'analyzed' && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      {sceneCount > 0 ? `🎬 ${sceneCount} cảnh · cấu trúc: ${structure || '—'}` : '📝 Học caption/hook (không có video)'}
                    </p>
                  )}
                  {it.error && <p className="text-[10px] text-red-400 mt-1">⚠ {it.error}</p>}
                  {open && it.learnings && (
                    <div className="mt-2 rounded-lg bg-gray-900/70 border border-gray-700/40 p-3">
                      <p className="text-[11px] text-gray-300 whitespace-pre-wrap">{it.learnings}</p>
                    </div>
                  )}
                  <div className="flex gap-2 mt-2.5 flex-wrap">
                    {(it.status === 'new' || it.status === 'saved' || it.status === 'failed') && (
                      <button onClick={() => analyze(it.id)} className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[10px] font-bold">🧠 Phân tích</button>
                    )}
                    {it.status === 'saved' && it.filename && (
                      <a href={`/api/images/${it.filename}`} target="_blank" rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-[10px] font-bold">▶ Xem video đã lưu</a>
                    )}
                    {it.status === 'analyzed' && (
                      <>
                        {it.learnings && (
                          <button onClick={() => setExpanded(open ? '' : it.id)} className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-[10px] font-bold">
                            {open ? 'Ẩn bài học' : '📖 Xem bài học'}
                          </button>
                        )}
                        {sceneCount > 0 && (
                          <button onClick={() => createVideoFromItem(it)} disabled={creatingVideoFor === it.id}
                            className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-[10px] font-bold">
                            {creatingVideoFor === it.id ? '🧠 Đang dựng…' : '🎬 Tạo video theo khuôn này'}
                          </button>
                        )}
                        {it.status === 'analyzed' && (
                          <button onClick={() => analyze(it.id)} className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 text-[10px]">↻ Học lại</button>
                        )}
                      </>
                    )}
                    <button onClick={() => removeItem(it.id)} className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-red-900/40 text-gray-500 hover:text-red-300 text-[10px]">Xóa</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

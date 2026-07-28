'use client';

/**
 * 🏭 Reel Factory — console vận hành dây chuyền video AI (mô hình amz-pipeline):
 *  1. TEMPLATES: registry (builtin + custom) — xem block chi tiết, đúc template
 *     mới từ brief/file quy trình (.txt/.md — thay Trello), xoá custom.
 *  2. KHỞI TẠO VIDEO: template × sản phẩm × prompt → render nền → cấp MÃ VIDEO.
 *  3. VIDEOS: danh sách theo MÃ — copy mã tạo card kanban feedback/claim lỗi.
 */

import { useCallback, useEffect, useState } from 'react';

interface TplBlock { id: string; start: number; end: number; concept: string; camera: string; sfx: string; kind: string; hasGlass?: boolean }
interface Tpl { id: string; name: string; description: string; source: string; def?: { totalS: number; blocks: TplBlock[]; heroConcept: string } }
interface Product { id: string; name: string; hasImage: boolean }
interface VideoRow {
  id: string; videoCode: string | null; title: string | null; productName: string;
  templateId: string; status: string; outputUrl: string | null; error: string | null;
  versionLabel: string | null; costUsd: number | null; createdAt: string;
}

export function ReelFactoryView({ brandId }: { brandId: string }) {
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [falConfigured, setFalConfigured] = useState(true);
  const [openTpl, setOpenTpl] = useState('');
  const [brief, setBrief] = useState('');
  const [composing, setComposing] = useState(false);
  const [msg, setMsg] = useState('');

  // Khởi tạo video
  const [templateId, setTemplateId] = useState('iced_summer_v01');
  const [productId, setProductId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [versions, setVersions] = useState(1);
  const [creating, setCreating] = useState(false);
  const [matching, setMatching] = useState(false);

  const load = useCallback(async () => {
    try {
      const [tr, mr, vr] = await Promise.all([
        fetch(`/api/video/reel/templates?brand=${brandId}`),
        fetch(`/api/video/reel?brand=${brandId}`),
        fetch(`/api/video/reel/videos?brand=${brandId}`),
      ]);
      if (tr.ok) setTemplates(((await tr.json()).templates ?? []) as Tpl[]);
      if (mr.ok) {
        const m = await mr.json() as { products?: Product[]; falConfigured?: boolean };
        setProducts(m.products ?? []);
        setFalConfigured(Boolean(m.falConfigured));
      }
      if (vr.ok) setVideos(((await vr.json()).videos ?? []) as VideoRow[]);
    } catch { /* */ }
  }, [brandId]);
  useEffect(() => { load(); }, [load]);

  // Poll khi có video đang chạy
  useEffect(() => {
    const busy = videos.some(v => v.status === 'queued' || v.status === 'rendering');
    if (!busy) return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [videos, load]);

  function readBriefFile(f: File) {
    const reader = new FileReader();
    reader.onload = () => setBrief(String(reader.result || '').slice(0, 5000));
    reader.readAsText(f);
  }

  async function composeTemplate() {
    if (!brief.trim()) { setMsg('❌ Dán brief hoặc chọn file quy trình trước.'); return; }
    setComposing(true); setMsg('');
    try {
      const r = await fetch(`/api/video/reel/compose-template?brand=${brandId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief }),
      });
      const d = await r.json() as { ok?: boolean; error?: string; template?: { id: string; name: string } };
      if (!d.ok || !d.template) setMsg('❌ ' + (d.error ?? 'Đúc template thất bại'));
      else { setMsg(`✅ Đã đúc template "${d.template.name}" — chọn sẵn ở Khởi tạo video.`); setTemplateId(d.template.id); await load(); }
    } catch (e) { setMsg('❌ ' + String(e)); }
    setComposing(false);
  }

  async function matchBrief() {
    if (!brief.trim()) { setMsg('❌ Dán brief vào ô trước.'); return; }
    setMatching(true); setMsg('');
    try {
      const r = await fetch(`/api/video/reel/match?brand=${brandId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief }),
      });
      const d = await r.json() as { ok?: boolean; error?: string; reason?: string; confidence?: number; missing?: string[]; match?: { templateId: string | null; productId: string | null; prompt: string; versions: number } };
      if (!d.ok || !d.match) setMsg('❌ ' + (d.error ?? 'Không khớp được'));
      else {
        if (d.match.templateId) setTemplateId(d.match.templateId);
        if (d.match.productId) setProductId(d.match.productId);
        if (d.match.prompt) setPrompt(d.match.prompt);
        if (d.match.versions) setVersions(Math.min(3, Math.max(1, d.match.versions)));
        setMsg(`✅ ${d.reason ?? 'Đã khớp'} (${Math.round((d.confidence ?? 0) * 100)}%)${d.missing?.length ? ` — ⚠️ thiếu: ${d.missing.join('; ')}` : ''}`);
      }
    } catch (e) { setMsg('❌ ' + String(e)); }
    setMatching(false);
  }

  async function removeTemplate(id: string) {
    if (!confirm(`Xoá template ${id}?`)) return;
    const r = await fetch(`/api/video/reel/templates?brand=${brandId}&id=${id}`, { method: 'DELETE' });
    const d = await r.json() as { ok?: boolean; error?: string };
    setMsg(d.ok ? '✅ Đã xoá template' : '❌ ' + (d.error ?? 'Xoá thất bại'));
    await load();
  }

  async function createVideos() {
    if (!productId) { setMsg('❌ Chọn sản phẩm.'); return; }
    if (!prompt.trim()) { setMsg('❌ Nhập prompt.'); return; }
    setCreating(true); setMsg('');
    try {
      const r = await fetch(`/api/video/reel?brand=${brandId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, templateId, videoType: 'default', prompt, versions }),
      });
      const d = await r.json() as { ok?: boolean; error?: string; videoCodes?: string[] };
      if (!d.ok) setMsg('❌ ' + (d.error ?? 'Tạo video thất bại'));
      else setMsg(`✅ Đã cấp mã: ${(d.videoCodes ?? []).join(', ')} — render nền ~5-15 phút/bản, xong tự về Review & Queue.`);
      await load();
    } catch (e) { setMsg('❌ ' + String(e)); }
    setCreating(false);
  }

  const copy = (t: string) => { navigator.clipboard?.writeText(t); setMsg(`📋 Đã copy: ${t}`); };
  const statusBadge = (s: string) => ({
    queued: 'bg-sky-600/30 text-sky-300', rendering: 'bg-amber-600/30 text-amber-300 animate-pulse',
    done: 'bg-emerald-600/30 text-emerald-300', failed: 'bg-red-600/30 text-red-300',
  }[s] ?? 'bg-gray-700 text-gray-300');

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-bold text-white">🏭 Reel Factory — dây chuyền video AI</h2>
        {!falConfigured && <span className="text-[11px] text-amber-400">⚠️ FAL_KEY chưa cấu hình</span>}
      </div>
      {msg && <p className={`text-xs ${msg.startsWith('✅') || msg.startsWith('📋') ? 'text-emerald-400' : 'text-red-400'}`}>{msg}</p>}

      {/* ── 1. TEMPLATES ── */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 space-y-3">
        <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wide">📐 Templates ({templates.length})</h3>
        <div className="grid md:grid-cols-2 gap-2">
          {templates.map(t => (
            <div key={t.id} className="rounded-lg bg-gray-800/60 p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <button onClick={() => setOpenTpl(openTpl === t.id ? '' : t.id)} className="text-xs font-bold text-white text-left">
                  {t.source === 'custom' ? '🧬' : '📐'} {t.name} <span className="text-gray-500 font-normal">({t.def?.totalS ?? '?'}s · {t.def?.blocks?.length ?? '?'} cảnh)</span>
                </button>
                <div className="flex gap-1">
                  <button onClick={() => setTemplateId(t.id)} title="Dùng template này"
                    className={`text-[10px] px-2 py-1 rounded ${templateId === t.id ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                    {templateId === t.id ? '✓ đang chọn' : 'chọn'}
                  </button>
                  {t.source === 'custom' && (
                    <button onClick={() => removeTemplate(t.id)} className="text-[10px] px-2 py-1 rounded bg-red-900/40 text-red-300 hover:bg-red-900/70">xoá</button>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-gray-400">{t.description}</p>
              {openTpl === t.id && t.def && (
                <div className="pt-1 space-y-0.5">
                  {t.def.blocks.map(b => (
                    <div key={b.id} className="text-[10px] text-gray-400 flex gap-2">
                      <span className="text-gray-500 w-16 shrink-0">{b.start}-{b.end}s</span>
                      <span className="text-gray-300 w-36 shrink-0 truncate">{b.id}{b.hasGlass ? ' 🥛' : ''}</span>
                      <span className="truncate">{b.kind === 'endcard' ? 'End card (packshot thật + CTA)' : b.concept}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-gray-800/40 p-3 space-y-2">
          <p className="text-[11px] text-gray-400 font-bold">🧬 Đúc template mới từ brief / file quy trình (thay Trello)</p>
          <textarea value={brief} onChange={e => setBrief(e.target.value)} rows={3}
            placeholder="Dán brief (tự do hoặc phiếu A-E)… hoặc chọn file .txt/.md bên dưới"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-[11px] text-white placeholder-gray-500" />
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-[11px] px-3 py-1.5 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 cursor-pointer">
              📄 Chọn file quy trình
              <input type="file" accept=".txt,.md,.text" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) readBriefFile(f); }} />
            </label>
            <button onClick={matchBrief} disabled={matching}
              className="text-[11px] px-3 py-1.5 rounded-lg bg-purple-700/40 text-purple-200 hover:bg-purple-700/60 disabled:opacity-50">
              {matching ? '⏳…' : '🎯 Khớp với template có sẵn'}
            </button>
            <button onClick={composeTemplate} disabled={composing}
              className="text-[11px] px-3 py-1.5 rounded-lg bg-amber-700/40 text-amber-200 hover:bg-amber-700/60 disabled:opacity-50">
              {composing ? '⏳ Đang đúc (~30-60s)…' : '🧬 Đúc template MỚI'}
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. KHỞI TẠO VIDEO ── */}
      <div className="rounded-xl border border-cyan-900/60 bg-gray-900/60 p-4 space-y-3">
        <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wide">🚀 Khởi tạo video render</h3>
        <div className="grid sm:grid-cols-3 gap-2">
          <select value={templateId} onChange={e => setTemplateId(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white">
            {templates.map(t => <option key={t.id} value={t.id}>{t.source === 'custom' ? '🧬 ' : '📐 '}{t.name}</option>)}
          </select>
          <select value={productId} onChange={e => setProductId(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white">
            <option value="">— Chọn sản phẩm (SKU) —</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}{p.hasImage ? '' : ' (chưa có ảnh)'}</option>)}
          </select>
          <select value={versions} onChange={e => setVersions(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white">
            {[1, 2, 3].map(n => <option key={n} value={n}>{n} bản</option>)}
          </select>
        </div>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={2}
          placeholder='Prompt sáng tạo (bắt buộc) — vd: "Iced hibiscus chiều hè, màu ruby, ASMR đá + rót trà"'
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500" />
        <div className="flex items-center gap-3">
          <button onClick={createVideos} disabled={creating || !falConfigured}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold disabled:opacity-50">
            {creating ? '⏳ Đang dựng plan…' : `🚀 Tạo ${versions} bản (cấp mã video)`}
          </button>
          <span className="text-[11px] text-gray-500">video xong tự về Review & Queue kèm thumbnail + caption</span>
        </div>
      </div>

      {/* ── 3. VIDEOS THEO MÃ ── */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wide">🎬 Videos ({videos.length})</h3>
          <span className="text-[10px] text-gray-500">Feedback/claim lỗi: copy MÃ → tạo card Kanban ghi mã + mô tả lỗi</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead><tr className="text-gray-500 text-left">
              <th className="py-1 pr-2">Mã video</th><th className="pr-2">Sản phẩm</th><th className="pr-2">Template</th>
              <th className="pr-2">Trạng thái</th><th className="pr-2">Chi phí</th><th className="pr-2">Video</th><th>Lúc</th>
            </tr></thead>
            <tbody>
              {videos.map(v => (
                <tr key={v.id} className="border-t border-gray-800/70 text-gray-300">
                  <td className="py-1.5 pr-2">
                    <button onClick={() => copy(v.videoCode || v.id)} title="Copy mã để tạo card kanban"
                      className="font-mono font-bold text-cyan-300 hover:text-white">{v.videoCode || v.id.slice(0, 8)} 📋</button>
                  </td>
                  <td className="pr-2">{v.productName} <span className="text-gray-500">{v.versionLabel}</span></td>
                  <td className="pr-2 text-gray-400">{v.templateId}</td>
                  <td className="pr-2">
                    <span className={`px-2 py-0.5 rounded ${statusBadge(v.status)}`}>{v.status}</span>
                    {v.error && <span className="text-red-400 ml-1" title={v.error}>⚠</span>}
                  </td>
                  <td className="pr-2">{v.costUsd != null ? `$${v.costUsd}` : '—'}</td>
                  <td className="pr-2">{v.outputUrl ? <a href={v.outputUrl} target="_blank" className="text-cyan-400 hover:underline">▶ xem</a> : '—'}</td>
                  <td className="text-gray-500">{String(v.createdAt).slice(5, 16)}</td>
                </tr>
              ))}
              {!videos.length && <tr><td colSpan={7} className="py-3 text-gray-500">Chưa có video nào — tạo bản đầu tiên ở trên.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

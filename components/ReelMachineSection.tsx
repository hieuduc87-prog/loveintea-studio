'use client';

/**
 * 🧊 Reel Machine — tool auto sản xuất video AI theo đề bài Creative Hub
 * (Iced Summer Sensory 10s). Nhân viên: chọn SKU + loại video + gõ prompt →
 * bấm chạy → 1-3 bản video vào hàng render → xong tự đổ về Review & Queue.
 */

import { useCallback, useEffect, useState } from 'react';

interface ChecklistItem { key: string; label: string; ok: boolean; detail: string }
interface ReelMeta {
  checklist: { ok: boolean; items: ChecklistItem[] };
  skus: Array<{ code: string; name: string; moment: string }>;
  videoTypes: string[];
  falConfigured: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  iced_summer: '🧊 Iced Summer (sensory ASMR)',
  product: '📦 Product proof',
  branding: '🌿 Branding',
  educate: '📚 Educate',
  sale: '🛒 Bán hàng nhẹ',
};

export function ReelMachineSection({ brandId }: { brandId: string }) {
  const [meta, setMeta] = useState<ReelMeta | null>(null);
  const [sku, setSku] = useState('HIB');
  const [videoType, setVideoType] = useState('iced_summer');
  const [prompt, setPrompt] = useState('');
  const [versions, setVersions] = useState(1);
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [msg, setMsg] = useState('');
  const [showChecklist, setShowChecklist] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/video/reel?brand=${brandId}`);
      if (r.ok) setMeta(await r.json() as ReelMeta);
    } catch { /* */ }
  }, [brandId]);
  useEffect(() => { load(); }, [load]);

  async function run() {
    if (!prompt.trim()) { setMsg('❌ Nhập prompt mô tả video muốn có (bắt buộc theo đề bài).'); return; }
    setBusy(true); setMsg('');
    try {
      const r = await fetch(`/api/video/reel?brand=${brandId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku, videoType, prompt, versions }),
      });
      const d = await r.json() as { ok?: boolean; error?: string; projectIds?: string[] };
      if (!d.ok) setMsg('❌ ' + (d.error ?? 'Tạo reel thất bại'));
      else setMsg(`✅ ${d.projectIds?.length ?? 0} bản vào hàng render (~3-8 phút/bản). Theo dõi ở danh sách project bên dưới; video xong sẽ nằm ở Review & Queue.`);
    } catch (e) { setMsg('❌ ' + String(e)); }
    setBusy(false);
  }

  async function analyzeRefs() {
    setAnalyzing(true); setMsg('');
    try {
      const r = await fetch(`/api/video/reel/analyze-refs?brand=${brandId}`, { method: 'POST' });
      const d = await r.json() as { ok?: boolean; error?: string; clips?: number };
      if (!d.ok) setMsg('❌ ' + (d.error ?? 'Phân tích thất bại'));
      else { setMsg(`✅ Đã học motion grammar từ ${d.clips} video mẫu.`); await load(); }
    } catch (e) { setMsg('❌ ' + String(e)); }
    setAnalyzing(false);
  }

  const cl = meta?.checklist;
  const missing = cl?.items.filter(i => !i.ok) ?? [];

  return (
    <div className="rounded-xl border border-cyan-900/60 bg-gray-900/60 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wide">🧊 Reel Machine — video AI tự động (đề bài Iced Summer)</h3>
        <button onClick={() => setShowChecklist(s => !s)} className="text-[11px] text-gray-400 hover:text-white">
          {cl ? (cl.ok ? '✅ Assets đủ' : `⚠️ Thiếu ${missing.length} mục`) : '…'} {showChecklist ? '▲' : '▼'}
        </button>
      </div>

      {showChecklist && cl && (
        <div className="rounded-lg bg-gray-800/60 p-3 grid sm:grid-cols-2 gap-1">
          {cl.items.map(i => (
            <div key={i.key} className="text-[11px] flex gap-2">
              <span>{i.ok ? '🟢' : '🔴'}</span>
              <span className="text-gray-300">{i.label}</span>
              <span className="text-gray-500 truncate">{i.detail}</span>
            </div>
          ))}
          <div className="sm:col-span-2 pt-1">
            <button onClick={analyzeRefs} disabled={analyzing}
              className="text-[11px] px-3 py-1.5 rounded-lg bg-cyan-700/40 text-cyan-200 hover:bg-cyan-700/60 disabled:opacity-50">
              {analyzing ? '⏳ Đang học video mẫu…' : '📚 Phân tích video mẫu → motion dictionary (chạy 1 lần)'}
            </button>
          </div>
        </div>
      )}

      {meta && !meta.falConfigured && (
        <p className="text-[11px] text-amber-400">⚠️ FAL_KEY chưa cấu hình trên server — cần founder thêm key fal.ai trước khi chạy.</p>
      )}

      <div className="grid sm:grid-cols-3 gap-2">
        <select value={sku} onChange={e => setSku(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white">
          {(meta?.skus ?? [{ code: 'HIB', name: 'Hibiscus', moment: '' }]).map(s =>
            <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
        </select>
        <select value={videoType} onChange={e => setVideoType(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white">
          {(meta?.videoTypes ?? ['iced_summer']).map(t =>
            <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>)}
        </select>
        <select value={versions} onChange={e => setVersions(Number(e.target.value))}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white">
          {[1, 2, 3].map(n => <option key={n} value={n}>{n} bản</option>)}
        </select>
      </div>
      <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={2}
        placeholder='Prompt (bắt buộc) — vd: "Iced hibiscus chiều hè, cảm giác mát rượi, màu ruby nổi bật, ASMR đá + rót trà"'
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500" />
      <div className="flex items-center gap-3">
        <button onClick={run} disabled={busy || !meta?.falConfigured}
          className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold disabled:opacity-50">
          {busy ? '⏳ Đang dựng plan…' : `🚀 Tạo ${versions} bản Reel 10s`}
        </button>
        <span className="text-[11px] text-gray-500">~$0.3-0.7/bản (AI clip + SFX) · video về Review & Queue</span>
      </div>
      {msg && <p className={`text-xs ${msg.startsWith('✅') ? 'text-emerald-400' : 'text-red-400'}`}>{msg}</p>}
    </div>
  );
}

'use client';

/**
 * Per-product Brief & Knowledge panel.
 *  - Shot-list: required photo angles + quantity, coverage vs actual, export a
 *    creative brief for the photographer when shots are missing.
 *  - Knowledge template: default fields auto-filled from a customer-sent file
 *    (xlsx/csv/txt) or pasted text via Gemini, editable, plus an AI "consolidate".
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface KField { key: string; label: string; hint: string; multiline?: boolean }
interface ShotReq { type: string; label: string; desc: string; min: number }
interface Coverage extends ShotReq { have: number; ok: boolean }

export function ProductKnowledgePanel({ productId, productName }: { productId: string; productName: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fields, setFields] = useState<KField[]>([]);
  const [knowledge, setKnowledge] = useState<Record<string, string>>({});
  const [shotReqs, setShotReqs] = useState<ShotReq[]>([]);
  const [coverage, setCoverage] = useState<Coverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/products/${productId}/knowledge`);
    const d = await r.json() as { fields: KField[]; knowledge: Record<string, string>; shotReqs: ShotReq[]; coverage: Coverage[] };
    setFields(d.fields ?? []); setKnowledge(d.knowledge ?? {}); setShotReqs(d.shotReqs ?? []); setCoverage(d.coverage ?? []);
    setDirty(false); setLoading(false);
  }, [productId]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    setBusy('save');
    await fetch(`/api/products/${productId}/knowledge`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ knowledge, shotReqs }),
    });
    setBusy(''); setDirty(false); setMsg('✓ Đã lưu'); setTimeout(() => setMsg(''), 2500);
  }

  async function extractFile(file: File) {
    setBusy('extract'); setMsg('');
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch(`/api/products/${productId}/knowledge/extract`, { method: 'POST', body: fd });
      const d = await r.json() as { ok?: boolean; knowledge?: Record<string, string>; error?: string };
      if (d.ok && d.knowledge) { mergeFilled(d.knowledge); setMsg('✓ AI đã điền từ file — xem lại rồi Lưu'); }
      else setMsg('✗ ' + (d.error ?? 'Trích xuất thất bại'));
    } catch (e) { setMsg('✗ ' + String(e)); }
    setBusy('');
  }
  async function extractText() {
    if (!pasteText.trim()) return;
    setBusy('extract'); setMsg('');
    try {
      const r = await fetch(`/api/products/${productId}/knowledge/extract`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: pasteText }),
      });
      const d = await r.json() as { ok?: boolean; knowledge?: Record<string, string>; error?: string };
      if (d.ok && d.knowledge) { mergeFilled(d.knowledge); setPasteOpen(false); setPasteText(''); setMsg('✓ AI đã điền — xem lại rồi Lưu'); }
      else setMsg('✗ ' + (d.error ?? 'Lỗi'));
    } catch (e) { setMsg('✗ ' + String(e)); }
    setBusy('');
  }
  async function summarize() {
    setBusy('sum'); setMsg('');
    try {
      const r = await fetch(`/api/products/${productId}/knowledge/extract`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'summarize', knowledge }),
      });
      const d = await r.json() as { ok?: boolean; knowledge?: Record<string, string>; error?: string };
      if (d.ok && d.knowledge) { setKnowledge(d.knowledge); setDirty(true); setMsg('✓ Đã tổng hợp — xem lại rồi Lưu'); }
      else setMsg('✗ ' + (d.error ?? 'Lỗi'));
    } catch (e) { setMsg('✗ ' + String(e)); }
    setBusy('');
  }
  // Only overwrite empty fields, keep what user already has unless source provides
  function mergeFilled(filled: Record<string, string>) {
    setKnowledge(prev => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(filled)) if (v && (!next[k] || next[k].trim() === '')) next[k] = v;
      return next;
    });
    setDirty(true);
  }

  function exportBrief() {
    const missing = coverage.filter(c => !c.ok);
    const lines = [
      `BRIEF CHỤP ẢNH — ${productName}`,
      `Ngày: ${new Date().toLocaleDateString('vi-VN')}`,
      '',
      missing.length ? 'CẦN BỔ SUNG:' : 'Đã đủ tất cả shot yêu cầu ✓',
      ...missing.map(c => `• ${c.label}: cần ${c.min}, hiện có ${c.have} → THIẾU ${c.min - c.have}\n   ${c.desc}`),
      '',
      'TOÀN BỘ YÊU CẦU:',
      ...coverage.map(c => `• ${c.label} (×${c.min}) — ${c.desc} [${c.ok ? 'đủ' : 'thiếu'}]`),
    ];
    if (knowledge.short_desc) lines.push('', 'THÔNG TIN SẢN PHẨM:', knowledge.short_desc);
    const text = lines.join('\n');
    navigator.clipboard?.writeText(text).catch(() => {});
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `brief-anh-${productName.replace(/\s+/g, '-').toLowerCase()}.txt`; a.click();
    setMsg('✓ Đã tải brief + copy vào clipboard');
  }

  if (loading) return <div className="text-sm text-gray-500 py-8 text-center">Đang tải…</div>;
  const missingCount = coverage.filter(c => !c.ok).length;

  return (
    <div className="space-y-5">
      {msg && <p className={`text-xs ${msg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>{msg}</p>}

      {/* ── Shot-list requirements ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">📸 Yêu cầu ảnh (brief chụp)</p>
          {missingCount > 0
            ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-300">thiếu {missingCount} loại</span>
            : <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300">đủ ✓</span>}
          <button onClick={exportBrief} className="ml-auto px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[11px] font-semibold">📤 Gửi creative (tải brief)</button>
        </div>
        <div className="space-y-2">
          {coverage.map((c, i) => (
            <div key={c.type} className={`flex items-center gap-3 p-2.5 rounded-lg border ${c.ok ? 'border-emerald-800/40 bg-emerald-900/10' : 'border-amber-800/40 bg-amber-900/10'}`}>
              <span className="text-lg">{c.ok ? '✅' : '⚠️'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white">{c.label} <span className="text-gray-500 font-normal">({c.have}/{c.min})</span></p>
                <p className="text-[10px] text-gray-500">{c.desc}</p>
              </div>
              <label className="flex items-center gap-1 text-[10px] text-gray-500">cần
                <input type="number" min={0} value={c.min} onChange={e => {
                  const v = Math.max(0, Number(e.target.value));
                  setShotReqs(prev => { const n = [...prev]; const idx = n.findIndex(s => s.type === c.type); if (idx >= 0) n[idx] = { ...n[idx], min: v }; return n; });
                  setCoverage(prev => { const n = [...prev]; n[i] = { ...n[i], min: v, ok: n[i].have >= v }; return n; });
                  setDirty(true);
                }} className="w-12 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-white text-center" />
              </label>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-600 mt-2">Coverage đếm theo loại ảnh đã gắn nhãn trong tab Ảnh & Video. Gắn đúng loại (packshot/macro/lifestyle…) để brief chính xác.</p>
      </div>

      {/* ── Knowledge template ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">🧠 Knowledge sản phẩm</p>
          <div className="ml-auto flex items-center gap-2">
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt,.md,.json" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) extractFile(f); e.target.value = ''; }} />
            <button onClick={() => fileRef.current?.click()} disabled={busy === 'extract'}
              className="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-[11px] disabled:opacity-50">
              {busy === 'extract' ? '⟳ AI đang đọc…' : '📎 Fill từ file khách'}
            </button>
            <button onClick={() => setPasteOpen(v => !v)} className="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-[11px]">📋 Dán text</button>
            <button onClick={summarize} disabled={busy === 'sum'} className="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-[11px] disabled:opacity-50">
              {busy === 'sum' ? '⟳ Đang tổng hợp…' : '✨ Tổng hợp (AI)'}
            </button>
            <button onClick={save} disabled={busy === 'save' || !dirty}
              className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-[11px] font-bold">
              {busy === 'save' ? '⟳' : dirty ? '💾 Lưu' : '✓ Đã lưu'}
            </button>
          </div>
        </div>

        {pasteOpen && (
          <div className="mb-3">
            <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} placeholder="Dán nội dung khách gửi (mô tả, thành phần, công dụng…) — AI sẽ phân loại vào đúng trường"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white resize-none h-24" />
            <button onClick={extractText} disabled={busy === 'extract' || !pasteText.trim()}
              className="mt-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-[11px] font-semibold">AI điền vào template</button>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-3">
          {fields.map(f => (
            <div key={f.key} className={f.multiline ? 'md:col-span-2' : ''}>
              <label className="block text-[11px] text-gray-400 mb-1">{f.label} <span className="text-gray-600">— {f.hint}</span></label>
              {f.multiline ? (
                <textarea value={knowledge[f.key] ?? ''} onChange={e => { setKnowledge(p => ({ ...p, [f.key]: e.target.value })); setDirty(true); }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white resize-none h-20 focus:border-brand-500 focus:outline-none" />
              ) : (
                <input value={knowledge[f.key] ?? ''} onChange={e => { setKnowledge(p => ({ ...p, [f.key]: e.target.value })); setDirty(true); }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-brand-500 focus:outline-none" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

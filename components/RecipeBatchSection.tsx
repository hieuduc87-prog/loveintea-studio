'use client';

/**
 * Recipe Batch — số hoá quy trình "AUTO POST" của Bazan:
 * 1 lô = nhiều món (mỗi món 1 folder clip) + clip sản phẩm/brewing dùng chung
 * + bộ thông số color grading. AI phân loại clip → dựng video theo template viral
 * (hook tên món → shot sản phẩm → các bước pha chế → kết quả) ra nhiều version.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { chunkedUpload } from '@/lib/chunk-upload';

const PRODUCT_GROUP = '__product_brewing';

interface Batch { id: string; name: string; grade_json: string; created_at: string; dishes: number; clips: number; projects: number }
interface BatchClip { id: string; url: string; duration_s: number; group_name: string; status: string; recipe_json: string | null }
interface BatchProject { id: string; title: string; dish_name: string; version_label: string; status: string; output_url: string | null; error: string | null }

const ROLE_BADGE: Record<string, string> = {
  hook_final: '🏆 thành phẩm', process: '🥄 bước pha', product: '📦 sản phẩm',
  brewing: '☕ brewing', ambience: '🌫 b-roll',
};

export function RecipeBatchSection({ brandId }: { brandId: string }) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [sel, setSel] = useState<string>('');
  const [clips, setClips] = useState<BatchClip[]>([]);
  const [projects, setProjects] = useState<BatchProject[]>([]);
  const [newDish, setNewDish] = useState('');
  const [uploadPct, setUploadPct] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [versions, setVersions] = useState(2);

  const loadBatches = useCallback(async () => {
    try {
      const r = await fetch(`/api/video/recipe-batches?brandId=${brandId}`);
      const d = await r.json() as { batches?: Batch[] };
      setBatches(d.batches ?? []);
    } catch { /* keep */ }
  }, [brandId]);

  const loadDetail = useCallback(async () => {
    if (!sel) { setClips([]); setProjects([]); return; }
    try {
      const r = await fetch(`/api/video/recipe-batches/${sel}?brandId=${brandId}`);
      const d = await r.json() as { clips?: BatchClip[]; projects?: BatchProject[] };
      setClips(d.clips ?? []); setProjects(d.projects ?? []);
    } catch { /* keep */ }
  }, [sel, brandId]);

  useEffect(() => { loadBatches(); }, [loadBatches]);
  useEffect(() => { loadDetail(); }, [loadDetail]);

  // Poll khi còn clip đang phân loại hoặc project đang render
  useEffect(() => {
    const active = clips.some(c => c.status === 'tagging') || projects.some(p => ['queued', 'rendering'].includes(p.status));
    if (!active) return;
    const t = setInterval(loadDetail, 8000);
    return () => clearInterval(t);
  }, [clips, projects, loadDetail]);

  async function createBatch() {
    const name = prompt('Tên lô (vd "AUTO POST 13"):', `AUTO POST ${new Date().toLocaleDateString('vi')}`);
    if (!name) return;
    const r = await fetch('/api/video/recipe-batches?brandId=' + brandId, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
    });
    const d = await r.json() as { ok?: boolean; id?: string };
    if (d.ok && d.id) { await loadBatches(); setSel(d.id); }
  }

  async function uploadFiles(files: FileList, groupName: string) {
    if (!sel || !files.length) return;
    setBusy(true); setMsg('');
    let done = 0;
    try {
      for (const f of Array.from(files)) {
        setUploadPct(`${f.name} (${done + 1}/${files.length})`);
        await chunkedUpload(f, 'recipe_clip', { batchId: sel, groupName }, pct => setUploadPct(`${f.name} ${pct}% (${done + 1}/${files.length})`));
        done++;
      }
      setMsg(`✅ Đã lên ${done} clip vào "${groupName === PRODUCT_GROUP ? 'Sản phẩm/Brewing' : groupName}" — AI đang phân loại vai trò từng clip…`);
      await loadDetail();
    } catch (e) { setMsg(`❌ ${String(e)} (đã lên ${done}/${files.length})`); }
    setUploadPct(''); setBusy(false);
  }

  async function generate(dish: string) {
    setBusy(true); setMsg('');
    try {
      const r = await fetch(`/api/video/recipe-batches/${sel}/generate?brandId=${brandId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dish, versions }),
      });
      const d = await r.json() as { ok?: boolean; projects?: string[]; error?: string };
      if (!d.ok) setMsg('❌ ' + (d.error ?? 'Dựng thất bại'));
      else { setMsg(`✅ Đã xếp hàng ${d.projects?.length} bản dựng cho "${dish}" — render tự chạy tuần tự.`); await loadDetail(); }
    } catch (e) { setMsg('❌ ' + String(e)); }
    setBusy(false);
  }

  const groups = useMemo(() => {
    const g = new Map<string, BatchClip[]>();
    for (const c of clips) {
      const k = c.group_name || '—';
      if (!g.has(k)) g.set(k, []);
      g.get(k)!.push(c);
    }
    return g;
  }, [clips]);

  const dishNames = [...groups.keys()].filter(k => k !== PRODUCT_GROUP && k !== '—');
  const role = (c: BatchClip) => { try { return (JSON.parse(c.recipe_json || '{}') as { role?: string }).role ?? ''; } catch { return ''; } };
  const stepLabel = (c: BatchClip) => { try { return (JSON.parse(c.recipe_json || '{}') as { step_label?: string }).step_label ?? ''; } catch { return ''; } };

  const statusBadge = (s: string) => ({
    queued: 'bg-sky-600/30 text-sky-300', rendering: 'bg-amber-600/30 text-amber-300 animate-pulse',
    done: 'bg-emerald-600/30 text-emerald-300', failed: 'bg-red-600/30 text-red-300',
  }[s] ?? 'bg-gray-700 text-gray-300');

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wide">🍳 Recipe Batch — dựng video công thức tự động (quy trình AUTO POST)</h3>
        <div className="flex items-center gap-2">
          <select value={sel} onChange={e => setSel(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white">
            <option value="">— Chọn lô —</option>
            {batches.map(b => <option key={b.id} value={b.id}>{b.name} · {b.dishes} món · {b.clips} clip · {b.projects} video</option>)}
          </select>
          <button onClick={createBatch} className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-[11px] font-semibold">+ Lô mới</button>
        </div>
      </div>
      {msg && <p className={`text-xs ${msg.startsWith('✅') ? 'text-emerald-400' : 'text-red-400'}`}>{msg}</p>}
      {uploadPct && <p className="text-[11px] text-sky-300">⏳ Đang upload: {uploadPct}</p>}

      {!sel ? (
        <p className="text-xs text-gray-600 py-3">Tạo 1 lô cho mỗi đợt quay (như folder &quot;AUTO POST&quot;). Trong lô: upload clip theo <b>từng món</b> + clip <b>sản phẩm/brewing dùng chung</b>. AI tự phân loại (thành phẩm / bước pha / sản phẩm), rồi bấm Dựng video → ra nhiều bản (Original 1, 2…) theo đúng template viral: hook tên món → shot sản phẩm → các bước → kết quả, giữ tiếng thật + color grade chuẩn của brand.</p>
      ) : (
        <>
          {/* Upload zones */}
          <div className="grid md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-3 space-y-2">
              <p className="text-[11px] font-semibold text-gray-300">🍹 Clip theo món (RECIPES/&lt;tên món&gt;)</p>
              <div className="flex gap-2">
                <input value={newDish} onChange={e => setNewDish(e.target.value)} placeholder="Tên món — vd: Choco Chips Mocha"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white" list="dish-list" />
                <datalist id="dish-list">{dishNames.map(d => <option key={d} value={d} />)}</datalist>
                <label className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer ${newDish.trim() && !busy ? 'bg-brand-600 hover:bg-brand-500 text-white' : 'bg-gray-800 text-gray-600 pointer-events-none'}`}>
                  + Upload clip món
                  <input type="file" accept="video/*" multiple className="hidden" disabled={busy || !newDish.trim()}
                    onChange={e => { if (e.target.files?.length) uploadFiles(e.target.files, newDish.trim()); e.target.value = ''; }} />
                </label>
              </div>
              <p className="text-[10px] text-gray-600">Chọn nhiều file 1 lần (clip từng bước + shot thành phẩm). Upload theo đúng thứ tự quay.</p>
            </div>
            <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-3 space-y-2">
              <p className="text-[11px] font-semibold text-gray-300">📦 Clip sản phẩm + brewing (dùng chung cả lô)</p>
              <label className={`inline-block px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer ${!busy ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-800 text-gray-600 pointer-events-none'}`}>
                + Upload clip sản phẩm/brewing
                <input type="file" accept="video/*" multiple className="hidden" disabled={busy}
                  onChange={e => { if (e.target.files?.length) uploadFiles(e.target.files, PRODUCT_GROUP); e.target.value = ''; }} />
              </label>
              <p className="text-[10px] text-gray-600">Shot túi cà phê, phin/máy pha… AI chèn 1 shot + brand line vào mỗi video.</p>
            </div>
          </div>

          {/* Dish groups */}
          {dishNames.length === 0 && !groups.has(PRODUCT_GROUP) ? (
            <p className="text-xs text-gray-600 py-2 text-center">Lô trống — upload clip món đầu tiên.</p>
          ) : (
            <div className="space-y-3">
              {[...dishNames, ...(groups.has(PRODUCT_GROUP) ? [PRODUCT_GROUP] : [])].map(g => {
                const list = groups.get(g) ?? [];
                const tagging = list.filter(c => c.status === 'tagging').length;
                const dishProjects = projects.filter(p => p.dish_name && g !== PRODUCT_GROUP && p.dish_name.toLowerCase() === g.replace(/^\d+\.?\s*/, '').trim().toLowerCase());
                return (
                  <div key={g} className="rounded-lg border border-gray-700/40 bg-gray-800/30 p-3">
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                      <p className="text-xs font-bold text-white">
                        {g === PRODUCT_GROUP ? '📦 Sản phẩm / Brewing (chung)' : `🍹 ${g}`}
                        <span className="text-gray-500 font-normal"> · {list.length} clip{tagging ? ` · 🧠 ${tagging} đang phân loại` : ''}</span>
                      </p>
                      {g !== PRODUCT_GROUP && (
                        <div className="flex items-center gap-2">
                          <select value={versions} onChange={e => setVersions(Number(e.target.value))}
                            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-[11px] text-white">
                            <option value={1}>1 bản</option><option value={2}>2 bản</option><option value={3}>3 bản</option>
                          </select>
                          <button onClick={() => generate(g)} disabled={busy || tagging > 0}
                            className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-[11px] font-bold">
                            🎬 Dựng video
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {list.map(c => (
                        <div key={c.id} className="w-20 flex-shrink-0">
                          <video src={c.url} muted playsInline preload="metadata" className="w-20 aspect-[9/16] object-cover rounded-md bg-black"
                            onMouseEnter={e => e.currentTarget.play().catch(() => {})} onMouseLeave={e => e.currentTarget.pause()} />
                          <p className="text-[8px] text-gray-400 truncate mt-0.5">
                            {c.status === 'tagging' ? '🧠 phân loại…' : (ROLE_BADGE[role(c)] ?? role(c) ?? '—')}
                          </p>
                          {stepLabel(c) && <p className="text-[8px] text-sky-300 truncate">“{stepLabel(c)}”</p>}
                        </div>
                      ))}
                    </div>
                    {dishProjects.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {dishProjects.map(p => (
                          <div key={p.id} className="flex items-center gap-2 flex-wrap text-[11px]">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${statusBadge(p.status)}`}>{p.status}</span>
                            <span className="text-gray-300">{p.version_label}</span>
                            {p.output_url && <video src={p.output_url} controls playsInline className="w-24 rounded-md aspect-[9/16] object-cover bg-black" />}
                            {p.output_url && <a href={p.output_url} download className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 text-[10px] font-bold">⬇ Tải</a>}
                            {p.error && <span className="text-red-400 truncate max-w-[280px]">⚠ {p.error}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

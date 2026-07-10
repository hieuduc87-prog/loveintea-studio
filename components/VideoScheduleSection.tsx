'use client';

/**
 * Lịch video định kỳ — đặt 1 lần, hệ thống tự dựng storyboard → render → tạo bài
 * (draft để duyệt hoặc tự đăng) theo chu kỳ. Nằm trong Video Studio.
 */

import { useCallback, useEffect, useState } from 'react';

interface Schedule {
  id: string; name: string | null; product_strategy: string; product_id: string | null;
  purpose: string; target_duration_s: number; cadence_days: number; hour_local: number;
  auto_post: string; platforms: string; enabled: number; language: string | null;
  inspiration_item_id: string | null; last_run_at: string | null; next_run_at: string | null;
  last_error: string | null; video_count: number; pending_count: number;
}
interface InspItem { id: string; url: string | null; caption: string | null; status: string; source_name: string | null }

const PURPOSES: Record<string, string> = {
  promo: '🔥 Quảng bá', educate: '📚 Giáo dục', ritual: '🍵 Ritual', launch: '🚀 Ra mắt', testimonial: '💬 Cảm nhận',
};

function fmtVN(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  } catch { return iso; }
}

export function VideoScheduleSection({ brandId, products }: {
  brandId: string; products: Array<{ id: string; name: string }>;
}) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [inspItems, setInspItems] = useState<InspItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState('');
  // form
  const [name, setName] = useState('');
  const [strategy, setStrategy] = useState('rotate');
  const [productId, setProductId] = useState('');
  const [purpose, setPurpose] = useState('promo');
  const [duration, setDuration] = useState(20);
  const [cadence, setCadence] = useState(3);
  const [hour, setHour] = useState(9);
  const [autoPost, setAutoPost] = useState('draft');
  const [pfFb, setPfFb] = useState(true);
  const [pfIg, setPfIg] = useState(false);
  const [inspirationId, setInspirationId] = useState('');

  const load = useCallback(async () => {
    try {
      const [sr, ir] = await Promise.all([
        fetch(`/api/video/schedules?brandId=${brandId}`),
        fetch(`/api/inspiration/items?brandId=${brandId}`),
      ]);
      setSchedules(((await sr.json()).schedules ?? []) as Schedule[]);
      const items = ((await ir.json()).items ?? []) as InspItem[];
      setInspItems(items.filter(i => i.status === 'analyzed'));
    } catch { /* keep */ }
  }, [brandId]);
  useEffect(() => { load(); }, [load]);

  async function create() {
    setMsg('');
    const platforms = [pfFb && 'facebook', pfIg && 'instagram'].filter(Boolean).join(',');
    if (!platforms) { setMsg('❌ Chọn ít nhất 1 kênh đăng'); return; }
    const r = await fetch('/api/video/schedules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandId, name: name || 'Video định kỳ', product_strategy: strategy,
        product_id: strategy === 'fixed' ? productId || null : null,
        purpose, target_duration_s: duration, cadence_days: cadence, hour_local: hour,
        auto_post: autoPost, platforms, inspiration_item_id: inspirationId || null,
      }),
    });
    const d = await r.json() as { ok?: boolean; error?: string };
    if (!d.ok) setMsg('❌ ' + (d.error ?? 'Tạo lịch thất bại'));
    else { setMsg('✅ Đã tạo lịch — video đầu tiên sẽ được dựng trong ≤5 phút.'); setShowForm(false); setName(''); await load(); }
  }

  async function toggle(s: Schedule) {
    await fetch('/api/video/schedules', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: s.id, enabled: s.enabled ? 0 : 1 }),
    });
    await load();
  }
  async function remove(id: string) {
    if (!confirm('Xóa lịch này? (Video đã tạo vẫn giữ nguyên)')) return;
    await fetch(`/api/video/schedules?id=${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wide">⏰ Lịch video định kỳ ({schedules.length})</h3>
        <button onClick={() => setShowForm(v => !v)}
          className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[11px] font-bold">
          {showForm ? 'Đóng' : '+ Lịch mới'}
        </button>
      </div>
      {msg && <p className={`text-xs mb-2 ${msg.startsWith('✅') ? 'text-emerald-400' : 'text-red-400'}`}>{msg}</p>}

      {showForm && (
        <div className="rounded-lg bg-gray-800/60 border border-gray-700/50 p-3 mb-3 grid md:grid-cols-2 gap-2.5">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Tên lịch (vd: Reels quảng bá 3 ngày/lần)"
            className="md:col-span-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white" />
          <select value={strategy} onChange={e => setStrategy(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white">
            <option value="rotate">🔄 Xoay vòng tất cả sản phẩm</option>
            <option value="fixed">📌 1 sản phẩm cố định</option>
          </select>
          {strategy === 'fixed' ? (
            <select value={productId} onChange={e => setProductId(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white">
              <option value="">— Chọn sản phẩm —</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          ) : (
            <select value={purpose} onChange={e => setPurpose(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white">
              {Object.entries(PURPOSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          )}
          {strategy === 'fixed' && (
            <select value={purpose} onChange={e => setPurpose(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white">
              {Object.entries(PURPOSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          )}
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-gray-400 whitespace-nowrap">Mỗi</label>
            <input type="number" min={1} max={30} value={cadence} onChange={e => setCadence(Number(e.target.value))}
              className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-xs text-white" />
            <span className="text-[11px] text-gray-400">ngày, lúc</span>
            <input type="number" min={0} max={23} value={hour} onChange={e => setHour(Number(e.target.value))}
              className="w-14 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-xs text-white" />
            <span className="text-[11px] text-gray-400">giờ VN</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-gray-400">Thời lượng</label>
            <input type="range" min={12} max={45} value={duration} onChange={e => setDuration(Number(e.target.value))} className="flex-1 accent-brand-500" />
            <span className="text-xs text-white w-8">{duration}s</span>
          </div>
          <select value={inspirationId} onChange={e => setInspirationId(e.target.value)}
            className="md:col-span-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white">
            <option value="">— Không dùng khuôn (AI tự do sáng tạo) —</option>
            {inspItems.map(i => <option key={i.id} value={i.id}>🎯 Khuôn: {(i.source_name ? i.source_name + ' · ' : '') + (i.caption?.slice(0, 50) || i.url?.slice(0, 50) || i.id.slice(0, 8))}</option>)}
          </select>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={pfFb} onChange={e => setPfFb(e.target.checked)} className="rounded accent-brand-500" />
              <span className="text-[11px] text-gray-300">Facebook</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={pfIg} onChange={e => setPfIg(e.target.checked)} className="rounded accent-brand-500" />
              <span className="text-[11px] text-gray-300">Instagram Reels</span>
            </label>
          </div>
          <select value={autoPost} onChange={e => setAutoPost(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white">
            <option value="draft">📝 Tạo bài nháp — người duyệt rồi mới đăng (an toàn)</option>
            <option value="auto">⚡ Tự đăng ngay khi render xong</option>
          </select>
          <button onClick={create}
            className="md:col-span-2 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold">
            ⏰ Tạo lịch định kỳ
          </button>
        </div>
      )}

      {schedules.length === 0 && !showForm ? (
        <p className="text-xs text-gray-600 py-3 text-center">Chưa có lịch nào. Đặt lịch để hệ thống tự sản xuất video content định kỳ (xoay vòng sản phẩm, render, tạo bài đăng).</p>
      ) : (
        <div className="space-y-2">
          {schedules.map(s => (
            <div key={s.id} className="rounded-lg bg-gray-800/50 border border-gray-700/40 p-3 flex items-center gap-3 flex-wrap">
              <button onClick={() => toggle(s)} title={s.enabled ? 'Đang bật — bấm để tạm dừng' : 'Đang tắt — bấm để bật'}
                className={`w-9 h-5 rounded-full relative transition-colors ${s.enabled ? 'bg-emerald-600' : 'bg-gray-700'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${s.enabled ? 'left-4.5 right-0.5' : 'left-0.5'}`} style={{ left: s.enabled ? 18 : 2 }} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">
                  {s.name ?? 'Video định kỳ'}
                  <span className="ml-2 text-[10px] text-gray-500 font-normal">
                    {PURPOSES[s.purpose] ?? s.purpose} · {s.product_strategy === 'rotate' ? 'xoay vòng SP' : (products.find(p => p.id === s.product_id)?.name ?? 'SP cố định')} · mỗi {s.cadence_days} ngày {s.hour_local}h VN · {s.platforms} · {s.auto_post === 'auto' ? '⚡ tự đăng' : '📝 nháp'}
                  </span>
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Đã tạo {s.video_count} video{s.pending_count > 0 ? ` · đang render ${s.pending_count}` : ''} · lần tới: {s.next_run_at ? fmtVN(s.next_run_at) : 'trong ≤5 phút'}
                  {s.last_error && <span className="text-red-400"> · ⚠ {s.last_error.slice(0, 80)}</span>}
                </p>
              </div>
              <button onClick={() => remove(s.id)} className="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-red-900/40 text-gray-500 hover:text-red-300 text-[10px]">Xóa</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

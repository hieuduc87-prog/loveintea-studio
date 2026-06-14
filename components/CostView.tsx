'use client';

/** Cost & P&L — unit costs (tunable) + actual-usage roll-up + profit/loss. */

import { useCallback, useEffect, useState } from 'react';

interface Report {
  unit: { caption_usd: number; image_usd: number; video_usd: number; template_usd: number; usd_to_vnd: number };
  usage: { captions: number; images: number; videos: number; templates: number };
  cost: { captions: number; images: number; videos: number; templates: number; total_usd: number; total_vnd: number };
  perType: { single_post: number; image: number; video: number; template: number };
  pnl: { revenue_vnd: number; cost_vnd: number; profit_vnd: number; margin: number };
}

const vnd = (n: number) => n.toLocaleString('vi-VN') + '₫';
const usd = (n: number) => '$' + n.toFixed(3);

export function CostView({ brandId }: { brandId: string }) {
  const [r, setR] = useState<Report | null>(null);
  const [unit, setUnit] = useState<Report['unit'] | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/cost?brand=${brandId}`);
    const d = await res.json() as Report;
    setR(d); setUnit(d.unit);
  }, [brandId]);
  useEffect(() => { load(); }, [load]);

  async function saveUnit() {
    if (!unit) return;
    setSaving(true);
    const res = await fetch(`/api/cost?brand=${brandId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(unit) });
    const d = await res.json() as { report: Report };
    setR(d.report); setSaving(false);
  }

  if (!r || !unit) return <div className="p-6 text-sm text-gray-500">Đang tải…</div>;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <h2 className="text-lg font-semibold text-white">💰 Cost & P&L</h2>

      {/* P&L summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Doanh thu', value: vnd(r.pnl.revenue_vnd), color: 'text-emerald-300' },
          { label: 'Chi phí content', value: vnd(r.pnl.cost_vnd), color: 'text-red-300' },
          { label: `Lợi nhuận (${r.pnl.margin}%)`, value: vnd(r.pnl.profit_vnd), color: r.pnl.profit_vnd >= 0 ? 'text-emerald-300' : 'text-red-400' },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
            <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Unit cost per content type */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
        <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wide mb-3">Chi phí / loại content (ước tính, sửa được)</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {([
            ['caption_usd', 'Caption AI'], ['image_usd', 'Ảnh AI (gpt-image-2)'],
            ['video_usd', 'Video ngắn'], ['template_usd', 'Phân tích template'],
          ] as const).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 flex-1">{label}</span>
              <span className="text-gray-600 text-xs">$</span>
              <input type="number" step="0.001" value={unit[k]} onChange={e => setUnit(u => u && ({ ...u, [k]: Number(e.target.value) }))}
                className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white text-right" />
            </label>
          ))}
          <label className="flex items-center gap-2">
            <span className="text-xs text-gray-400 flex-1">Tỷ giá USD→VND</span>
            <input type="number" value={unit.usd_to_vnd} onChange={e => setUnit(u => u && ({ ...u, usd_to_vnd: Number(e.target.value) }))}
              className="w-24 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white text-right" />
          </label>
        </div>
        <div className="flex items-center gap-3 mt-3 text-[11px] text-gray-400">
          <span>1 post (caption+ảnh) ≈ <b className="text-white">{usd(r.perType.single_post)}</b></span>
          <span>1 video ≈ <b className="text-white">{usd(r.perType.video)}</b></span>
          <button onClick={saveUnit} disabled={saving} className="ml-auto px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-bold">
            {saving ? '⟳' : '💾 Lưu & tính lại'}
          </button>
        </div>
      </div>

      {/* Actual usage cost */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
        <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wide mb-3">Chi phí thực tế đã dùng</h3>
        <table className="w-full text-xs">
          <thead><tr className="text-gray-500 border-b border-gray-800"><th className="text-left py-1.5">Loại</th><th className="text-right">Số lượng</th><th className="text-right">Chi phí</th></tr></thead>
          <tbody className="divide-y divide-gray-800/50">
            {([
              ['Caption', r.usage.captions, r.cost.captions], ['Ảnh', r.usage.images, r.cost.images],
              ['Video', r.usage.videos, r.cost.videos], ['Template', r.usage.templates, r.cost.templates],
            ] as const).map(([label, count, cost]) => (
              <tr key={label}><td className="py-2 text-gray-300">{label}</td><td className="text-right text-gray-400">{count}</td><td className="text-right text-white">{usd(cost)}</td></tr>
            ))}
            <tr className="font-bold"><td className="py-2 text-white">Tổng</td><td></td><td className="text-right text-white">{usd(r.cost.total_usd)} · {vnd(r.cost.total_vnd)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

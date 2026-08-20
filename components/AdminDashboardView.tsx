'use client';

/**
 * AdminDashboardView — trang OVERVIEW cho founder trong Platform Console.
 *
 * Hiển thị:
 *  - 4 widget hàng đầu: Tổng shops / Users active 30d / Cost 30d / Revenue 30d + Profit
 *  - Bảng per-shop: gói, hết hạn, usage%, cost 30d, revenue 30d, members, alerts
 *  - Panel alerts: gọi ra shop nào cần chú ý (trial hết, quota đầy, cost vượt trần)
 *
 * Founder mở là biết toàn cảnh 5-10 giây — không cần đọc log, không cần SSH DB.
 */
import { useState, useEffect } from 'react';

interface Shop {
  id: string; name: string; slug: string; created_at: string;
  plan: string; plan_note: string; expires_at: string | null;
  quota_videos: number; quota_images: number; quota_content: number; cap_usd: number;
  usage_videos: number; usage_images: number; usage_content: number;
  cost_30d_usd: number; revenue_30d_vnd: number; revenue_all_vnd: number;
  members_count: number; last_activity: string | null;
  alerts: Array<{ level: 'warn' | 'critical'; msg: string }>;
}
interface Totals {
  shops: number; users: number; active_users_30d: number;
  cost_30d_usd: number | null; revenue_30d_vnd: number | null; revenue_all_vnd: number | null; profit_30d_vnd: number | null;
}

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + '₫';
const fmtUsd = (n: number) => '$' + n.toFixed(2);
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('vi-VN') : '—';

export function AdminDashboardView() {
  const [data, setData] = useState<{ totals: Totals; shops: Shop[]; show_cost?: boolean; cost_note?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch('/api/admin/dashboard');
        setData(await r.json());
      } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="p-6 text-gray-500 text-sm">Đang tải…</div>;
  if (!data) return <div className="p-6 text-red-400 text-sm">Không tải được dashboard</div>;

  const t = data.totals;
  const showCost = data.show_cost !== false; // undefined = true (backward compat)
  const alertShops = data.shops.filter(s => s.alerts.length > 0);
  const criticalCount = alertShops.reduce((n, s) => n + s.alerts.filter(a => a.level === 'critical').length, 0);
  const warnCount = alertShops.reduce((n, s) => n + s.alerts.filter(a => a.level === 'warn').length, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Widgets hàng đầu — ẩn 3 widget Cost/Revenue/Profit cho non-cost-viewer (manhson) */}
      <div className={`grid grid-cols-2 gap-3 ${showCost ? 'md:grid-cols-5' : 'md:grid-cols-2'}`}>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-[10px] uppercase text-gray-500 tracking-widest">Tổng shops</div>
          <div className="text-2xl font-bold text-white mt-1">{t.shops}</div>
          <div className="text-xs text-gray-500 mt-0.5">{t.users} users tổng</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-[10px] uppercase text-gray-500 tracking-widest">Active 30d</div>
          <div className="text-2xl font-bold text-white mt-1">{t.active_users_30d}</div>
          <div className="text-xs text-gray-500 mt-0.5">{t.users > 0 ? Math.round(t.active_users_30d / t.users * 100) : 0}% tổng users</div>
        </div>
        {showCost && t.cost_30d_usd !== null && (
          <>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-[10px] uppercase text-gray-500 tracking-widest flex items-center gap-1">
                Cost 30d <span title="Ước tính theo bảng giá công bố — không phải billing thật từ provider" className="text-amber-500/60 cursor-help">ⓘ</span>
              </div>
              <div className="text-2xl font-bold text-amber-300 mt-1">{fmtUsd(t.cost_30d_usd)}</div>
              <div className="text-xs text-gray-500 mt-0.5">≈ {fmtVnd(Math.round(t.cost_30d_usd * 25000))} · <span className="italic">ước</span></div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-[10px] uppercase text-gray-500 tracking-widest">Revenue 30d</div>
              <div className="text-2xl font-bold text-green-300 mt-1">{fmtVnd(t.revenue_30d_vnd ?? 0)}</div>
              <div className="text-xs text-gray-500 mt-0.5">All-time: {fmtVnd(t.revenue_all_vnd ?? 0)}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-[10px] uppercase text-gray-500 tracking-widest">Profit 30d</div>
              <div className={`text-2xl font-bold mt-1 ${(t.profit_30d_vnd ?? 0) >= 0 ? 'text-green-300' : 'text-red-400'}`}>{fmtVnd(t.profit_30d_vnd ?? 0)}</div>
              <div className="text-xs text-gray-500 mt-0.5">Revenue − Cost×25000</div>
            </div>
          </>
        )}
      </div>
      {showCost && data.cost_note && (
        <div className="text-[10px] text-gray-600 bg-gray-900/50 border border-gray-800 rounded-lg px-3 py-2">
          💡 <b className="text-gray-500">Về số Cost</b>: {data.cost_note}
        </div>
      )}

      {/* Alerts panel */}
      {alertShops.length > 0 && (
        <div className="bg-amber-950/20 border border-amber-900/50 rounded-xl p-4">
          <div className="text-sm font-semibold text-amber-300 mb-2">
            🚨 {criticalCount} critical · {warnCount} warning
          </div>
          <div className="space-y-1.5">
            {alertShops.slice(0, 5).map(s => (
              <div key={s.id} className="text-xs">
                <span className="text-white font-medium">{s.name}</span>
                <span className="text-gray-500"> · </span>
                {s.alerts.map((a, i) => (
                  <span key={i} className={a.level === 'critical' ? 'text-red-300' : 'text-amber-300'}>
                    {i > 0 && ', '}{a.msg}
                  </span>
                ))}
              </div>
            ))}
            {alertShops.length > 5 && <div className="text-[10px] text-gray-500 mt-1">+{alertShops.length - 5} shop nữa — xem bảng dưới</div>}
          </div>
        </div>
      )}

      {/* Bảng per-shop */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-950 border-b border-gray-800 text-[10px] uppercase text-gray-500">
                <th className="text-left px-4 py-3">Shop</th>
                <th className="text-left px-4 py-3">Gói</th>
                <th className="text-left px-4 py-3">Hết hạn</th>
                {showCost && <th className="text-right px-4 py-3">Cost 30d <span className="text-amber-500/60 normal-case font-normal">(ước)</span></th>}
                {showCost && <th className="text-right px-4 py-3">Revenue 30d</th>}
                <th className="text-center px-4 py-3">Members</th>
                <th className="text-left px-4 py-3">Alerts</th>
                <th className="text-left px-4 py-3">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {data.shops.map(s => {
                const capPct = s.cap_usd > 0 ? Math.min(100, Math.round(s.cost_30d_usd / s.cap_usd * 100)) : 0;
                return (
                  <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{s.name}</div>
                      <a href={`https://${s.slug}.easycreativehub.com`} target="_blank" rel="noreferrer"
                        className="text-[10px] text-gray-500 hover:text-brand-300">/{s.slug}</a>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-300">{s.plan}</div>
                      <div className="text-[10px] text-gray-500">
                        {s.quota_images >= 0 && `${s.usage_images}/${s.quota_images} ảnh · `}
                        cap ${s.cap_usd}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(s.expires_at)}</td>
                    {showCost && (
                      <td className="px-4 py-3 text-right">
                        <div className={`font-mono ${capPct >= 100 ? 'text-red-400' : capPct >= 80 ? 'text-amber-300' : 'text-gray-200'}`}>
                          {fmtUsd(s.cost_30d_usd)}
                        </div>
                        {s.cap_usd > 0 && <div className="text-[10px] text-gray-500">{capPct}% cap</div>}
                      </td>
                    )}
                    {showCost && <td className="px-4 py-3 text-right font-mono text-green-300">{s.revenue_30d_vnd > 0 ? fmtVnd(s.revenue_30d_vnd) : '—'}</td>}
                    <td className="px-4 py-3 text-center text-gray-300">{s.members_count}</td>
                    <td className="px-4 py-3">
                      {s.alerts.length === 0 ? <span className="text-green-500 text-xs">✓</span> : (
                        <div className="space-y-0.5">
                          {s.alerts.map((a, i) => (
                            <div key={i} className={`text-[10px] ${a.level === 'critical' ? 'text-red-400' : 'text-amber-300'}`}>
                              {a.level === 'critical' ? '🔴' : '🟡'} {a.msg}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{s.last_activity ? new Date(s.last_activity).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-[10px] text-gray-600 text-right">
        Cập nhật {new Date().toLocaleTimeString('vi-VN')} · <button onClick={() => location.reload()} className="hover:text-white underline">↻ Refresh</button>
      </div>
    </div>
  );
}

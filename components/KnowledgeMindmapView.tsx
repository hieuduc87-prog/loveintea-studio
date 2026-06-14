'use client';

/** Knowledge Mindmap — radial view of the brand's knowledge graph (DNA, audience,
 *  products, knowledge docs, rules, templates). Click any node to see its detail. */

import { useCallback, useEffect, useState } from 'react';

interface Node { label: string; detail?: string }
interface Branch { key: string; label: string; icon: string; children: Node[] }
interface Data { brand: string; branches: Branch[] }

const COLORS = ['#1A5632', '#E04854', '#F4A020', '#5B8C3E', '#5BBCD2', '#8C6BAE', '#3F8C99', '#A8553E'];

export function KnowledgeMindmapView({ brandId }: { brandId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [sel, setSel] = useState<{ branch: string; node: Node } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/brands/${brandId}/mindmap`);
    setData(await r.json() as Data);
  }, [brandId]);
  useEffect(() => { load(); }, [load]);

  if (!data) return <div className="p-6 text-sm text-gray-500">Đang dựng mindmap…</div>;
  if (!data.branches.length) return <div className="p-6 text-sm text-gray-500">Chưa có tri thức để vẽ. Thêm Brand DNA / Products / tài liệu trước.</div>;

  const W = 1100, H = 720, cx = W / 2, cy = H / 2;
  const N = data.branches.length;
  const R1 = 200;  // branch hub radius
  const R2 = 330;  // children radius

  return (
    <div className="p-4 md:p-6 max-w-[1200px] mx-auto">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-lg font-semibold text-white">🗺️ Knowledge Mindmap</h2>
        <span className="text-xs text-gray-500">Toàn bộ tri thức brand một sơ đồ — bấm node để xem chi tiết</span>
        <button onClick={load} className="ml-auto text-xs text-gray-500 hover:text-white px-2 py-1 rounded bg-gray-800">↻</button>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-950/60 overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '70vh' }}>
          {/* connectors + branches */}
          {data.branches.map((b, i) => {
            const ang = (-90 + i * (360 / N)) * Math.PI / 180;
            const bx = cx + Math.cos(ang) * R1, by = cy + Math.sin(ang) * R1;
            const color = COLORS[i % COLORS.length];
            const shown = b.children.slice(0, 6);
            return (
              <g key={b.key}>
                {/* center → branch */}
                <path d={`M${cx},${cy} Q${(cx + bx) / 2 + Math.cos(ang + 0.5) * 20},${(cy + by) / 2 + Math.sin(ang + 0.5) * 20} ${bx},${by}`}
                  stroke={color} strokeWidth={2} fill="none" opacity={0.5} />
                {shown.map((c, j) => {
                  const spread = Math.min(0.9, 0.28 * (shown.length - 1));
                  const cAng = ang + (shown.length > 1 ? (j - (shown.length - 1) / 2) * (spread / Math.max(1, shown.length - 1)) * 2 : 0);
                  const ux = cx + Math.cos(cAng) * R2, uy = cy + Math.sin(cAng) * R2;
                  const isSel = sel?.branch === b.key && sel?.node.label === c.label && sel?.node.detail === c.detail;
                  return (
                    <g key={j} onClick={() => setSel({ branch: b.label, node: c })} style={{ cursor: 'pointer' }}>
                      <path d={`M${bx},${by} Q${(bx + ux) / 2},${(by + uy) / 2} ${ux},${uy}`} stroke={color} strokeWidth={1} fill="none" opacity={0.3} />
                      <circle cx={ux} cy={uy} r={isSel ? 6 : 4} fill={isSel ? '#fff' : color} stroke={color} strokeWidth={isSel ? 2 : 0} />
                      <text x={ux + (Math.cos(cAng) >= 0 ? 9 : -9)} y={uy + 3}
                        textAnchor={Math.cos(cAng) >= 0 ? 'start' : 'end'}
                        fontSize={11} fill={isSel ? '#fff' : '#cbd5e1'}>{c.label.slice(0, 22)}</text>
                    </g>
                  );
                })}
                {/* branch hub */}
                <g onClick={() => setSel({ branch: b.label, node: { label: b.label, detail: `${b.children.length} mục` } })} style={{ cursor: 'pointer' }}>
                  <circle cx={bx} cy={by} r={26} fill={color} opacity={0.95} />
                  <text x={bx} y={by - 2} textAnchor="middle" fontSize={16}>{b.icon}</text>
                  <text x={bx} y={by + 13} textAnchor="middle" fontSize={8} fill="#fff" fontWeight="bold">{b.label.slice(0, 14)}</text>
                </g>
              </g>
            );
          })}
          {/* center */}
          <circle cx={cx} cy={cy} r={44} fill="#111827" stroke="#1A5632" strokeWidth={3} />
          <text x={cx} y={cy + 5} textAnchor="middle" fontSize={15} fill="#fff" fontWeight="bold">{data.brand.slice(0, 12)}</text>
        </svg>
      </div>

      {/* Detail of clicked node */}
      {sel && (
        <div className="mt-3 rounded-xl border border-brand-600/30 bg-gray-900 p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-600/20 text-brand-300">{sel.branch}</span>
            <span className="text-sm font-semibold text-white">{sel.node.label}</span>
            <button onClick={() => setSel(null)} className="ml-auto text-gray-500 hover:text-white text-sm">✕</button>
          </div>
          {sel.node.detail && <p className="text-xs text-gray-300 whitespace-pre-wrap">{sel.node.detail}</p>}
        </div>
      )}
    </div>
  );
}

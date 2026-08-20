'use client';

/**
 * SetupProgressCard — banner tiến độ setup shop, nổi bật ở top Dashboard.
 *
 * Hiện:
 *  - Progress bar % + "X/8 bước xong"
 *  - Checklist gọn 8 bước (icon ✓ / ⚪) — click vào bước chưa xong → chuyển sang tab đó
 *  - Nút "📖 Xem hướng dẫn A-Z" → chuyển sang tab guide
 *  - Nút "💬 Hỏi trợ lý AI" → mở chatbot floating (dispatch event)
 *  - Nút "Ẩn card" khi 8/8 xong (tự ẩn qua percent=100)
 *
 * Resumable: user bỏ dở giữa chừng → quay lại vẫn thấy đúng tiến độ (đọc từ DB, không
 * phải localStorage) → click bước dở → chuyển sang tab đúng để tiếp tục.
 */
import { useState, useEffect, useCallback } from 'react';

interface Step { id: string; title: string; done: boolean; cta_tab: string | null; hint: string; }
interface Status { total: number; done: number; percent: number; complete: boolean; steps: Step[]; }

export function SetupProgressCard({ brandId, onNavigate }: { brandId: string; onNavigate?: (tab: string) => void }) {
  const [data, setData] = useState<Status | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const load = useCallback(async () => {
    if (!brandId) return;
    try {
      const r = await fetch('/api/onboarding/status');
      if (r.ok) setData(await r.json());
    } catch { /* */ }
  }, [brandId]);

  useEffect(() => { load(); }, [load]);

  if (!data) return null;
  // Ẩn hoàn toàn khi 8/8 (khách đã setup xong, không cần nhắc)
  if (data.complete) return null;

  const nextStep = data.steps.find(s => !s.done);

  return (
    <div className="bg-gradient-to-r from-brand-950/40 via-gray-900 to-gray-900 border border-brand-800/50 rounded-2xl overflow-hidden">
      {/* Header hàng: title + percent + collapse */}
      <div className="px-5 py-4 flex items-center gap-4">
        <div className="flex-shrink-0 w-14 h-14 rounded-full bg-brand-600/20 border-2 border-brand-500 flex items-center justify-center relative">
          <div className="text-lg font-bold text-brand-300">{data.percent}%</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white">🚀 Setup shop: {data.done}/{data.total} bước xong</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {nextStep ? <>Tiếp theo: <span className="text-brand-300 font-medium">{nextStep.title}</span></> : 'Sắp xong!'}
          </div>
        </div>
        <button onClick={() => setCollapsed(v => !v)} className="text-xs text-gray-500 hover:text-white px-2 py-1">
          {collapsed ? '▾ Mở' : '▴ Thu'}
        </button>
      </div>

      {/* Progress bar full-width */}
      <div className="h-1 bg-gray-800">
        <div className="h-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-500" style={{ width: `${data.percent}%` }} />
      </div>

      {/* Checklist chi tiết */}
      {!collapsed && (
        <div className="px-5 py-4 space-y-2">
          {data.steps.map(s => (
            <button
              key={s.id}
              onClick={() => s.cta_tab && !s.done && onNavigate?.(s.cta_tab)}
              disabled={s.done || !s.cta_tab}
              className={`w-full flex items-start gap-3 text-left px-3 py-2 rounded-lg transition-colors ${
                s.done
                  ? 'opacity-60 cursor-default'
                  : s.cta_tab
                    ? 'hover:bg-gray-800 cursor-pointer border border-transparent hover:border-brand-800'
                    : 'opacity-70 cursor-default'
              }`}
            >
              <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${
                s.done ? 'bg-green-600/20 text-green-400 border border-green-700' : 'bg-gray-800 text-gray-500 border border-gray-700'
              }`}>
                {s.done ? '✓' : '○'}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${s.done ? 'text-gray-400 line-through' : 'text-white'}`}>{s.title}</div>
                {!s.done && <div className="text-[11px] text-gray-500 mt-0.5">{s.hint}</div>}
              </div>
              {!s.done && s.cta_tab && (
                <div className="flex-shrink-0 text-xs text-brand-300 font-medium">Đi →</div>
              )}
            </button>
          ))}

          {/* Nút hỗ trợ */}
          <div className="pt-2 mt-2 border-t border-gray-800/50 flex gap-2 flex-wrap">
            <button onClick={() => onNavigate?.('guide')}
              className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-1.5 rounded-lg">
              📖 Xem hướng dẫn A-Z
            </button>
            <button
              onClick={() => document.dispatchEvent(new CustomEvent('help-chatbot:open'))}
              className="text-xs bg-brand-600/20 hover:bg-brand-600/30 border border-brand-700 text-brand-300 px-3 py-1.5 rounded-lg">
              💬 Hỏi trợ lý AI
            </button>
            <button onClick={load} className="text-xs text-gray-500 hover:text-white px-3 py-1.5 ml-auto">↻ Kiểm tra lại</button>
          </div>
        </div>
      )}
    </div>
  );
}

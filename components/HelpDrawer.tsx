'use client';

/**
 * Nút ❓ + drawer hướng dẫn theo TỪNG tab.
 * Dùng chung dữ liệu với tab Guide (lib/guides.ts) — getGuide(tabId) trả đúng
 * hướng dẫn của tab đang mở. Bấm nút ở header → trượt panel từ phải.
 */

import { useState } from 'react';
import { getGuide } from '@/lib/guides';

export function HelpDrawer({ tabId, onOpenFullGuide }: { tabId: string; onOpenFullGuide?: () => void }) {
  const [open, setOpen] = useState(false);
  const g = getGuide(tabId);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Hướng dẫn tab này"
        className="flex items-center justify-center w-7 h-7 rounded-full border border-gray-700 text-gray-400 hover:text-white hover:border-brand-600 transition-colors text-sm">
        ❓
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <aside
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-md h-full bg-gray-950 border-l border-gray-800 shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 h-12 flex items-center gap-2">
              <span className="text-base">{g?.icon ?? '❓'}</span>
              <h2 className="text-sm font-semibold text-white truncate">{g?.title ?? 'Hướng dẫn'}</h2>
              <span className="ml-auto" />
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white text-lg leading-none px-1">✕</button>
            </div>

            <div className="p-4 space-y-4">
              {!g ? (
                <p className="text-sm text-gray-400">Chưa có hướng dẫn cho tab này.</p>
              ) : (
                <>
                  <p className="text-sm text-gray-300 leading-relaxed">{g.intro}</p>

                  {g.steps && g.steps.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-brand-400 uppercase tracking-wide mb-2">Các bước</h3>
                      <ol className="space-y-2">
                        {g.steps.map((s, i) => (
                          <li key={i} className="flex gap-2 text-sm text-gray-300">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-600/20 text-brand-300 text-[11px] flex items-center justify-center font-semibold">{i + 1}</span>
                            <span className="leading-relaxed">{s}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {g.tips && g.tips.length > 0 && (
                    <div className="rounded-lg border border-amber-700/30 bg-amber-900/10 p-3">
                      <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-1.5">💡 Mẹo</h3>
                      <ul className="space-y-1.5">
                        {g.tips.map((t, i) => (
                          <li key={i} className="text-sm text-amber-100/80 leading-relaxed">{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {onOpenFullGuide && (
                <button
                  onClick={() => { setOpen(false); onOpenFullGuide(); }}
                  className="w-full mt-2 text-xs text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 rounded-lg py-2 transition-colors">
                  📖 Mở toàn bộ tài liệu hướng dẫn
                </button>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

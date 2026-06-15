'use client';

import { useState } from 'react';
import { GUIDES, GROUPS } from '@/lib/guides';

/**
 * Hướng dẫn sử dụng — tài liệu bàn giao.
 * 1 tab tổng quan + 1 mục hướng dẫn cho TỪNG tab của hệ thống.
 * Dữ liệu dùng chung tại lib/guides.ts (cùng nguồn với nút ❓ trong mỗi tab).
 */

export function UserGuideView() {
  const [active, setActive] = useState('overview');
  const g = GUIDES.find(x => x.id === active) ?? GUIDES[0];

  return (
    <div className="flex h-full">
      {/* TOC */}
      <div className="w-60 flex-shrink-0 border-r border-gray-800 bg-gray-900/30 overflow-y-auto hidden md:block">
        <div className="px-3 py-4">
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 px-2">Tài liệu bàn giao</p>
          {GROUPS.map(grp => {
            const items = GUIDES.filter(x => x.group === grp);
            if (!items.length) return null;
            return (
              <div key={grp} className="mb-2">
                <p className="px-2 text-[9px] font-bold text-gray-700 uppercase tracking-widest mb-0.5">{grp}</p>
                {items.map(s => (
                  <button key={s.id} onClick={() => setActive(s.id)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors ${active === s.id ? 'bg-brand-600/20 text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                    <span className="text-sm">{s.icon}</span><span className="truncate">{s.title}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-5 md:p-8">
          {/* mobile selector */}
          <select value={active} onChange={e => setActive(e.target.value)}
            className="md:hidden w-full mb-4 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
            {GUIDES.map(s => <option key={s.id} value={s.id}>{s.icon} {s.title}</option>)}
          </select>

          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{g.icon}</span>
            <div>
              <h1 className="text-xl font-bold text-white">{g.title}</h1>
              <p className="text-[11px] text-gray-500 uppercase tracking-widest">{g.group}</p>
            </div>
          </div>
          <p className="text-sm text-gray-300 mb-5 leading-relaxed">{g.intro}</p>

          {g.steps && (
            <div className="mb-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Các bước</p>
              <ol className="space-y-2">
                {g.steps.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                    <span className="text-xs text-gray-300 leading-relaxed">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {g.tips && g.tips.length > 0 && (
            <div className="rounded-xl border border-amber-700/30 bg-amber-900/10 p-3.5">
              <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-1.5">💡 Lưu ý</p>
              {g.tips.map((t, i) => <p key={i} className="text-xs text-amber-100/80 leading-relaxed">• {t}</p>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { SKUS } from '@/lib/brand-dna';

interface Post {
  id: string; sku_id: string; caption: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  platform: string; platforms: string; plan_id?: string;
  scheduled_at?: string; published_at?: string;
}

interface Plan {
  id: string;
  title: string;
  post_count: number;
}

const SKU_COLORS: Record<string, string> = {
  hibiscus: '#5B8C3E', 'nighty-night': '#3F3D99', 'lemon-balm': '#8BBF5C',
  peppermint: '#5BBCD2', dandelion: '#F4A020', ginger: '#A8B525',
};

const STATUS_COLORS: Record<string, string> = {
  published: 'border-l-green-500',
  scheduled:  'border-l-yellow-500',
  draft:      'border-l-gray-600',
  failed:     'border-l-red-500',
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export function CalendarView() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [posts, setPosts] = useState<Post[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Post | null>(null);
  const [dragId, setDragId]   = useState<string | null>(null);
  const [dropDate, setDropDate] = useState<string | null>(null);
  const [moving, setMoving]   = useState(false);
  const [planFilter, setPlanFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const [rPosts, rPlans] = await Promise.all([
      fetch('/api/posts'),
      fetch('/api/plans'),
    ]);
    const dPosts = await rPosts.json() as { posts: Post[] };
    const dPlans = await rPlans.json() as { plans: Plan[] };
    setPosts(dPosts.posts ?? []);
    setPlans(dPlans.plans ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay    = getFirstDayOfMonth(year, month);

  // Filter by plan
  const filtered = planFilter === 'all'
    ? posts
    : planFilter === 'no-plan'
      ? posts.filter(p => !p.plan_id)
      : posts.filter(p => p.plan_id === planFilter);

  // Build day→posts map
  const dayMap: Record<number, Post[]> = {};
  for (const p of filtered) {
    const dateStr = p.scheduled_at ?? p.published_at;
    if (!dateStr) continue;
    const d = new Date(dateStr);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!dayMap[day]) dayMap[day] = [];
      dayMap[day].push(p);
    }
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  async function dropOnDay(day: number) {
    if (!dragId || moving) return;
    const date = new Date(year, month, day, 9, 0, 0).toISOString();
    setMoving(true);
    await fetch(`/api/posts/${dragId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduled_at: date, status: 'scheduled' }),
    });
    setDragId(null); setDropDate(null); setMoving(false);
    await load();
  }

  const sku = (id: string) => SKUS.find(s => s.id === id);
  const monthLabel = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const today = new Date();
  const unscheduled = filtered.filter(p => p.status === 'draft' && !p.scheduled_at);
  const planName = (id: string) => plans.find(p => p.id === id)?.title ?? 'Unknown plan';

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0 gap-3">
        <h2 className="text-lg font-semibold text-white">{monthLabel}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Plan filter */}
          {plans.length > 0 && (
            <select value={planFilter} onChange={e => setPlanFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500">
              <option value="all">All plans</option>
              {plans.map(p => (
                <option key={p.id} value={p.id}>{p.title} ({p.post_count})</option>
              ))}
              <option value="no-plan">Unlinked posts</option>
            </select>
          )}
          {unscheduled.length > 0 && (
            <span className="text-xs text-gray-400">
              {unscheduled.length} unscheduled
            </span>
          )}
          <button onClick={prevMonth} className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-white flex items-center justify-center transition-colors">‹</button>
          <button onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }}
            className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs transition-colors">Today</button>
          <button onClick={nextMonth} className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-white flex items-center justify-center transition-colors">›</button>
          <button onClick={load} className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-white flex items-center justify-center text-xs transition-colors">↻</button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">Loading…</div>
      ) : (
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Calendar grid */}
          <div className="flex-1 overflow-auto">
            <div className="grid grid-cols-7 mb-1">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                <div key={d} className="text-center text-[10px] font-semibold text-gray-600 uppercase py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[80px] rounded-lg" />
              ))}

              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const dayPosts = dayMap[day] ?? [];
                const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
                const isDrop = dropDate === `${year}-${month}-${day}`;

                return (
                  <div key={day}
                    className={`min-h-[80px] rounded-lg border p-1 transition-colors cursor-default ${
                      isToday ? 'border-brand-500 bg-brand-600/10' :
                      isDrop  ? 'border-yellow-500 bg-yellow-900/20' :
                      'border-gray-800 bg-gray-900/30 hover:border-gray-700'
                    }`}
                    onDragOver={e => { e.preventDefault(); setDropDate(`${year}-${month}-${day}`); }}
                    onDragLeave={() => setDropDate(null)}
                    onDrop={e => { e.preventDefault(); dropOnDay(day); }}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <p className={`text-[10px] font-semibold ${isToday ? 'text-brand-400' : 'text-gray-500'}`}>{day}</p>
                      {dayPosts.length > 0 && (
                        <span className="text-[8px] text-gray-600 bg-gray-800 rounded px-1">{dayPosts.length}</span>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {dayPosts.slice(0, 3).map(p => {
                        const s = sku(p.sku_id);
                        const time = (p.scheduled_at ?? p.published_at)
                          ? new Date(p.scheduled_at ?? p.published_at!).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                          : '';
                        return (
                          <div key={p.id}
                            draggable
                            onDragStart={() => setDragId(p.id)}
                            onDragEnd={() => { setDragId(null); setDropDate(null); }}
                            onClick={() => setSelected(p)}
                            className={`border-l-2 pl-1 py-0.5 rounded-sm cursor-grab active:cursor-grabbing text-left bg-gray-900 hover:bg-gray-800 transition-colors ${STATUS_COLORS[p.status] ?? 'border-l-gray-600'}`}
                          >
                            <div className="flex items-center gap-0.5">
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: SKU_COLORS[p.sku_id] ?? s?.color ?? '#888' }} />
                              <span className="text-[9px] text-gray-300 truncate">{time} {s?.name ?? p.sku_id}</span>
                            </div>
                          </div>
                        );
                      })}
                      {dayPosts.length > 3 && (
                        <p className="text-[9px] text-gray-600 pl-1">+{dayPosts.length - 3} more</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-56 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
            {selected ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{sku(selected.sku_id)?.name}</span>
                  <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-sm">✕</button>
                </div>
                <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  selected.status === 'published' ? 'bg-green-900/40 text-green-400' :
                  selected.status === 'scheduled'  ? 'bg-yellow-900/40 text-yellow-400' :
                  'bg-gray-800 text-gray-500'
                }`}>{selected.status}</span>
                {selected.plan_id && (
                  <p className="text-[10px] text-brand-400">📋 {planName(selected.plan_id)}</p>
                )}
                <p className="text-xs text-gray-300 line-clamp-4">{selected.caption}</p>
                {selected.scheduled_at && (
                  <p className="text-[10px] text-gray-500">🗓 {new Date(selected.scheduled_at).toLocaleString()}</p>
                )}
                <p className="text-[10px] text-gray-600">Drag to reschedule</p>
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Unscheduled Drafts</p>
                {unscheduled.length === 0 ? (
                  <p className="text-xs text-gray-600">All drafts scheduled ✓</p>
                ) : (
                  <div className="space-y-1">
                    {unscheduled.slice(0, 10).map(p => {
                      const s = sku(p.sku_id);
                      return (
                        <div key={p.id}
                          draggable
                          onDragStart={() => setDragId(p.id)}
                          onDragEnd={() => { setDragId(null); setDropDate(null); }}
                          className="flex items-center gap-1.5 p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 cursor-grab active:cursor-grabbing transition-colors"
                        >
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: SKU_COLORS[p.sku_id] ?? '#888' }} />
                          <span className="text-xs text-gray-300 truncate">{s?.name ?? p.sku_id}</span>
                        </div>
                      );
                    })}
                    {unscheduled.length > 10 && <p className="text-[10px] text-gray-600">+{unscheduled.length - 10} more</p>}
                  </div>
                )}
              </div>
            )}

            {/* Legend */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-1">
              <p className="text-[10px] font-bold text-gray-500 uppercase">Legend</p>
              {[
                { color: 'bg-green-500', label: 'Published' },
                { color: 'bg-yellow-500', label: 'Scheduled' },
                { color: 'bg-gray-600', label: 'Draft' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-sm ${l.color}`} />
                  <span className="text-[10px] text-gray-400">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

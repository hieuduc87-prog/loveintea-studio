'use client';

import { useEffect, useState, useCallback } from 'react';

interface Post {
  id: string; sku_id: string; caption: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  platform: string; platforms: string; plan_id?: string;
  scheduled_at?: string; published_at?: string;
}

interface Plan {
  id: string; title: string; post_count: number; item_count: number;
}

interface PlanItem {
  id: string; date: string; day_of_week: string; wave: string;
  surface: string; purpose: string; pillar: string;
  hook: string; usp_code: string; product_id: string | null;
  tree_id: string; win_band: string;
}

const SKU_COLORS: Record<string, string> = {
  'prod-hibiscus': '#5B8C3E', 'prod-nighty-night': '#3F3D99', 'prod-lemon-balm': '#8BBF5C',
  'prod-peppermint': '#5BBCD2', 'prod-dandelion': '#F4A020', 'prod-ginger': '#A8B525',
  hibiscus: '#5B8C3E', 'nighty-night': '#3F3D99', 'lemon-balm': '#8BBF5C',
  peppermint: '#5BBCD2', dandelion: '#F4A020', ginger: '#A8B525',
};

const STATUS_COLORS: Record<string, string> = {
  published: 'border-l-green-500',
  scheduled: 'border-l-yellow-500',
  draft:     'border-l-gray-600',
  failed:    'border-l-red-500',
};

const MONTH_IDX: Record<string, number> = {
  Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11
};

function parsePlanDate(dateStr: string): { month: number; day: number } | null {
  const m = dateStr.trim().match(/^(\w{3})\s+(\d+)$/);
  if (!m) return null;
  const month = MONTH_IDX[m[1]];
  const day = parseInt(m[2]);
  if (month === undefined || isNaN(day)) return null;
  return { month, day };
}

function surfaceColor(surface: string): string {
  const s = surface.toLowerCase();
  if (s.includes('reel')) return '#ec4899';
  if (s.includes('carousel')) return '#a855f7';
  return '#3b82f6';
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export function CalendarView({ brandId }: { brandId?: string } = {}) {
  const bid = brandId || 'loveintea';
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [posts, setPosts] = useState<Post[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<(Post | PlanItem) | null>(null);
  const [dragId, setDragId]   = useState<string | null>(null);
  const [dropDate, setDropDate] = useState<string | null>(null);
  const [moving, setMoving]   = useState(false);
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [showPlanItems, setShowPlanItems] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [rPosts, rPlans] = await Promise.all([
      fetch(`/api/posts?brand=${bid}`),
      fetch(`/api/plans?brand=${bid}&include_items=1`),
    ]);
    const dPosts = await rPosts.json() as { posts: Post[] };
    const dPlans = await rPlans.json() as { plans: (Plan & { items?: PlanItem[] })[] };
    setPosts(dPosts.posts ?? []);
    const ps = dPlans.plans ?? [];
    setPlans(ps);

    // Extract items from plans (returned inline — no second auth-gated fetch needed)
    const allItems: PlanItem[] = [];
    for (const p of ps) {
      if (p.items) allItems.push(...p.items);
    }
    setPlanItems(allItems);

    setLoading(false);
  }, [bid]);

  useEffect(() => { load(); }, [load]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay    = getFirstDayOfMonth(year, month);

  // Filter posts by plan
  const filteredPosts = planFilter === 'all' ? posts
    : planFilter === 'no-plan' ? posts.filter(p => !p.plan_id)
    : posts.filter(p => p.plan_id === planFilter);

  // Filter plan items by selected plan
  const filteredItems = showPlanItems
    ? (planFilter === 'all' || planFilter === 'no-plan' ? planItems : planItems.filter(i => {
        const plan = plans.find(p => p.id === planFilter);
        return plan ? true : false;
      }))
    : [];

  // Build day→posts map
  const dayPostsMap: Record<number, Post[]> = {};
  for (const p of filteredPosts) {
    const dateStr = p.scheduled_at ?? p.published_at;
    if (!dateStr) continue;
    const d = new Date(dateStr);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!dayPostsMap[day]) dayPostsMap[day] = [];
      dayPostsMap[day].push(p);
    }
  }

  // Build day→plan items map (current year)
  const dayItemsMap: Record<number, PlanItem[]> = {};
  for (const item of filteredItems) {
    const parsed = parsePlanDate(item.date);
    if (!parsed) continue;
    if (parsed.month !== month) continue;
    const d = parsed.day;
    if (!dayItemsMap[d]) dayItemsMap[d] = [];
    dayItemsMap[d].push(item);
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

  const monthLabel = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const today = new Date();
  const unscheduled = filteredPosts.filter(p => p.status === 'draft' && !p.scheduled_at);
  const planName = (id: string) => plans.find(p => p.id === id)?.title ?? 'Plan';
  const isPlanItem = (s: Post | PlanItem): s is PlanItem => 'hook' in s && !('sku_id' in s);

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
                <option key={p.id} value={p.id}>{p.title} ({p.item_count} items)</option>
              ))}
              <option value="no-plan">Unlinked posts</option>
            </select>
          )}
          {/* Plan items toggle */}
          <button onClick={() => setShowPlanItems(v => !v)}
            className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
              showPlanItems ? 'bg-brand-600/20 text-brand-300 border border-brand-600/40' : 'bg-gray-800 text-gray-500 hover:text-white'
            }`}>
            📋 Plan
          </button>
          {unscheduled.length > 0 && (
            <span className="text-xs text-gray-400">{unscheduled.length} unscheduled</span>
          )}
          <button onClick={prevMonth} className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-white flex items-center justify-center">‹</button>
          <button onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }}
            className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs">Today</button>
          <button onClick={nextMonth} className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-white flex items-center justify-center">›</button>
          <button onClick={load} className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-white flex items-center justify-center text-xs">↻</button>
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
                const dayPosts = dayPostsMap[day] ?? [];
                const dayPlanItems = dayItemsMap[day] ?? [];
                const total = dayPosts.length + dayPlanItems.length;
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
                      {total > 0 && (
                        <span className="text-[8px] text-gray-600 bg-gray-800 rounded px-1">{total}</span>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {/* Plan items (blueprint) */}
                      {dayPlanItems.slice(0, 2).map(item => (
                        <div key={item.id} onClick={() => setSelected(item)}
                          className="border-l-2 pl-1 py-0.5 rounded-sm cursor-pointer text-left bg-brand-950/40 hover:bg-brand-900/30 transition-colors border-l-brand-500/60">
                          <div className="flex items-center gap-0.5">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 flex-none"
                              style={{ backgroundColor: surfaceColor(item.surface) }} />
                            <span className="text-[9px] text-brand-300/80 truncate">{item.surface.split('·')[0].trim()}</span>
                          </div>
                          <p className="text-[8px] text-gray-500 truncate pl-2">{item.hook.slice(0, 30)}</p>
                        </div>
                      ))}
                      {/* Actual posts */}
                      {dayPosts.slice(0, 2).map(p => {
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
                                style={{ backgroundColor: SKU_COLORS[p.sku_id] ?? '#888' }} />
                              <span className="text-[9px] text-gray-300 truncate">{time} {p.sku_id}</span>
                            </div>
                          </div>
                        );
                      })}
                      {total > 4 && (
                        <p className="text-[9px] text-gray-600 pl-1">+{total - 4} more</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-60 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
            {selected ? (
              isPlanItem(selected) ? (
                /* Plan item detail */
                <div className="bg-gray-900 border border-brand-600/30 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-brand-400 uppercase tracking-widest">Plan Item</span>
                    <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-sm">✕</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-brand-600/20 text-brand-300 rounded px-1.5 py-0.5">{selected.wave}</span>
                    <span className="text-[10px] bg-gray-800 text-gray-400 rounded px-1.5 py-0.5">{selected.surface.split('·')[0].trim()}</span>
                  </div>
                  <p className="text-xs font-semibold text-white">"{selected.hook}"</p>
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[9px] bg-gray-800 text-gray-400 rounded px-1.5 py-0.5">{selected.purpose}</span>
                    <span className="text-[9px] bg-gray-800 text-gray-400 rounded px-1.5 py-0.5">{selected.usp_code}</span>
                    <span className="text-[9px] bg-gray-800 text-gray-400 rounded px-1.5 py-0.5">{selected.tree_id}</span>
                    <span className="text-[9px] bg-yellow-900/30 text-yellow-400 rounded px-1.5 py-0.5">Win {selected.win_band}</span>
                  </div>
                  <p className="text-[10px] text-gray-500">{selected.date} · {selected.day_of_week}</p>
                </div>
              ) : (
                /* Post detail */
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{(selected as Post).sku_id}</span>
                    <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-sm">✕</button>
                  </div>
                  <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    (selected as Post).status === 'published' ? 'bg-green-900/40 text-green-400' :
                    (selected as Post).status === 'scheduled'  ? 'bg-yellow-900/40 text-yellow-400' :
                    'bg-gray-800 text-gray-500'
                  }`}>{(selected as Post).status}</span>
                  {(selected as Post).plan_id && (
                    <p className="text-[10px] text-brand-400">📋 {planName((selected as Post).plan_id!)}</p>
                  )}
                  <p className="text-xs text-gray-300 line-clamp-4">{(selected as Post).caption}</p>
                  {(selected as Post).scheduled_at && (
                    <p className="text-[10px] text-gray-500">🗓 {new Date((selected as Post).scheduled_at!).toLocaleString()}</p>
                  )}
                  <p className="text-[10px] text-gray-600">Drag to reschedule</p>
                </div>
              )
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Unscheduled Drafts</p>
                {unscheduled.length === 0 ? (
                  <p className="text-xs text-gray-600">All scheduled ✓</p>
                ) : (
                  <div className="space-y-1">
                    {unscheduled.slice(0, 10).map(p => (
                      <div key={p.id}
                        draggable
                        onDragStart={() => setDragId(p.id)}
                        onDragEnd={() => { setDragId(null); setDropDate(null); }}
                        className="flex items-center gap-1.5 p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 cursor-grab transition-colors"
                      >
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: SKU_COLORS[p.sku_id] ?? '#888' }} />
                        <span className="text-xs text-gray-300 truncate">{p.sku_id}</span>
                      </div>
                    ))}
                    {unscheduled.length > 10 && <p className="text-[10px] text-gray-600">+{unscheduled.length - 10} more</p>}
                  </div>
                )}
              </div>
            )}

            {/* Plan items summary */}
            {showPlanItems && planItems.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
                <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">📋 This Month's Plan</p>
                {planItems.filter(i => {
                  const p = parsePlanDate(i.date);
                  return p && p.month === month;
                }).map(item => (
                  <div key={item.id} onClick={() => setSelected(item)}
                    className="flex items-center gap-1.5 py-1 cursor-pointer hover:bg-gray-800 rounded px-1 transition-colors">
                    <span className="text-[9px] text-gray-600 w-10 flex-shrink-0">{item.date}</span>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: surfaceColor(item.surface) }} />
                    <span className="text-[9px] text-gray-400 truncate">{item.hook.slice(0, 28)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Legend */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-1">
              <p className="text-[10px] font-bold text-gray-500 uppercase">Legend</p>
              {[
                { color: 'bg-brand-500/60', label: 'Plan item' },
                { color: 'bg-green-500', label: 'Published' },
                { color: 'bg-yellow-500', label: 'Scheduled' },
                { color: 'bg-gray-600', label: 'Draft' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${l.color}`} />
                  <span className="text-[10px] text-gray-500">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

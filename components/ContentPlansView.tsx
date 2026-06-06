'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────
interface Plan {
  id: string;
  title: string;
  cadence: string;
  source_file: string;
  stories_json: string;
  summary_json: string;
  created_at: string;
  item_count: number;
  post_count: number;
  scheduled_count: number;
  published_count: number;
}

interface PlanItem {
  id: string;
  date: string;
  day_of_week: string;
  wave: string;
  surface: string;
  purpose: string;
  pillar: string;
  audience_code: string;
  rtb_code: string;
  usp_code: string;
  product_id: string;
  context: string;
  hook: string;
  copy_direction: string;
  visual_direction: string;
  hashtags: string;
  sort_order: number;
}

interface PlanPost {
  id: string;
  sku_id: string;
  status: string;
  scheduled_at: string;
  platforms: string;
  caption: string;
}

interface PlanDetail {
  plan: Plan;
  items: PlanItem[];
  posts: PlanPost[];
  stats: { total: number; draft: number; scheduled: number; published: number };
}

interface StoriesData {
  daily: { day: string; theme: string; signal: string }[];
  highlights: { name: string; holds: string; cover: string }[];
}

// ── Constants ─────────────────────────────────────────────────────────
const SKU_COLORS: Record<string, string> = {
  hibiscus:     '#5B8C3E',
  'nighty-night':'#3F3D99',
  'lemon-balm': '#8BBF5C',
  peppermint:   '#5BBCD2',
  dandelion:    '#F4A020',
  ginger:       '#A8B525',
};

const STATUS_BADGE: Record<string, string> = {
  draft:     'bg-gray-800 text-gray-400',
  scheduled: 'bg-yellow-900/40 text-yellow-400',
  published: 'bg-green-900/40 text-green-400',
};

const SURFACE_BADGE: Record<string, string> = {
  reel:      'bg-pink-900/40 text-pink-300',
  still:     'bg-blue-900/40 text-blue-300',
  carousel:  'bg-purple-900/40 text-purple-300',
};

function surfaceKey(s: string): string {
  const lo = (s ?? '').toLowerCase();
  if (lo.includes('reel')) return 'reel';
  if (lo.includes('carousel')) return 'carousel';
  return 'still';
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch { return iso; }
}

// ── Component ─────────────────────────────────────────────────────────
export function ContentPlansView({ brandId }: { brandId?: string } = {}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [plans, setPlans]       = useState<Plan[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<PlanDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Upload
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragging, setDragging] = useState(false);

  // Tab within plan detail
  const [detailTab, setDetailTab] = useState<'plan' | 'stories' | 'summary'>('plan');

  // ── Load plans list ─────────────────────────────────────────────
  const bid = brandId || 'loveintea';

  const loadPlans = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/plans?brand=${bid}`);
    const d = await r.json() as { plans: Plan[] };
    setPlans(d.plans ?? []);
    setLoading(false);
  }, [bid]);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  // ── Select a plan ───────────────────────────────────────────────
  async function selectPlan(plan: Plan) {
    setDetailLoading(true);
    setDetailTab('plan');
    const r = await fetch(`/api/plans/${plan.id}`);
    const d = await r.json() as PlanDetail;
    setSelected(d);
    setDetailLoading(false);
  }

  // ── Upload new plan ─────────────────────────────────────────────
  async function handleUpload(file: File) {
    if (!file.name.match(/\.xlsx?$/i)) {
      setUploadError('Only .xlsx files supported');
      return;
    }
    setUploading(true);
    setUploadError('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await fetch('/api/import-plan', { method: 'POST', body: fd });
      const d = await r.json() as { ok?: boolean; planId?: string; error?: string };
      if (d.error) {
        setUploadError(d.error);
      } else {
        await loadPlans();
        // Auto-select the newly created plan
        if (d.planId) {
          const r2 = await fetch(`/api/plans/${d.planId}`);
          const d2 = await r2.json() as PlanDetail;
          setSelected(d2);
        }
      }
    } catch (e) {
      setUploadError(String(e));
    } finally {
      setUploading(false);
    }
  }

  // ── Delete a plan ───────────────────────────────────────────────
  async function deletePlan(planId: string) {
    await fetch(`/api/plans/${planId}`, { method: 'DELETE' });
    if (selected?.plan.id === planId) setSelected(null);
    await loadPlans();
  }

  // ── Parse stories/summary from plan JSON ────────────────────────
  const stories: StoriesData | null = selected?.plan.stories_json
    ? (() => { try { return JSON.parse(selected.plan.stories_json); } catch { return null; } })()
    : null;

  const summaryData: { rows: string[][]; dateRange?: { from: string; to: string } } | null = selected?.plan.summary_json
    ? (() => { try { return JSON.parse(selected.plan.summary_json); } catch { return null; } })()
    : null;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-white">Content Plans</h2>
          <p className="text-sm text-gray-500 mt-0.5">Upload and manage monthly content plans</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium transition-colors">
            {uploading ? '⟳ Importing…' : '📥 Upload Plan (.xlsx)'}
          </button>
        </div>
      </div>

      {uploadError && (
        <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">{uploadError}</p>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">Loading…</div>
      ) : plans.length === 0 ? (
        /* Empty state — drop zone */
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
          className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
            dragging ? 'border-brand-500 bg-brand-500/10' : 'border-gray-700 hover:border-gray-600'
          }`}
        >
          <p className="text-4xl mb-3">📋</p>
          <p className="text-white font-medium">Drop your content plan here</p>
          <p className="text-xs text-gray-500 mt-1">Upload a .xlsx file with your monthly content calendar</p>
        </div>
      ) : (
        <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
          {/* ── Plan list (left) ─────────────────────────────────── */}
          <div className="w-72 flex-shrink-0 overflow-y-auto space-y-2">
            {/* Drop zone mini */}
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                dragging ? 'border-brand-500 bg-brand-500/10' : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <p className="text-sm text-gray-400">{uploading ? '⟳ Importing…' : '+ Upload new plan'}</p>
            </div>

            {plans.map(p => {
              const isActive = selected?.plan.id === p.id;
              const draftPct = p.post_count ? Math.round((p.post_count - p.scheduled_count - p.published_count) / p.post_count * 100) : 0;
              const scheduledPct = p.post_count ? Math.round(p.scheduled_count / p.post_count * 100) : 0;
              const publishedPct = p.post_count ? Math.round(p.published_count / p.post_count * 100) : 0;

              return (
                <div key={p.id}
                  onClick={() => selectPlan(p)}
                  className={`p-3 rounded-xl border cursor-pointer transition-colors ${
                    isActive ? 'border-brand-500 bg-brand-600/10' : 'border-gray-800 bg-gray-900 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <p className="text-sm font-semibold text-white truncate flex-1">{p.title}</p>
                    <button onClick={e => { e.stopPropagation(); deletePlan(p.id); }}
                      className="text-gray-600 hover:text-red-400 text-xs ml-2 flex-shrink-0">✕</button>
                  </div>
                  <p className="text-[10px] text-gray-500 mb-2">
                    {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {' · '}{p.post_count} posts · {p.item_count} items
                  </p>

                  {/* Progress bar */}
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-800">
                    {publishedPct > 0 && <div className="bg-green-500" style={{ width: `${publishedPct}%` }} />}
                    {scheduledPct > 0 && <div className="bg-yellow-500" style={{ width: `${scheduledPct}%` }} />}
                    {draftPct > 0 && <div className="bg-gray-600" style={{ width: `${draftPct}%` }} />}
                  </div>
                  <div className="flex gap-3 mt-1.5 text-[10px]">
                    {p.published_count > 0 && <span className="text-green-400">{p.published_count} published</span>}
                    {p.scheduled_count > 0 && <span className="text-yellow-400">{p.scheduled_count} scheduled</span>}
                    <span className="text-gray-500">{p.post_count - p.scheduled_count - p.published_count} draft</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Plan detail (right) ──────────────────────────────── */}
          {detailLoading ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">Loading plan…</div>
          ) : selected ? (
            <div className="flex-1 overflow-y-auto space-y-4">
              {/* Plan header */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-base font-bold text-white">{selected.plan.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {selected.plan.source_file}
                      {summaryData?.dateRange?.from && ` · ${formatDate(summaryData.dateRange.from)} → ${formatDate(summaryData.dateRange.to ?? '')}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {(['plan', 'stories', 'summary'] as const).map(t => (
                      <button key={t} onClick={() => setDetailTab(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                          detailTab === t ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                        }`}>
                        {t === 'plan' ? `📅 Plan (${selected.items.length})` : t === 'stories' ? '📖 Stories' : '📊 Summary'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Total', value: selected.stats.total, color: 'text-white' },
                    { label: 'Draft', value: selected.stats.draft, color: 'text-gray-400' },
                    { label: 'Scheduled', value: selected.stats.scheduled, color: 'text-yellow-400' },
                    { label: 'Published', value: selected.stats.published, color: 'text-green-400' },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-800/50 rounded-lg p-2 text-center">
                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-[10px] text-gray-500">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tab: Plan items */}
              {detailTab === 'plan' && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 border-b border-gray-800 bg-gray-800/30">
                          <th className="text-left px-3 py-2.5 font-medium w-24">Date</th>
                          <th className="text-left px-3 py-2.5 font-medium w-16">Wave</th>
                          <th className="text-left px-3 py-2.5 font-medium w-20">Format</th>
                          <th className="text-left px-3 py-2.5 font-medium">SKU</th>
                          <th className="text-left px-3 py-2.5 font-medium">Hook / Direction</th>
                          <th className="text-left px-3 py-2.5 font-medium w-16">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/50">
                        {selected.items.map((item, i) => {
                          const post = selected.posts[i];
                          const status = post?.status ?? 'draft';
                          return (
                            <tr key={item.id} className="hover:bg-gray-800/30 transition-colors">
                              <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">
                                <div>{formatDate(item.date)}</div>
                                {item.day_of_week && <div className="text-[10px] text-gray-600">{item.day_of_week}</div>}
                              </td>
                              <td className="px-3 py-2.5">
                                {item.wave && (
                                  <span className="text-[10px] bg-gray-800 text-gray-400 rounded px-1.5 py-0.5">{item.wave}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${SURFACE_BADGE[surfaceKey(item.surface)] ?? 'bg-gray-800 text-gray-400'}`}>
                                  {item.surface?.split('·')[0]?.trim() || '—'}
                                </span>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: SKU_COLORS[item.product_id] ?? '#888' }} />
                                  <span className="text-white font-medium capitalize">{(item.product_id ?? '').replace('-', ' ')}</span>
                                </span>
                              </td>
                              <td className="px-3 py-2.5 max-w-[320px]">
                                <p className="text-gray-300 truncate">{item.hook || '—'}</p>
                                {item.copy_direction && (
                                  <p className="text-[10px] text-gray-600 truncate mt-0.5">{item.copy_direction}</p>
                                )}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[status] ?? STATUS_BADGE.draft}`}>
                                  {status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab: Stories */}
              {detailTab === 'stories' && stories && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {stories.daily.length > 0 && (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                      <div className="px-3 py-2.5 border-b border-gray-800 bg-gray-800/30">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Daily Stories Rotation</p>
                      </div>
                      <table className="w-full text-xs">
                        <tbody className="divide-y divide-gray-800/50">
                          {stories.daily.map((s, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2.5 text-brand-400 font-medium whitespace-nowrap w-20">{s.day}</td>
                              <td className="px-3 py-2.5 text-gray-300">{s.theme}</td>
                              <td className="px-3 py-2.5 text-gray-500">{s.signal}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {stories.highlights.length > 0 && (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                      <div className="px-3 py-2.5 border-b border-gray-800 bg-gray-800/30">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Highlights Storefront</p>
                      </div>
                      <table className="w-full text-xs">
                        <tbody className="divide-y divide-gray-800/50">
                          {stories.highlights.map((h, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2.5 text-brand-400 font-medium w-28">{h.name}</td>
                              <td className="px-3 py-2.5 text-gray-300">{h.holds}</td>
                              <td className="px-3 py-2.5 text-gray-500">{h.cover}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {!stories.daily.length && !stories.highlights.length && (
                    <p className="text-gray-500 text-sm">No stories data in this plan.</p>
                  )}
                </div>
              )}

              {/* Tab: Summary */}
              {detailTab === 'summary' && summaryData && (
                <div className="space-y-4">
                  {summaryData.rows && summaryData.rows.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {summaryData.rows.filter(r => r[0] && r[1] && !isNaN(Number(r[1]))).map((r, i) => (
                        <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
                          <p className="text-xl font-bold text-white">{r[1]}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{r[0]}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {(!summaryData.rows || summaryData.rows.length === 0) && (
                    <p className="text-gray-500 text-sm">No summary data in this plan.</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* No plan selected */
            <div className="flex-1 flex items-center justify-center text-center">
              <div>
                <p className="text-4xl mb-3">📋</p>
                <p className="text-white font-medium">Select a plan</p>
                <p className="text-gray-500 text-sm mt-1">View plan details, items, and progress</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

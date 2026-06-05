'use client';

import { useState, useEffect } from 'react';

interface IgMetric {
  name: string;
  values: { value: number; end_time: string }[];
}

interface PostInsight {
  post: {
    id: string; sku_id: string; caption: string;
    fb_post_id: string; published_at: string;
  };
  impressions: number;
  reach: number;
  engaged: number;
  reactions: number;
  comments: number;
  shares: number;
}

interface RollingWindow {
  days: number; posts: number;
  impressions: number; reach: number;
  engaged: number; reactions: number;
  comments: number; shares: number;
}

const SKU_COLORS: Record<string, string> = {
  hibiscus: '#5B8C3E', 'nighty-night': '#3F3D99', 'lemon-balm': '#8BBF5C',
  peppermint: '#5BBCD2', dandelion: '#F4A020', ginger: '#A8B525',
};

function MetricCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
      <p className="text-2xl font-bold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

export function AnalyticsView({ brandId }: { brandId?: string } = {}) {
  const [tab, setTab] = useState<'overview' | 'per-post' | 'ig'>('overview');
  const [days, setDays] = useState(30);

  const [postStats, setPostStats]   = useState<{ total: number; published: number; draft: number; scheduled: number } | null>(null);
  const [fbInsights, setFbInsights] = useState<{ posts: PostInsight[]; rolling: RollingWindow[] } | null>(null);
  const [igInsights, setIgInsights] = useState<IgMetric[]>([]);
  const [igMedia, setIgMedia]       = useState<unknown[]>([]);
  const [loading, setLoading]       = useState(true);
  const [fbLoading, setFbLoading]   = useState(false);
  const [fbError, setFbError]       = useState('');

  useEffect(() => {
    async function loadBase() {
      setLoading(true);
      const [stats, ig] = await Promise.allSettled([
        fetch('/api/analytics/stats').then(r => r.json()),
        fetch('/api/analytics/ig').then(r => r.json()),
      ]);
      if (stats.status === 'fulfilled') setPostStats(stats.value);
      if (ig.status === 'fulfilled') {
        setIgInsights(ig.value.insights ?? []);
        setIgMedia(ig.value.media?.data ?? []);
      }
      setLoading(false);
    }
    loadBase();
  }, []);

  useEffect(() => {
    if (tab !== 'per-post') return;
    setFbLoading(true); setFbError('');
    fetch(`/api/analytics/fb-insights?days=${days}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setFbError(d.error);
        else setFbInsights(d);
      })
      .catch(e => setFbError(String(e)))
      .finally(() => setFbLoading(false));
  }, [tab, days]);

  if (loading) return <div className="text-center text-gray-500 py-20">Loading…</div>;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">

      {/* Tabs */}
      <div className="flex items-center gap-2">
        {[
          { id: 'overview' as const, label: '📊 Overview' },
          { id: 'per-post' as const, label: '📋 Per Post (FB)' },
          { id: 'ig'       as const, label: '📸 Instagram' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
        {tab === 'per-post' && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-500">Window:</span>
            {[3, 7, 14, 30].map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${days === d ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                {d}d
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {postStats && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Content Queue</p>
              <div className="grid grid-cols-4 gap-3">
                <MetricCard label="Total Posts" value={postStats.total} />
                <MetricCard label="Published" value={postStats.published} />
                <MetricCard label="Scheduled" value={postStats.scheduled} />
                <MetricCard label="Drafts" value={postStats.draft} />
              </div>
            </div>
          )}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
            <p className="text-gray-400 text-sm">Go to <button onClick={() => setTab('per-post')} className="text-brand-400 hover:underline">Per Post</button> to see FB reach/engagement per published post,
              or <button onClick={() => setTab('ig')} className="text-brand-400 hover:underline">Instagram</button> for IG insights.</p>
          </div>
        </div>
      )}

      {/* ── PER POST (FB) ── */}
      {tab === 'per-post' && (
        <div className="space-y-5">
          {fbLoading && <div className="text-center text-gray-500 py-10">⟳ Loading FB insights…</div>}
          {fbError && <div className="text-red-400 text-sm p-4 bg-red-900/20 rounded-xl">{fbError}</div>}

          {fbInsights && !fbLoading && (
            <>
              {/* Rolling windows */}
              {fbInsights.rolling.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Rolling Windows</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b border-gray-800">
                          <th className="text-left py-2 pr-4">Period</th>
                          <th className="text-right py-2 pr-4">Posts</th>
                          <th className="text-right py-2 pr-4">Reach</th>
                          <th className="text-right py-2 pr-4">Impressions</th>
                          <th className="text-right py-2 pr-4">Engaged</th>
                          <th className="text-right py-2 pr-4">Reactions</th>
                          <th className="text-right py-2 pr-4">Comments</th>
                          <th className="text-right py-2">Shares</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/50">
                        {fbInsights.rolling.map(w => (
                          <tr key={w.days} className={`${w.days === days ? 'bg-brand-600/10' : ''}`}>
                            <td className="py-2.5 pr-4 font-medium text-white">Day {w.days}</td>
                            <td className="py-2.5 pr-4 text-right text-gray-300">{w.posts}</td>
                            <td className="py-2.5 pr-4 text-right text-white font-semibold">{w.reach.toLocaleString()}</td>
                            <td className="py-2.5 pr-4 text-right text-gray-300">{w.impressions.toLocaleString()}</td>
                            <td className="py-2.5 pr-4 text-right text-green-400">{w.engaged.toLocaleString()}</td>
                            <td className="py-2.5 pr-4 text-right text-pink-400">{w.reactions.toLocaleString()}</td>
                            <td className="py-2.5 pr-4 text-right text-blue-400">{w.comments.toLocaleString()}</td>
                            <td className="py-2.5 text-right text-purple-400">{w.shares.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Per-post table */}
              {fbInsights.posts.length > 0 ? (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
                    Posts — last {days} days ({fbInsights.posts.length} published)
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 border-b border-gray-800">
                          <th className="text-left py-2 pr-3">Date</th>
                          <th className="text-left py-2 pr-3">SKU</th>
                          <th className="text-left py-2 pr-3 max-w-[200px]">Caption</th>
                          <th className="text-right py-2 pr-3">Reach</th>
                          <th className="text-right py-2 pr-3">Impr.</th>
                          <th className="text-right py-2 pr-3">Engaged</th>
                          <th className="text-right py-2 pr-3">❤</th>
                          <th className="text-right py-2 pr-3">💬</th>
                          <th className="text-right py-2">↗</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/30">
                        {fbInsights.posts.map((p, i) => (
                          <tr key={i} className="hover:bg-gray-900/50">
                            <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">
                              {p.post.published_at ? new Date(p.post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                            </td>
                            <td className="py-2 pr-3">
                              <span className="inline-flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SKU_COLORS[p.post.sku_id] ?? '#888' }} />
                                <span className="text-white capitalize">{p.post.sku_id?.replace('-', ' ')}</span>
                              </span>
                            </td>
                            <td className="py-2 pr-3 max-w-[200px] truncate text-gray-400">{p.post.caption?.slice(0, 50)}</td>
                            <td className="py-2 pr-3 text-right font-semibold text-white">{(p.reach ?? 0).toLocaleString()}</td>
                            <td className="py-2 pr-3 text-right text-gray-400">{(p.impressions ?? 0).toLocaleString()}</td>
                            <td className="py-2 pr-3 text-right text-green-400">{(p.engaged ?? 0).toLocaleString()}</td>
                            <td className="py-2 pr-3 text-right text-pink-400">{p.reactions ?? 0}</td>
                            <td className="py-2 pr-3 text-right text-blue-400">{p.comments ?? 0}</td>
                            <td className="py-2 text-right text-purple-400">{p.shares ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-10">
                  <p>No published FB posts found in the last {days} days.</p>
                  <p className="text-xs mt-1">Posts need fb_post_id to pull insights.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── INSTAGRAM ── */}
      {tab === 'ig' && (
        <div className="space-y-5">
          {igInsights.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Instagram Insights (Last 7 days)</p>
              <div className="grid grid-cols-3 gap-3">
                {igInsights.map((m: IgMetric) => {
                  const latest = m.values?.[m.values.length - 1]?.value ?? 0;
                  return (
                    <MetricCard key={m.name}
                      label={m.name.replace(/_/g, ' ')}
                      value={typeof latest === 'number' ? latest : JSON.stringify(latest)} />
                  );
                })}
              </div>
            </div>
          )}

          {igMedia.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Recent IG Posts</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(igMedia as Array<{
                  id: string; media_url?: string; thumbnail_url?: string;
                  caption?: string; like_count?: number; comments_count?: number;
                  reach?: number; timestamp: string;
                }>).slice(0, 8).map(m => (
                  <div key={m.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                    <div className="aspect-square bg-gray-800">
                      {(m.media_url || m.thumbnail_url) && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.media_url ?? m.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="p-2 space-y-1">
                      <p className="text-xs text-gray-400 line-clamp-2">{m.caption?.slice(0, 60)}</p>
                      <div className="flex items-center gap-3 text-[10px] text-gray-500">
                        {m.like_count !== undefined && <span>❤️ {m.like_count}</span>}
                        {m.comments_count !== undefined && <span>💬 {m.comments_count}</span>}
                        {m.reach !== undefined && <span>👁 {m.reach}</span>}
                      </div>
                      <p className="text-[9px] text-gray-600">{new Date(m.timestamp).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {igInsights.length === 0 && igMedia.length === 0 && (
            <div className="text-center text-gray-500 py-20">
              <p className="text-3xl mb-2">📸</p>
              <p>Configure IG_BUSINESS_ACCOUNT_ID in settings to see Instagram analytics.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

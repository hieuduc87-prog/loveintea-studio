'use client';

import { useState, useEffect } from 'react';

interface IgMetric {
  name: string;
  values: { value: number; end_time: string }[];
}

export function AnalyticsView() {
  const [igInsights, setIgInsights] = useState<IgMetric[]>([]);
  const [igMedia, setIgMedia]       = useState<unknown[]>([]);
  const [postStats, setPostStats]   = useState<{ total: number; published: number; draft: number; scheduled: number } | null>(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [stats, ig] = await Promise.allSettled([
          fetch('/api/analytics/stats').then(r => r.json()),
          fetch('/api/analytics/ig').then(r => r.json()),
        ]);
        if (stats.status === 'fulfilled') setPostStats(stats.value);
        if (ig.status === 'fulfilled') {
          setIgInsights(ig.value.insights ?? []);
          setIgMedia(ig.value.media?.data ?? []);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="text-center text-gray-500 py-20">Loading…</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Post Stats */}
      {postStats && (
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Content Queue Stats</h2>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total Posts', value: postStats.total, color: 'text-white' },
              { label: 'Published', value: postStats.published, color: 'text-green-400' },
              { label: 'Scheduled', value: postStats.scheduled, color: 'text-yellow-400' },
              { label: 'Drafts', value: postStats.draft, color: 'text-gray-400' },
            ].map(s => (
              <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* IG Insights */}
      {igInsights.length > 0 && (
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Instagram Insights (Last 7 days)</h2>
          <div className="grid grid-cols-3 gap-3">
            {igInsights.map((m: IgMetric) => {
              const latest = m.values?.[m.values.length - 1]?.value ?? 0;
              return (
                <div key={m.name} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-2xl font-bold text-white">{typeof latest === 'number' ? latest.toLocaleString() : JSON.stringify(latest)}</p>
                  <p className="text-xs text-gray-500 mt-1 capitalize">{m.name.replace(/_/g, ' ')}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* IG Recent Media */}
      {igMedia.length > 0 && (
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Recent IG Posts</h2>
          <div className="grid grid-cols-4 gap-3">
            {(igMedia as Array<{
              id: string;
              media_url?: string;
              thumbnail_url?: string;
              caption?: string;
              like_count?: number;
              comments_count?: number;
              reach?: number;
              timestamp: string;
            }>).slice(0, 8).map(m => (
              <div key={m.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="aspect-square bg-gray-800">
                  {(m.media_url || m.thumbnail_url) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.media_url ?? m.thumbnail_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs text-gray-400 line-clamp-2">{m.caption?.slice(0, 60) ?? ''}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {m.like_count !== undefined && <span className="text-[10px] text-gray-600">❤️ {m.like_count}</span>}
                    {m.comments_count !== undefined && <span className="text-[10px] text-gray-600">💬 {m.comments_count}</span>}
                    {m.reach !== undefined && <span className="text-[10px] text-gray-600">👁 {m.reach}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!postStats && igInsights.length === 0 && (
        <div className="text-center text-gray-500 py-20">
          <p className="text-3xl mb-2">📊</p>
          <p>Configure FB_PAGE_ACCESS_TOKEN and IG_BUSINESS_ACCOUNT_ID<br />in .env.local to see analytics.</p>
        </div>
      )}
    </div>
  );
}

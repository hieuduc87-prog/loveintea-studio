'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { SKUS } from '@/lib/brand-dna';

interface Post {
  id: string; sku_id: string; caption: string; image_url?: string;
  images_json?: string; content_type?: string;
  status: 'draft'|'scheduled'|'published'|'failed'; platform: string;
  scheduled_at?: string; published_at?: string;
  fb_post_id?: string; ig_post_id?: string; created_at: string; cell_id?: string;
}

// Carousel: lấy đủ ảnh từ images_json, fallback về image_url đơn.
function postImages(p: { images_json?: string; image_url?: string }): string[] {
  try { const a = JSON.parse(p.images_json || '[]'); if (Array.isArray(a) && a.length) return a as string[]; } catch { /* */ }
  return p.image_url ? [p.image_url] : [];
}

const STATUS_COLORS: Record<string, string> = {
  draft:     'text-gray-400 bg-gray-800',
  scheduled: 'text-yellow-400 bg-yellow-900/30',
  published: 'text-green-400 bg-green-900/30',
  failed:    'text-red-400 bg-red-900/30',
};

export function ContentQueueView({ brandId }: { brandId?: string } = {}) {
  const [posts, setPosts]       = useState<Post[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');
  const [selected, setSelected] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Publish panel state
  const [scheduledAt, setScheduledAt] = useState('');
  const [toFb, setToFb] = useState(true);
  const [toIg, setToIg] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [pubResult, setPubResult] = useState<{ fb?: { ok: boolean; postId?: string; error?: string }; ig?: { ok: boolean; postId?: string; error?: string } } | null>(null);
  const [pubError, setPubError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const url = filter === 'all' ? '/api/posts' : `/api/posts?status=${filter}`;
    const r = await fetch(url);
    const data = await r.json();
    setPosts(data.posts ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  function selectPost(post: Post) {
    if (selected?.id === post.id) { setSelected(null); return; }
    setSelected(post);
    setScheduledAt('');
    setPubResult(null);
    setPubError('');
  }

  async function deletePost(id: string) {
    if (!confirm('Delete this post?')) return;
    setDeleting(id);
    await fetch(`/api/posts/${id}`, { method: 'DELETE' });
    setPosts(p => p.filter(x => x.id !== id));
    if (selected?.id === id) setSelected(null);
    setDeleting(null);
  }

  async function publish(post: Post) {
    if (!toFb && !toIg) { setPubError('Select at least one platform'); return; }
    setPublishing(true); setPubError(''); setPubResult(null);
    try {
      // Run Review Desk gates before publish
      const reviewRes = await fetch('/api/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, caption: post.caption }),
      });
      const review = await reviewRes.json() as { passed: boolean; gates: Record<string, { passed: boolean; issues: string[] }> };
      if (!review.passed) {
        const issues = Object.entries(review.gates)
          .filter(([, g]) => !g.passed)
          .flatMap(([gate, g]) => g.issues.map((i: string) => `[${gate}] ${i}`));
        setPubError(`Review Desk FAILED:\n${issues.join('\n')}`);
        setPublishing(false);
        return;
      }

      const r = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption: post.caption,
          imageUrls: postImages(post),
          brandId,
          platforms: [...(toFb ? ['facebook'] : []), ...(toIg ? ['instagram'] : [])],
          // datetime-local input is browser-local time — convert to ISO UTC
          // so the server (UTC container) schedules at the intended moment
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        }),
      });
      const d = await r.json() as typeof pubResult & { error?: string };
      if (d?.error) { setPubError(d.error); }
      else {
        setPubResult(d);
        const newStatus = scheduledAt ? 'scheduled' : 'published';
        const fbPostId = d?.fb?.postId ?? '';
        // Persist to DB
        await fetch(`/api/posts/${post.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: newStatus,
            fb_post_id: fbPostId,
            platforms: [...(toFb ? ['facebook'] : []), ...(toIg ? ['instagram'] : [])].join(','),
            published_at: newStatus === 'published' ? new Date().toISOString() : null,
            scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          }),
        });
        setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: newStatus } : p));
        setSelected(prev => prev?.id === post.id ? { ...prev, status: newStatus } : prev);
      }
    } catch (e) { setPubError(String(e)); }
    finally { setPublishing(false); }
  }

  const sku = (id: string) => SKUS.find(s => s.id === id);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto h-full flex flex-col">
      {/* Filters */}
      <div className="flex items-center gap-2 mb-5 flex-shrink-0">
        <h2 className="text-sm font-semibold text-white mr-2">Content Queue</h2>
        {['all','draft','scheduled','published','failed'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${filter === s ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            {s}
          </button>
        ))}
        <button onClick={load} className="ml-auto text-xs text-gray-500 hover:text-white px-3 py-1.5 rounded-lg bg-gray-800">↻ Refresh</button>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-20">Loading…</div>
      ) : posts.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          <p className="text-3xl mb-2">📋</p>
          <p>No posts yet. Generate content in the Content Workshop.</p>
        </div>
      ) : (
        <div className={`flex-1 flex min-h-0 ${selected ? 'flex-col md:flex-row gap-4 md:gap-6 overflow-auto md:overflow-hidden' : 'flex-col overflow-hidden'}`}>
          {/* List */}
          <div className={`flex flex-col gap-2 overflow-y-auto ${selected ? 'md:w-[420px] md:flex-shrink-0' : 'w-full'}`}>
            {posts.map(post => {
              const s = sku(post.sku_id);
              return (
                <div key={post.id} onClick={() => selectPost(post)}
                  className={`bg-gray-900 border rounded-xl p-3 cursor-pointer transition-colors ${selected?.id === post.id ? 'border-brand-500' : 'border-gray-800 hover:border-gray-700'}`}>
                  <div className="flex items-center gap-3">
                    {post.image_url ? (
                      <div className="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800">
                        {post.image_url.startsWith('data:') ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={post.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Image src={post.image_url} alt="" width={48} height={64} className="object-cover w-full h-full" />
                        )}
                      </div>
                    ) : (
                      <div className="w-12 h-16 rounded-lg flex-shrink-0 bg-gray-800 flex items-center justify-center">
                        <span style={{ color: s?.color ?? '#888' }} className="text-xl">●</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s?.color ?? '#888' }} />
                        <span className="text-xs text-white font-medium">{s?.name ?? post.sku_id}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[post.status] ?? STATUS_COLORS.draft}`}>{post.status}</span>
                        {post.fb_post_id && <span className="text-[10px] text-blue-400">📘</span>}
                        {post.ig_post_id && <span className="text-[10px] text-pink-400">📸</span>}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{post.caption?.slice(0, 80)}…</p>
                      <p className="text-[10px] text-gray-600 mt-0.5">
                        {post.scheduled_at ? `🗓 ${new Date(post.scheduled_at).toLocaleString()}` : new Date(post.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); deletePost(post.id); }} disabled={deleting === post.id}
                      className="text-gray-600 hover:text-red-400 transition-colors text-sm p-1 flex-shrink-0">✕</button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detail Panel */}
          {selected && (
            <div className="flex-1 overflow-y-auto min-w-0">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: sku(selected.sku_id)?.color ?? '#888' }} />
                    <span className="text-white font-semibold text-sm">{sku(selected.sku_id)?.productName ?? selected.sku_id}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[selected.status] ?? STATUS_COLORS.draft}`}>{selected.status}</span>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-sm">✕ Close</button>
                </div>

                {/* Image(s) — carousel hiện ĐỦ ảnh từ images_json */}
                {(() => { const imgs = postImages(selected); return imgs.length ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                        {imgs.length > 1 ? `Carousel · ${imgs.length} ảnh` : 'Image'}
                      </p>
                      <div className="flex gap-2">
                        <a href={imgs[0]} download={`loveintea-${selected.sku_id}-${selected.id}.png`}
                          className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded-lg transition-colors">⬇ Download</a>
                        <button onClick={() => navigator.clipboard.writeText(imgs[0].startsWith('/') ? `https://loveintea.wealthpsy.com${imgs[0]}` : imgs[0])}
                          className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded-lg transition-colors">Copy URL</button>
                      </div>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {imgs.map((u, i) => (
                        <div key={i} className="rounded-xl overflow-hidden bg-gray-800 w-40 flex-shrink-0 relative">
                          {u.startsWith('data:')
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={u} alt="" className="w-full aspect-[4/5] object-cover" />
                            : <Image src={`${u}${u.includes('?') ? '&' : '?'}w=400`} alt="" width={160} height={200} className="object-cover w-full aspect-[4/5]" unoptimized />}
                          {imgs.length > 1 && <span className="absolute top-1 left-1 text-[9px] bg-black/70 text-white px-1.5 py-0.5 rounded-full">{i + 1}/{imgs.length}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null; })()}

                {/* Caption */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Caption</p>
                    <button onClick={() => navigator.clipboard.writeText(selected.caption)}
                      className="text-xs text-gray-500 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors">Copy</button>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{selected.caption}</p>
                  </div>
                </div>

                {/* IDs */}
                {(selected.fb_post_id || selected.ig_post_id) && (
                  <div className="space-y-1">
                    {selected.fb_post_id && <p className="text-xs text-blue-400">📘 FB Post ID: {selected.fb_post_id}</p>}
                    {selected.ig_post_id && <p className="text-xs text-pink-400">📸 IG Post ID: {selected.ig_post_id}</p>}
                  </div>
                )}

                {/* Publish Panel */}
                {selected.status !== 'published' && (
                  <div className="border-t border-gray-800 pt-4 space-y-3">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Publish to Social</p>

                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={toFb} onChange={e => setToFb(e.target.checked)} className="rounded accent-brand-500" />
                        <span className="text-sm text-white">📘 Facebook</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={toIg} onChange={e => setToIg(e.target.checked)} className="rounded accent-brand-500" />
                        <span className="text-sm text-white">📸 Instagram</span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Schedule time <span className="text-gray-600">(leave blank = post immediately)</span>
                      </label>
                      <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                        min={new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 16)}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
                      {scheduledAt && (
                        <p className="text-xs text-yellow-400 mt-1">Will post at {new Date(scheduledAt).toLocaleString()}</p>
                      )}
                    </div>

                    {pubError && <p className="text-red-400 text-xs">{pubError}</p>}

                    {pubResult && (
                      <div className="space-y-2">
                        {pubResult.fb && (
                          <div className={`flex items-center gap-2 p-2 rounded-lg text-xs ${pubResult.fb.ok ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
                            {pubResult.fb.ok ? '✅' : '❌'} FB: {pubResult.fb.ok ? `Post ID ${pubResult.fb.postId}` : pubResult.fb.error}
                          </div>
                        )}
                        {pubResult.ig && (
                          <div className={`flex items-center gap-2 p-2 rounded-lg text-xs ${pubResult.ig.ok ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
                            {pubResult.ig.ok ? '✅' : '❌'} IG: {pubResult.ig.ok ? `Post ID ${pubResult.ig.postId}` : pubResult.ig.error}
                          </div>
                        )}
                      </div>
                    )}

                    <button onClick={() => publish(selected)} disabled={publishing || (!toFb && !toIg)}
                      className={`w-full py-2.5 rounded-lg disabled:opacity-50 text-white text-sm font-medium transition-colors ${scheduledAt ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-brand-600 hover:bg-brand-700'}`}>
                      {publishing ? '⟳ Publishing…' : scheduledAt ? '🗓️ Schedule Post' : '📡 Post Now'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

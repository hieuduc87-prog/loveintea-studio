'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { SKUS } from '@/lib/brand-dna';

interface Post {
  id: string; sku_id: string; caption: string; image_url?: string;
  status: 'draft'|'scheduled'|'published'|'failed'; platform: string;
  plan_id?: string;
  scheduled_at?: string; published_at?: string;
  fb_post_id?: string; ig_post_id?: string; created_at: string;
}

interface Plan {
  id: string; title: string; post_count: number;
}

function groupByDate(posts: Post[]): { label: string; posts: Post[] }[] {
  const now = new Date();
  const today    = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const in7      = new Date(today); in7.setDate(today.getDate() + 7);

  const buckets: Record<string, Post[]> = {};
  const order: string[] = [];

  for (const post of posts) {
    const d = new Date(post.scheduled_at ?? post.created_at);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    let key: string;
    if (day.getTime() === today.getTime())    key = '📅 Today';
    else if (day.getTime() === tomorrow.getTime()) key = '⏭ Tomorrow';
    else if (day < in7)   key = `📆 ${day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`;
    else key = `📆 ${day.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;

    if (!buckets[key]) { buckets[key] = []; order.push(key); }
    buckets[key].push(post);
  }
  return order.map(label => ({ label, posts: buckets[label] }));
}

const PLATFORM_BADGE: Record<string, string> = {
  facebook:  'bg-blue-900/40 text-blue-300',
  instagram: 'bg-pink-900/40 text-pink-300',
  both:      'bg-purple-900/40 text-purple-300',
};

export function ScheduleView() {
  const [posts, setPosts]         = useState<Post[]>([]);
  const [plans, setPlans]         = useState<Plan[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<'all'|'facebook'|'instagram'>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [selected, setSelected]   = useState<Post | null>(null);

  // Edit schedule
  const [editTime, setEditTime]   = useState('');
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState('');

  // Publish
  const [toFb, setToFb]           = useState(true);
  const [toIg, setToIg]           = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [pubResult, setPubResult] = useState<{ fb?: { ok: boolean; postId?: string; error?: string }; ig?: { ok: boolean; postId?: string; error?: string } } | null>(null);
  const [pubError, setPubError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [rPosts, rPlans] = await Promise.all([
      fetch('/api/posts'),
      fetch('/api/plans'),
    ]);
    const dPosts = await rPosts.json();
    const dPlans = await rPlans.json();
    setPosts(dPosts.posts ?? []);
    setPlans(dPlans.plans ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openPost(post: Post) {
    setSelected(post);
    setEditTime(post.scheduled_at ? new Date(post.scheduled_at).toISOString().slice(0, 16) : '');
    setPubResult(null); setPubError(''); setSaveMsg('');
    setToFb(true); setToIg(false);
  }

  async function saveSchedule() {
    if (!selected || !editTime) return;
    setSaving(true); setSaveMsg('');
    const r = await fetch(`/api/posts/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduled_at: new Date(editTime).toISOString(), status: 'scheduled' }),
    });
    if (r.ok) {
      setPosts(prev => prev.map(p => p.id === selected.id ? { ...p, scheduled_at: new Date(editTime).toISOString(), status: 'scheduled' } : p));
      setSelected(prev => prev ? { ...prev, scheduled_at: new Date(editTime).toISOString(), status: 'scheduled' } : null);
      setSaveMsg('✓ Schedule saved');
    } else { setSaveMsg('✗ Save failed'); }
    setSaving(false);
  }

  async function publishNow() {
    if (!selected || (!toFb && !toIg)) { setPubError('Select at least one platform'); return; }
    setPublishing(true); setPubError(''); setPubResult(null);
    try {
      const r = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption: selected.caption,
          imageUrls: selected.image_url ? [selected.image_url] : [],
          platforms: [...(toFb ? ['facebook'] : []), ...(toIg ? ['instagram'] : [])],
        }),
      });
      const d = await r.json() as typeof pubResult & { error?: string };
      if (d?.error) setPubError(d.error);
      else {
        setPubResult(d);
        const patch: Record<string, unknown> = {
          status: 'published',
          published_at: new Date().toISOString(),
        };
        if (d?.fb?.ok && d.fb.postId) patch.fb_post_id = d.fb.postId;
        if (d?.ig?.ok && d.ig.postId) patch.ig_post_id = d.ig.postId;
        await fetch(`/api/posts/${selected.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        setPosts(prev => prev.map(p => p.id === selected.id ? { ...p, status: 'published' } : p));
        setSelected(prev => prev ? { ...prev, status: 'published' } : null);
      }
    } catch (e) { setPubError(String(e)); }
    finally { setPublishing(false); }
  }

  async function schedulePost() {
    if (!selected || !editTime || (!toFb && !toIg)) { setPubError('Select platform + time'); return; }
    setPublishing(true); setPubError(''); setPubResult(null);
    try {
      const r = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption: selected.caption,
          imageUrls: selected.image_url ? [selected.image_url] : [],
          platforms: [...(toFb ? ['facebook'] : []), ...(toIg ? ['instagram'] : [])],
          scheduledAt: editTime,
        }),
      });
      const d = await r.json() as typeof pubResult & { error?: string };
      if (d?.error) setPubError(d.error);
      else { setPubResult(d); await saveSchedule(); }
    } catch (e) { setPubError(String(e)); }
    finally { setPublishing(false); }
  }

  // Apply filters
  let filtered = posts;
  if (filter !== 'all') filtered = filtered.filter(p => p.platform === filter);
  if (planFilter !== 'all') {
    filtered = planFilter === 'no-plan'
      ? filtered.filter(p => !p.plan_id)
      : filtered.filter(p => p.plan_id === planFilter);
  }

  const groups = groupByDate(filtered.sort((a, b) => {
    const da = new Date(a.scheduled_at ?? a.created_at).getTime();
    const db = new Date(b.scheduled_at ?? b.created_at).getTime();
    return da - db;
  }));

  const sku = (id: string) => SKUS.find(s => s.id === id);
  const planName = (id: string) => plans.find(p => p.id === id)?.title;

  const stats = {
    total:     filtered.length,
    scheduled: filtered.filter(p => p.status === 'scheduled').length,
    published: filtered.filter(p => p.status === 'published').length,
    draft:     filtered.filter(p => p.status === 'draft').length,
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto h-full flex flex-col">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5 flex-shrink-0">
        {[
          { label: 'Total Posts', value: stats.total, color: 'text-white' },
          { label: 'Scheduled',   value: stats.scheduled, color: 'text-yellow-400' },
          { label: 'Published',   value: stats.published, color: 'text-green-400' },
          { label: 'Draft',       value: stats.draft,     color: 'text-gray-400' },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-5 flex-shrink-0 flex-wrap">
        {(['all','facebook','instagram'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${filter === f ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            {f === 'all' ? '🌐 All' : f === 'facebook' ? '📘 Facebook' : '📸 Instagram'}
          </button>
        ))}
        <div className="w-px h-5 bg-gray-800 mx-1" />
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
        <button onClick={load} className="ml-auto text-xs text-gray-500 hover:text-white px-3 py-1.5 rounded-lg bg-gray-800">↻ Refresh</button>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-20">Loading…</div>
      ) : posts.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          <p className="text-3xl mb-2">📅</p>
          <p>No posts yet. Import a content plan first.</p>
        </div>
      ) : (
        <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
          {/* Timeline */}
          <div className={`overflow-y-auto space-y-6 ${selected ? 'w-[440px] flex-shrink-0' : 'w-full'}`}>
            {groups.map(group => (
              <div key={group.label}>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{group.label}</p>
                <div className="space-y-2">
                  {group.posts.map(post => {
                    const s = sku(post.sku_id);
                    const time = post.scheduled_at ? new Date(post.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—';
                    const pName = post.plan_id ? planName(post.plan_id) : null;
                    return (
                      <div key={post.id} onClick={() => openPost(post)}
                        className={`bg-gray-900 border rounded-xl p-3 cursor-pointer transition-colors flex items-center gap-3 ${selected?.id === post.id ? 'border-brand-500' : 'border-gray-800 hover:border-gray-700'}`}>
                        {/* Time */}
                        <div className="w-14 text-center flex-shrink-0">
                          <p className="text-sm font-bold text-white">{time}</p>
                          <p className={`text-[9px] uppercase font-medium mt-0.5 px-1.5 py-0.5 rounded-full ${
                            post.status === 'published' ? 'bg-green-900/40 text-green-400' :
                            post.status === 'scheduled' ? 'bg-yellow-900/40 text-yellow-400' :
                            'bg-gray-800 text-gray-500'
                          }`}>{post.status}</p>
                        </div>

                        {/* Image */}
                        {post.image_url ? (
                          <div className="w-10 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800">
                            {post.image_url.startsWith('data:') ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={post.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Image src={post.image_url} alt="" width={40} height={48} className="object-cover w-full h-full" />
                            )}
                          </div>
                        ) : (
                          <div className="w-10 h-12 rounded-lg flex-shrink-0 bg-gray-800 flex items-center justify-center">
                            <span style={{ color: s?.color ?? '#888' }}>●</span>
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s?.color ?? '#888' }} />
                            <span className="text-xs text-white font-medium">{s?.name ?? post.sku_id}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${PLATFORM_BADGE[post.platform] ?? PLATFORM_BADGE.both}`}>
                              {post.platform === 'facebook' ? 'FB' : post.platform === 'instagram' ? 'IG' : 'FB+IG'}
                            </span>
                            {post.fb_post_id && <span className="text-[9px] text-blue-400">✓</span>}
                          </div>
                          <p className="text-xs text-gray-400 truncate">{post.caption?.slice(0, 60)}…</p>
                          {pName && <p className="text-[9px] text-brand-400/60 truncate mt-0.5">📋 {pName}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Detail Panel */}
          {selected && (
            <div className="flex-1 overflow-y-auto min-w-0">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: sku(selected.sku_id)?.color ?? '#888' }} />
                    <span className="text-white font-semibold text-sm">{sku(selected.sku_id)?.productName ?? selected.sku_id}</span>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-sm">✕</button>
                </div>

                {selected.plan_id && (
                  <p className="text-xs text-brand-400">📋 From plan: {planName(selected.plan_id)}</p>
                )}

                {/* Image */}
                {selected.image_url && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-gray-500 uppercase">Image</p>
                      <a href={selected.image_url} download={`loveintea-${selected.id}.png`}
                        className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded-lg">⬇ Download</a>
                    </div>
                    <div className="rounded-xl overflow-hidden bg-gray-800 max-w-[220px]">
                      {selected.image_url.startsWith('data:') ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={selected.image_url} alt="" className="w-full" />
                      ) : (
                        <Image src={selected.image_url} alt="" width={220} height={275} className="object-cover w-full" />
                      )}
                    </div>
                  </div>
                )}

                {/* Caption */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-500 uppercase">Caption</p>
                    <button onClick={() => navigator.clipboard.writeText(selected.caption)}
                      className="text-xs text-gray-500 hover:text-white px-2 py-1 rounded hover:bg-gray-800">Copy</button>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-xs text-white whitespace-pre-wrap leading-relaxed">{selected.caption}</p>
                  </div>
                </div>

                {/* Publish Controls */}
                {selected.status !== 'published' && (
                  <div className="border-t border-gray-800 pt-4 space-y-3">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Publish Settings</p>

                    <div className="grid grid-cols-2 gap-2">
                      <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors ${toFb ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 hover:border-gray-600'}`}>
                        <input type="checkbox" checked={toFb} onChange={e => setToFb(e.target.checked)} className="accent-blue-500" />
                        <span className="text-sm">📘 Facebook</span>
                      </label>
                      <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors ${toIg ? 'border-pink-500 bg-pink-900/20' : 'border-gray-700 hover:border-gray-600'}`}>
                        <input type="checkbox" checked={toIg} onChange={e => setToIg(e.target.checked)} className="accent-pink-500" />
                        <span className="text-sm">📸 Instagram</span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Schedule time <span className="text-gray-600">(blank = post immediately)</span>
                      </label>
                      <input type="datetime-local" value={editTime} onChange={e => setEditTime(e.target.value)}
                        min={new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 16)}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 w-full" />
                      {editTime && (
                        <p className="text-xs text-yellow-400 mt-1">🗓 {new Date(editTime).toLocaleString()}</p>
                      )}
                    </div>

                    {saveMsg && <p className="text-xs text-green-400">{saveMsg}</p>}
                    {pubError && <p className="text-xs text-red-400">{pubError}</p>}

                    {pubResult && (
                      <div className="space-y-1">
                        {pubResult.fb && (
                          <p className={`text-xs p-2 rounded-lg ${pubResult.fb.ok ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
                            {pubResult.fb.ok ? `✅ FB: ${pubResult.fb.postId}` : `❌ FB: ${pubResult.fb.error}`}
                          </p>
                        )}
                        {pubResult.ig && (
                          <p className={`text-xs p-2 rounded-lg ${pubResult.ig.ok ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
                            {pubResult.ig.ok ? `✅ IG: ${pubResult.ig.postId}` : `❌ IG: ${pubResult.ig.error}`}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={publishNow} disabled={publishing}
                        className="py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium transition-colors">
                        {publishing ? '⟳' : '📡'} Post Now
                      </button>
                      <button onClick={schedulePost} disabled={publishing || !editTime}
                        className="py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white text-sm font-medium transition-colors">
                        {publishing ? '⟳' : '🗓️'} Schedule
                      </button>
                    </div>

                    {editTime && (
                      <button onClick={saveSchedule} disabled={saving}
                        className="w-full py-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-xs font-medium transition-colors">
                        {saving ? '⟳ Saving…' : '💾 Save time only (no publish yet)'}
                      </button>
                    )}
                  </div>
                )}

                {selected.status === 'published' && (
                  <div className="border-t border-gray-800 pt-4 space-y-2">
                    <p className="text-xs text-green-400 font-medium">✅ Published</p>
                    {selected.fb_post_id && <p className="text-xs text-blue-400">📘 FB Post ID: {selected.fb_post_id}</p>}
                    {selected.ig_post_id && <p className="text-xs text-pink-400">📸 IG Post ID: {selected.ig_post_id}</p>}
                    {selected.published_at && <p className="text-xs text-gray-500">At: {new Date(selected.published_at).toLocaleString()}</p>}
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

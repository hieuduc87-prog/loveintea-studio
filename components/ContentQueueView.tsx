'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { SKUS } from '@/lib/brand-dna';

interface Post {
  id: string;
  sku_id: string;
  caption: string;
  image_url?: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  platform: string;
  scheduled_at?: string;
  published_at?: string;
  fb_post_id?: string;
  ig_post_id?: string;
  created_at: string;
  cell_id?: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft:     'text-gray-400 bg-gray-800',
  scheduled: 'text-yellow-400 bg-yellow-900/30',
  published: 'text-green-400 bg-green-900/30',
  failed:    'text-red-400 bg-red-900/30',
};

export function ContentQueueView() {
  const [posts, setPosts]         = useState<Post[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<string>('all');
  const [selected, setSelected]   = useState<Post | null>(null);
  const [deleting, setDeleting]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const url = filter === 'all' ? '/api/posts' : `/api/posts?status=${filter}`;
    const r = await fetch(url);
    const data = await r.json();
    setPosts(data.posts ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function deletePost(id: string) {
    if (!confirm('Delete this post?')) return;
    setDeleting(id);
    await fetch(`/api/posts/${id}`, { method: 'DELETE' });
    setPosts(p => p.filter(x => x.id !== id));
    if (selected?.id === id) setSelected(null);
    setDeleting(null);
  }

  const sku = (id: string) => SKUS.find(s => s.id === id);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-sm font-semibold text-white mr-2">Content Queue</h2>
        {['all', 'draft', 'scheduled', 'published', 'failed'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
              filter === s ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {s}
          </button>
        ))}
        <button onClick={load} className="ml-auto text-xs text-gray-500 hover:text-white px-3 py-1.5 rounded-lg bg-gray-800">
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-20">Loading…</div>
      ) : posts.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          <p className="text-3xl mb-2">📋</p>
          <p>No posts yet. Generate content in the Content Workshop.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {posts.map(post => {
            const s = sku(post.sku_id);
            return (
              <div
                key={post.id}
                onClick={() => setSelected(selected?.id === post.id ? null : post)}
                className={`bg-gray-900 border rounded-xl p-4 cursor-pointer transition-colors ${
                  selected?.id === post.id ? 'border-brand-500' : 'border-gray-800 hover:border-gray-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  {s && (
                    <div className="w-10 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800">
                      <Image src={s.image} alt={s.name} width={40} height={48} className="object-cover w-full h-full" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: s?.color ?? '#888' }}
                      />
                      <span className="text-xs text-white font-medium">{s?.name ?? post.sku_id}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[post.status] ?? STATUS_COLORS.draft}`}>
                        {post.status}
                      </span>
                      <span className="text-[10px] text-gray-600 uppercase">{post.platform}</span>
                      {post.fb_post_id && <span className="text-[10px] text-blue-400">FB ✓</span>}
                      {post.ig_post_id && <span className="text-[10px] text-pink-400">IG ✓</span>}
                    </div>
                    <p className="text-sm text-gray-300 truncate">{post.caption?.slice(0, 100)}…</p>
                    <p className="text-[10px] text-gray-600 mt-1">
                      {post.scheduled_at ? `Scheduled: ${new Date(post.scheduled_at).toLocaleString()}` : `Created: ${new Date(post.created_at).toLocaleString()}`}
                    </p>
                  </div>
                  {post.image_url && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800">
                      {post.image_url.startsWith('data:') ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={post.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Image src={post.image_url} alt="" width={48} height={48} className="object-cover w-full h-full" />
                      )}
                    </div>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); deletePost(post.id); }}
                    disabled={deleting === post.id}
                    className="text-gray-600 hover:text-red-400 transition-colors text-sm p-1 flex-shrink-0"
                  >
                    ✕
                  </button>
                </div>

                {selected?.id === post.id && (
                  <div className="mt-4 pt-4 border-t border-gray-800 space-y-3">
                    <div>
                      <p className="text-xs font-bold text-gray-500 mb-1">Full Caption</p>
                      <p className="text-sm text-white whitespace-pre-wrap">{post.caption}</p>
                    </div>
                    {post.image_url && (
                      <div>
                        <p className="text-xs font-bold text-gray-500 mb-2">Image</p>
                        <div className="w-48 rounded-lg overflow-hidden">
                          {post.image_url.startsWith('data:') ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={post.image_url} alt="" className="w-full" />
                          ) : (
                            <Image src={post.image_url} alt="" width={192} height={240} className="object-cover w-full" />
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <a
                        href={`/api/posts/${post.id}/publish`}
                        className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs rounded-lg transition-colors"
                        onClick={async e => {
                          e.preventDefault();
                          const r = await fetch(`/api/posts/${post.id}/publish`, { method: 'POST' });
                          const d = await r.json();
                          if (d.ok) { load(); }
                          else { alert(d.error); }
                        }}
                      >
                        📡 Publish Now
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

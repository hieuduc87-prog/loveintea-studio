'use client';

import { useState, useEffect } from 'react';
import { SKUS } from '@/lib/brand-dna';

interface BlogPost {
  id: string;
  sku_id?: string;
  topic: string;
  title?: string;
  status: string;
  created_at: string;
}

export function BlogFactoryView() {
  const [topic, setTopic]     = useState('');
  const [skuId, setSkuId]     = useState('');
  const [loading, setLoading] = useState(false);
  const [posts, setPosts]     = useState<BlogPost[]>([]);
  const [selected, setSelected] = useState<{ post: BlogPost; content: string } | null>(null);
  const [error, setError]     = useState('');

  useEffect(() => { loadPosts(); }, []);

  async function loadPosts() {
    const r = await fetch('/api/blog');
    const d = await r.json();
    setPosts(d.posts ?? []);
  }

  async function generate() {
    if (!topic.trim()) { setError('Topic required'); return; }
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, skuId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await loadPosts();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function viewPost(id: string) {
    const r = await fetch(`/api/blog/${id}`);
    const d = await r.json();
    const post = posts.find(p => p.id === id);
    if (post) setSelected({ post, content: d.content ?? '' });
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-5 gap-6">
        {/* Generator */}
        <div className="col-span-2 space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-4">Blog Factory</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Topic</label>
                <input
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                  placeholder="e.g. benefits of ginger tea, bedtime ritual with herbal tea"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">SKU Focus (optional)</label>
                <select
                  value={skuId}
                  onChange={e => setSkuId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="">All SKUs</option>
                  {SKUS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button
                onClick={generate}
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {loading ? '⟳ Writing blog…' : '📝 Generate Blog'}
              </button>
            </div>
          </div>

          {/* List */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase">Blog Posts</h3>
              <button onClick={loadPosts} className="text-xs text-gray-600 hover:text-white">↻</button>
            </div>
            <div className="space-y-2">
              {posts.length === 0 ? (
                <p className="text-gray-600 text-xs text-center py-4">No posts yet</p>
              ) : posts.map(p => (
                <button
                  key={p.id}
                  onClick={() => viewPost(p.id)}
                  className={`w-full text-left p-2 rounded-lg border transition-colors ${
                    selected?.post.id === p.id ? 'border-brand-500 bg-brand-600/10' : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <p className="text-xs text-white font-medium truncate">{p.title ?? p.topic}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-gray-600">{new Date(p.created_at).toLocaleDateString()}</span>
                    <span className={`text-[10px] px-1 rounded ${p.status === 'published' ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                      {p.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Preview */}
        <div className="col-span-3">
          {selected ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white">{selected.post.title ?? selected.post.topic}</h3>
                <button
                  onClick={() => navigator.clipboard.writeText(selected.content)}
                  className="text-xs text-gray-500 hover:text-white px-2 py-1 rounded bg-gray-800"
                >
                  Copy
                </button>
              </div>
              <div className="prose prose-invert prose-sm max-w-none overflow-auto max-h-[70vh]">
                <div
                  className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: selected.content }}
                />
              </div>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl h-96 flex flex-col items-center justify-center text-center">
              <p className="text-4xl mb-3">📝</p>
              <p className="text-white font-medium mb-1">Generate a Blog Post</p>
              <p className="text-gray-500 text-sm">1500+ words, SEO optimized, English<br />with LoveinTea brand voice.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

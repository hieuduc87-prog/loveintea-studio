'use client';

import { useState } from 'react';

interface PublishResult {
  fb?: { ok: boolean; postId?: string; error?: string };
  ig?: { ok: boolean; postId?: string; error?: string };
}

export function PublisherView() {
  const [caption, setCaption]     = useState('');
  const [imageUrl, setImageUrl]   = useState('');
  const [toFb, setToFb]           = useState(true);
  const [toIg, setToIg]           = useState(true);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<PublishResult | null>(null);
  const [error, setError]         = useState('');

  async function publish() {
    if (!caption.trim()) { setError('Caption required'); return; }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const r = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption,
          imageUrls: imageUrl ? [imageUrl] : [],
          platforms: [...(toFb ? ['facebook'] : []), ...(toIg ? ['instagram'] : [])],
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Manual Publisher</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Caption</label>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-brand-500 h-40"
              placeholder="Paste caption from Content Workshop…"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Image URL (HTTPS, publicly accessible)</label>
            <input
              type="url"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              placeholder="https://…"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Platforms</label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={toFb} onChange={e => setToFb(e.target.checked)} className="rounded" />
                <span className="text-sm text-white">📘 Facebook Page</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={toIg} onChange={e => setToIg(e.target.checked)} className="rounded" />
                <span className="text-sm text-white">📸 Instagram</span>
              </label>
            </div>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            onClick={publish}
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {loading ? '⟳ Publishing…' : '📡 Publish Now'}
          </button>
        </div>
      </div>

      {result && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">Publish Result</h3>
          {result.fb && (
            <div className={`flex items-center gap-3 p-3 rounded-lg ${result.fb.ok ? 'bg-green-900/20 border border-green-800' : 'bg-red-900/20 border border-red-800'}`}>
              <span className="text-lg">{result.fb.ok ? '✅' : '❌'}</span>
              <div>
                <p className="text-sm font-medium text-white">Facebook</p>
                {result.fb.ok ? (
                  <p className="text-xs text-green-400">Post ID: {result.fb.postId}</p>
                ) : (
                  <p className="text-xs text-red-400">{result.fb.error}</p>
                )}
              </div>
            </div>
          )}
          {result.ig && (
            <div className={`flex items-center gap-3 p-3 rounded-lg ${result.ig.ok ? 'bg-green-900/20 border border-green-800' : 'bg-red-900/20 border border-red-800'}`}>
              <span className="text-lg">{result.ig.ok ? '✅' : '❌'}</span>
              <div>
                <p className="text-sm font-medium text-white">Instagram</p>
                {result.ig.ok ? (
                  <p className="text-xs text-green-400">Post ID: {result.ig.postId}</p>
                ) : (
                  <p className="text-xs text-red-400">{result.ig.error}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Env Check */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Required Environment Variables</h3>
        <div className="space-y-1 text-xs font-mono">
          {['FB_PAGE_ID', 'FB_PAGE_ACCESS_TOKEN', 'IG_BUSINESS_ACCOUNT_ID'].map(k => (
            <div key={k} className="flex items-center gap-2 text-gray-400">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              {k}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

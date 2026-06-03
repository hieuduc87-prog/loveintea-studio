'use client';

import { useState, useEffect, useCallback } from 'react';

interface Page { id: string; name: string; category: string; access_token: string; picture?: { data?: { url?: string } } }
interface FbStatus { connected: boolean; pageId: string; pageName: string; igId: string; pageInfo: Record<string, unknown> }
interface PublishResult { fb?: { ok: boolean; postId?: string; error?: string }; ig?: { ok: boolean; postId?: string; error?: string } }

export function PublisherView() {
  const [tab, setTab] = useState<'setup' | 'post' | 'schedule'>('setup');
  const [status, setStatus] = useState<FbStatus | null>(null);

  // Setup state
  const [userToken, setUserToken]   = useState('');
  const [pages, setPages]           = useState<Page[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [savingPage, setSavingPage] = useState(false);
  const [setupMsg, setSetupMsg]     = useState('');

  // Post state
  const [caption, setCaption]     = useState('');
  const [imageUrl, setImageUrl]   = useState('');
  const [toFb, setToFb]           = useState(true);
  const [toIg, setToIg]           = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [result, setResult]       = useState<PublishResult | null>(null);
  const [postError, setPostError] = useState('');

  const loadStatus = useCallback(async () => {
    const r = await fetch('/api/fb-setup/status');
    const d = await r.json() as FbStatus;
    setStatus(d);
    if (d.connected) setTab('post');
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  async function fetchPages() {
    if (!userToken.trim()) return;
    setLoadingPages(true);
    setSetupMsg('');
    const r = await fetch('/api/fb-setup/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userToken }),
    });
    const d = await r.json() as { pages?: Page[]; error?: string };
    if (d.error) { setSetupMsg('Error: ' + d.error); }
    else { setPages(d.pages ?? []); }
    setLoadingPages(false);
  }

  async function savePage(page: Page) {
    setSavingPage(true);
    const r = await fetch('/api/fb-setup/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageId: page.id, pageAccessToken: page.access_token, pageName: page.name }),
    });
    const d = await r.json() as { ok?: boolean; igAccountId?: string; error?: string };
    if (d.ok) {
      setSetupMsg(`✅ Saved! LoveinTea Official connected${d.igAccountId ? ` + IG ${d.igAccountId}` : ''}`);
      await loadStatus();
      setTimeout(() => setTab('post'), 1200);
    } else {
      setSetupMsg('Error: ' + d.error);
    }
    setSavingPage(false);
  }

  async function publish() {
    if (!caption.trim()) { setPostError('Caption required'); return; }
    setPublishing(true);
    setPostError('');
    setResult(null);
    const r = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caption,
        imageUrls: imageUrl ? [imageUrl] : [],
        platforms: [...(toFb ? ['facebook'] : []), ...(toIg ? ['instagram'] : [])],
        scheduledAt: scheduledAt || undefined,
      }),
    });
    const d = await r.json() as PublishResult & { error?: string };
    if (d.error) setPostError(d.error);
    else setResult(d);
    setPublishing(false);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      {/* Status banner */}
      {status?.connected && (
        <div className="flex items-center gap-3 p-3 bg-green-900/20 border border-green-800/50 rounded-xl">
          {Boolean(status.pageInfo?.picture) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={(status.pageInfo.picture as { data?: { url?: string } })?.data?.url ?? ''} alt="" className="w-10 h-10 rounded-full" />
          )}
          <div>
            <p className="text-sm text-white font-medium">{status.pageName || (status.pageInfo?.name as string)} <span className="text-green-400">✓ Connected</span></p>
            <p className="text-xs text-gray-500">
              Page ID: {status.pageId}
              {status.igId && ` · IG: ${status.igId}`}
              {status.pageInfo?.fan_count ? ` · ${(status.pageInfo.fan_count as number).toLocaleString()} fans` : ''}
            </p>
          </div>
          <button onClick={() => setTab('setup')} className="ml-auto text-xs text-gray-500 hover:text-white">Change</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: 'setup' as const, label: '🔑 FB Setup' },
          { id: 'post'  as const, label: '📡 Post Now' },
          { id: 'schedule' as const, label: '🗓️ Schedule' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Setup Tab */}
      {tab === 'setup' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Connect LoveinTea Official Page</h2>

          <div className="bg-gray-800/50 rounded-lg p-3 text-xs text-gray-400 space-y-1">
            <p className="font-medium text-white">How to get User Access Token:</p>
            <p>1. Go to <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">Graph API Explorer</a></p>
            <p>2. App: <strong className="text-white">select your app (1267157968709745)</strong></p>
            <p>3. Click <strong className="text-white">Generate Access Token</strong> → log in as page admin</p>
            <p>4. Paste the token below</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">User Access Token</label>
            <textarea
              value={userToken}
              onChange={e => setUserToken(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white font-mono resize-none focus:outline-none focus:border-brand-500 h-20"
              placeholder="Paste User Access Token here…"
            />
          </div>

          <button
            onClick={fetchPages}
            disabled={loadingPages || !userToken.trim()}
            className="w-full py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {loadingPages ? '⟳ Loading pages…' : '🔍 List my Pages'}
          </button>

          {setupMsg && (
            <p className={`text-sm ${setupMsg.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>{setupMsg}</p>
          )}

          {pages.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase">Select LoveinTea Official</p>
              {pages.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
                  {p.picture?.data?.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.picture.data.url} alt="" className="w-8 h-8 rounded-full flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.category} · {p.id}</p>
                  </div>
                  <button
                    onClick={() => savePage(p)}
                    disabled={savingPage}
                    className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs rounded-lg transition-colors flex-shrink-0"
                  >
                    {savingPage ? '…' : 'Use this page'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Post / Schedule Tab */}
      {(tab === 'post' || tab === 'schedule') && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Caption</label>
              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-brand-500 h-40"
                placeholder="Paste caption from Content Workshop…"
              />
              <p className="text-[10px] text-gray-600 mt-1">{caption.length} chars</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Image URL (HTTPS publicly accessible)</label>
              <input
                type="url"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                placeholder="https://loveintea.wealthpsy.com/generated/…"
              />
              {imageUrl && !imageUrl.startsWith('data:') && (
                <div className="mt-2 w-24 h-28 rounded-lg overflow-hidden bg-gray-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">Platforms</label>
              <div className="flex gap-4">
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

            {/* Schedule picker */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Schedule time <span className="text-gray-600">(leave blank = post immediately)</span>
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                min={new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 16)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
              {scheduledAt && (
                <p className="text-xs text-yellow-400 mt-1">
                  Will be scheduled for {new Date(scheduledAt).toLocaleString()}
                </p>
              )}
            </div>

            {postError && <p className="text-red-400 text-xs">{postError}</p>}

            <button
              onClick={publish}
              disabled={publishing || (!toFb && !toIg)}
              className={`w-full py-2.5 rounded-lg disabled:opacity-50 text-white text-sm font-medium transition-colors ${
                scheduledAt ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-brand-600 hover:bg-brand-700'
              }`}
            >
              {publishing ? '⟳ Publishing…' : scheduledAt ? '🗓️ Schedule Post' : '📡 Post Now'}
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">Result</h3>
          {result.fb && (
            <div className={`flex items-center gap-3 p-3 rounded-lg ${result.fb.ok ? 'bg-green-900/20 border border-green-800' : 'bg-red-900/20 border border-red-800'}`}>
              <span>{result.fb.ok ? '✅' : '❌'}</span>
              <div>
                <p className="text-sm text-white">Facebook {scheduledAt ? '(scheduled)' : ''}</p>
                {result.fb.ok
                  ? <p className="text-xs text-green-400">Post ID: {result.fb.postId}</p>
                  : <p className="text-xs text-red-400">{result.fb.error}</p>
                }
              </div>
            </div>
          )}
          {result.ig && (
            <div className={`flex items-center gap-3 p-3 rounded-lg ${result.ig.ok ? 'bg-green-900/20 border border-green-800' : 'bg-red-900/20 border border-red-800'}`}>
              <span>{result.ig.ok ? '✅' : '❌'}</span>
              <div>
                <p className="text-sm text-white">Instagram</p>
                {result.ig.ok
                  ? <p className="text-xs text-green-400">Post ID: {result.ig.postId}</p>
                  : <p className="text-xs text-red-400">{result.ig.error}</p>
                }
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

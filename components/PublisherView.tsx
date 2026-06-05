'use client';

import { useState, useEffect, useCallback } from 'react';

interface OAuthPage {
  id: string; pageId: string; pageName: string;
  igAccountId: string; isActive: boolean; fbUserName: string; expiresAt: string;
}
interface FbStatus { connected: boolean; pageId: string; pageName: string; igId: string; pageInfo: Record<string, unknown> }
interface PublishResult { fb?: { ok: boolean; postId?: string; error?: string }; ig?: { ok: boolean; postId?: string; error?: string } }

export function PublisherView({ fbSuccess, fbError }: { fbSuccess?: boolean; fbError?: string } = {}) {
  const [tab, setTab] = useState<'setup' | 'post' | 'schedule'>('setup');
  const [status, setStatus] = useState<FbStatus | null>(null);

  // OAuth connection state
  const [oauthPages, setOauthPages]   = useState<OAuthPage[]>([]);
  const [oauthConnected, setOauthConnected] = useState(false);
  const [oauthMsg, setOauthMsg]       = useState('');
  const [activating, setActivating]   = useState('');
  const [disconnecting, setDisconnecting] = useState(false);

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

  const loadOauthPages = useCallback(async () => {
    const r = await fetch('/api/auth/facebook/pages');
    const d = await r.json() as { connected: boolean; pages: OAuthPage[] };
    setOauthPages(d.pages ?? []);
    setOauthConnected(d.connected);
  }, []);

  useEffect(() => {
    loadStatus();
    loadOauthPages();
    // Handle FB OAuth result passed from page.tsx via server searchParams
    if (fbSuccess) {
      setOauthMsg('✅ Facebook connected successfully!');
      setTab('setup');
      loadOauthPages().then(() => loadStatus());
    } else if (fbError) {
      setOauthMsg(`❌ Facebook connection failed: ${fbError === 'denied' ? 'You declined the permissions.' : fbError}`);
      setTab('setup');
    }
  }, [loadStatus, loadOauthPages, fbSuccess, fbError]);

  async function activatePage(pageId: string) {
    setActivating(pageId);
    const r = await fetch('/api/auth/facebook/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageId }),
    });
    const d = await r.json() as { ok?: boolean; error?: string };
    if (d.ok) {
      await loadOauthPages();
      await loadStatus();
      setOauthMsg(`✅ Switched to page: ${oauthPages.find(p => p.pageId === pageId)?.pageName}`);
    } else {
      setOauthMsg('❌ ' + d.error);
    }
    setActivating('');
  }

  async function disconnect() {
    if (!confirm('Disconnect Facebook? This will remove all stored page tokens.')) return;
    setDisconnecting(true);
    await fetch('/api/auth/facebook/disconnect', { method: 'POST' });
    setOauthPages([]);
    setOauthConnected(false);
    setStatus(null);
    setOauthMsg('Disconnected from Facebook.');
    setTab('setup');
    setDisconnecting(false);
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
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
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
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Facebook / Instagram Connection</h2>
            {oauthConnected && (
              <button
                onClick={disconnect}
                disabled={disconnecting}
                className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
              >
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
            )}
          </div>

          {oauthMsg && (
            <p className={`text-sm ${oauthMsg.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>{oauthMsg}</p>
          )}

          {!oauthConnected ? (
            <div className="space-y-4">
              <div className="bg-gray-800/50 rounded-lg p-3 text-xs text-gray-400 space-y-1">
                <p>Click the button below to log in with Facebook and grant access to your Pages and Instagram account. No tokens are stored in plaintext — everything is encrypted with AES-256-GCM.</p>
                <p className="pt-1">Permissions requested: post, read messages, comments, analytics.</p>
              </div>
              <a
                href="/api/auth/facebook/start"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-[#1877F2] hover:bg-[#166fe5] text-white text-sm font-medium transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Connect with Facebook
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Connected Pages</p>
              {oauthPages.map(p => (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    p.isActive
                      ? 'bg-green-900/20 border-green-800/50'
                      : 'bg-gray-800 border-gray-700'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">{p.pageName}</p>
                    <p className="text-xs text-gray-500">
                      ID: {p.pageId}
                      {p.igAccountId ? ` · IG: ${p.igAccountId}` : ''}
                    </p>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      Token expires: {new Date(p.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  {p.isActive ? (
                    <span className="text-xs text-green-400 font-medium flex-shrink-0">Active</span>
                  ) : (
                    <button
                      onClick={() => activatePage(p.pageId)}
                      disabled={activating === p.pageId}
                      className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs rounded-lg transition-colors flex-shrink-0"
                    >
                      {activating === p.pageId ? '…' : 'Use this'}
                    </button>
                  )}
                </div>
              ))}
              <a
                href="/api/auth/facebook/start"
                className="block text-center text-xs text-brand-400 hover:text-brand-300 pt-1"
              >
                Re-authorize or add more pages
              </a>
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

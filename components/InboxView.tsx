'use client';

import { useState, useEffect, useCallback } from 'react';

interface Message {
  id: string;
  platform: string;
  sender_name?: string;
  message_type: string;
  text?: string;
  is_read: boolean;
  received_at: string;
}

interface FbPost {
  id: string;
  message?: string;
  created_time: string;
  full_picture?: string;
  insights?: { data: { name: string; values: { value: number }[] }[] };
}

export function InboxView() {
  const [tab, setTab]           = useState<'messages' | 'comments' | 'feed'>('messages');
  const [messages, setMessages] = useState<Message[]>([]);
  const [fbPosts, setFbPosts]   = useState<FbPost[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/inbox');
      const d = await r.json();
      setMessages(d.messages ?? []);
    } catch {
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFbFeed = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/analytics/fb-posts');
      const d = await r.json();
      setFbPosts(d.data ?? []);
    } catch {
      setError('Failed to load FB feed');
    } finally {
      setLoading(false);
    }
  }, []);

  const syncInbox = useCallback(async () => {
    setLoading(true);
    try {
      await fetch('/api/inbox/sync', { method: 'POST' });
      await loadMessages();
    } catch {
      setError('Sync failed');
    }
  }, [loadMessages]);

  useEffect(() => {
    if (tab === 'messages' || tab === 'comments') loadMessages();
    else if (tab === 'feed') loadFbFeed();
  }, [tab, loadMessages, loadFbFeed]);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Tab bar */}
      <div className="flex items-center gap-2 mb-6">
        {(['messages', 'comments', 'feed'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {t === 'messages' ? '💬 Messages' : t === 'comments' ? '🗣️ Comments' : '📰 FB Feed'}
          </button>
        ))}
        <button
          onClick={syncInbox}
          className="ml-auto px-3 py-2 bg-gray-800 text-gray-400 hover:text-white text-sm rounded-lg"
        >
          ↻ Sync
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 mb-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-500 py-20">Loading…</div>
      ) : (tab === 'messages' || tab === 'comments') ? (
        messages.length === 0 ? (
          <div className="text-center text-gray-500 py-20">
            <p className="text-3xl mb-2">💬</p>
            <p>No messages. Click Sync to pull from Facebook.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`bg-gray-900 border rounded-xl p-4 ${
                  msg.is_read ? 'border-gray-800' : 'border-brand-500/50 bg-brand-600/5'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm">{msg.platform === 'facebook' ? '📘' : '📸'}</span>
                  <span className="text-sm text-white font-medium">{msg.sender_name ?? 'Unknown'}</span>
                  <span className="text-xs text-gray-600 capitalize">{msg.message_type}</span>
                  {!msg.is_read && <span className="ml-auto text-xs bg-brand-600 text-white px-1.5 py-0.5 rounded-full">new</span>}
                  <span className="text-xs text-gray-600 ml-auto">{new Date(msg.received_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-300">{msg.text ?? '(no text)'}</p>
              </div>
            ))}
          </div>
        )
      ) : (
        /* FB Feed */
        fbPosts.length === 0 ? (
          <div className="text-center text-gray-500 py-20">
            <p className="text-3xl mb-2">📰</p>
            <p>No posts loaded. Sync to fetch FB page feed.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {fbPosts.map(post => {
              const impressions = post.insights?.data?.find(d => d.name === 'post_impressions')?.values?.[0]?.value;
              const engaged     = post.insights?.data?.find(d => d.name === 'post_engaged_users')?.values?.[0]?.value;
              return (
                <div key={post.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-4">
                  {post.full_picture && (
                    <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={post.full_picture} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300 line-clamp-3">{post.message ?? '(no caption)'}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-gray-500">{new Date(post.created_time).toLocaleDateString()}</span>
                      {impressions !== undefined && (
                        <span className="text-xs text-gray-500">👁 {impressions.toLocaleString()}</span>
                      )}
                      {engaged !== undefined && (
                        <span className="text-xs text-gray-500">🔥 {engaged.toLocaleString()} engaged</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

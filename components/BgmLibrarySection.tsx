'use client';

/**
 * Kho nhạc nền — upload mp3, upload video (tự bóc nhạc), hoặc dán link reel/video
 * (chỉ lấy audio). Lịch định kỳ auto-pick từ kho (ít-dùng-nhất trước); tạo video tay
 * chọn từ dropdown. BPM được detect sẵn để cắt cảnh theo beat.
 */

import { useCallback, useEffect, useState } from 'react';

export interface BgmTrack {
  id: string; name: string | null; url: string; duration_s: number; bpm: number | null;
  source: string; source_url: string | null; use_count: number; status: string; error: string | null;
}

export function BgmLibrarySection({ brandId, onTracks }: {
  brandId: string; onTracks?: (tracks: BgmTrack[]) => void;
}) {
  const [tracks, setTracks] = useState<BgmTrack[]>([]);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/video/bgm?brandId=${brandId}`);
      const t = ((await r.json()).tracks ?? []) as BgmTrack[];
      setTracks(t);
      onTracks?.(t.filter(x => x.status === 'ready'));
    } catch { /* keep */ }
  }, [brandId, onTracks]);
  useEffect(() => { load(); }, [load]);

  // Poll khi có track đang xử lý (tải link / detect BPM)
  useEffect(() => {
    if (!tracks.some(t => t.status === 'processing')) return;
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [tracks, load]);

  async function addLink() {
    if (!link.trim()) { setMsg('❌ Dán link video/reel có nhạc hay'); return; }
    setBusy(true); setMsg('');
    const r = await fetch('/api/video/bgm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId, url: link.trim() }),
    });
    const d = await r.json() as { ok?: boolean; error?: string };
    if (!d.ok) setMsg('❌ ' + (d.error ?? 'Lỗi'));
    else { setMsg('✅ Đang tải nhạc từ link (chỉ lấy audio)…'); setLink(''); await load(); }
    setBusy(false);
  }

  async function upload(file: File) {
    setBusy(true); setMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file); fd.append('brandId', brandId);
      const r = await fetch('/api/video/bgm', { method: 'POST', body: fd });
      const d = await r.json() as { ok?: boolean; error?: string };
      if (!d.ok) setMsg('❌ ' + (d.error ?? 'Upload lỗi'));
      else { setMsg('✅ Đã thêm vào kho nhạc' + (file.type.startsWith('video/') ? ' (đã bóc nhạc từ video)' : '')); await load(); }
    } catch (e) { setMsg('❌ ' + String(e)); }
    setBusy(false);
  }

  async function remove(id: string) {
    if (!confirm('Xóa track này khỏi kho?')) return;
    await fetch(`/api/video/bgm?id=${id}`, { method: 'DELETE' });
    await load();
  }

  const ready = tracks.filter(t => t.status === 'ready').length;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wide">
          🎵 Kho nhạc nền ({ready} bài{tracks.length > ready ? ` · ${tracks.length - ready} đang xử lý/lỗi` : ''})
        </h3>
        <button onClick={() => setOpen(v => !v)}
          className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-[11px] font-semibold">
          {open ? 'Thu gọn' : 'Quản lý kho'}
        </button>
      </div>
      <p className="text-[10px] text-gray-600 mt-1">Lịch định kỳ tự chọn nhạc từ kho (xoay vòng đều). Nhạc có BPM → video cắt cảnh theo beat.</p>
      {msg && <p className={`text-xs mt-2 ${msg.startsWith('✅') ? 'text-emerald-400' : 'text-red-400'}`}>{msg}</p>}

      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex gap-2 flex-wrap">
            <input value={link} onChange={e => setLink(e.target.value)}
              placeholder="Dán link video/reel có nhạc hay (IG/FB/TikTok/YT) — chỉ lấy phần nhạc"
              className="flex-1 min-w-[220px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white" />
            <button onClick={addLink} disabled={busy}
              className="px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-bold">
              🎵 Lấy nhạc từ link
            </button>
            <label className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-semibold cursor-pointer">
              📁 Upload mp3/video
              <input type="file" accept="audio/*,video/*" className="hidden" disabled={busy}
                onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
          </div>

          {tracks.length === 0 ? (
            <p className="text-xs text-gray-600 py-2 text-center">Kho trống. Thêm 5-10 bài hợp vibe brand — hệ thống sẽ xoay vòng tự động.</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {tracks.map(t => (
                <div key={t.id} className="rounded-lg bg-gray-800/50 border border-gray-700/40 px-3 py-2 flex items-center gap-3">
                  <span className="text-sm">{t.status === 'processing' ? '⏳' : t.status === 'failed' ? '⚠️' : '🎵'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-white truncate">{t.name || t.id.slice(0, 8)}</p>
                    <p className="text-[9px] text-gray-500">
                      {t.status === 'processing' ? 'đang xử lý…'
                        : t.status === 'failed' ? (t.error?.slice(0, 90) ?? 'lỗi')
                        : `${Math.round(t.duration_s)}s${t.bpm ? ` · ${Math.round(t.bpm)} BPM` : ''} · đã dùng ${t.use_count} lần · ${t.source === 'link' ? 'từ link' : t.source === 'video_extract' ? 'bóc từ video' : 'upload'}`}
                    </p>
                  </div>
                  {t.status === 'ready' && <audio src={t.url} controls preload="none" className="h-7 w-40" />}
                  <button onClick={() => remove(t.id)} className="text-gray-600 hover:text-red-400 text-xs">✕</button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-gray-600">⚠ Nhạc lấy từ link có thể dính bản quyền khi chạy quảng cáo — an toàn nhất là nhạc mua license / royalty-free. Nhạc trending nên gắn native trong app khi đăng, không nhúng vào file.</p>
        </div>
      )}
    </div>
  );
}

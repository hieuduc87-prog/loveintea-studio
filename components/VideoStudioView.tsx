'use client';

/**
 * Video Studio — kho clip brand + tạo video ngắn hybrid (clip + ảnh AI),
 * beat-sync nhạc, text-on-video theo brand DNA. AI làm 95%, người duyệt.
 */

import { useCallback, useEffect, useState } from 'react';
import { chunkedUpload } from '@/lib/chunk-upload';
import { VideoScheduleSection } from './VideoScheduleSection';
import { BgmLibrarySection, BgmTrack } from './BgmLibrarySection';

interface Clip {
  id: string; url: string; duration_s: number; width: number; height: number;
  tags_json: string; status: string;
}
interface Project {
  id: string; title: string | null; purpose: string | null; status: string;
  target_duration_s: number; bpm: number | null; bgm_url: string | null;
  script_json: string; output_url: string | null; error: string | null; created_at: string;
}
interface SegmentView { dur_s: number; source: string; text?: string }

const PURPOSES = [
  { id: 'promo', label: '🔥 Quảng bá sản phẩm' },
  { id: 'educate', label: '📚 Giáo dục / mẹo' },
  { id: 'ritual', label: '🍵 Ritual / lifestyle' },
  { id: 'launch', label: '🚀 Ra mắt mới' },
  { id: 'testimonial', label: '💬 Cảm nhận khách' },
];

export function VideoStudioView({ brandId }: { brandId: string }) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');

  // form
  const [purpose, setPurpose] = useState('promo');
  const [productId, setProductId] = useState('');
  const [duration, setDuration] = useState(20);
  const [notes, setNotes] = useState('');
  const [language, setLanguage] = useState('en');
  const [bgmUrl, setBgmUrl] = useState('');
  const [bgmName, setBgmName] = useState('');
  const [useVoiceover, setUseVoiceover] = useState(true);
  const [voVoice, setVoVoice] = useState('nova');
  const [referenceClipId, setReferenceClipId] = useState('');
  const [bgmTracks, setBgmTracks] = useState<BgmTrack[]>([]);

  const load = useCallback(async () => {
    try {
      const clipUrl = productId
        ? `/api/video/clips?brandId=${brandId}&productId=${productId}`
        : `/api/video/clips?brandId=${brandId}`;
      const [cr, pr, prods] = await Promise.all([
        fetch(clipUrl),
        fetch(`/api/video/projects?brandId=${brandId}`),
        fetch(`/api/products?brand=${brandId}`).catch(() => null),
      ]);
      setClips(((await cr.json()).clips ?? []) as Clip[]);
      setProjects(((await pr.json()).projects ?? []) as Project[]);
      if (prods?.ok) {
        const d = await prods.json() as { products?: Array<{ id: string; name: string }> };
        setProducts(d.products ?? []);
      }
    } catch { /* keep */ }
  }, [brandId, productId]);

  useEffect(() => { load(); }, [load]);

  // Poll while anything is queued/rendering
  useEffect(() => {
    const busy = projects.some(p => p.status === 'queued' || p.status === 'rendering');
    if (!busy) return;
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [projects, load]);

  // Upload a brand-level clip (when no product selected; product clips upload in Products tab)
  async function uploadClip(file: File) {
    setUploading(true); setMsg('');
    try {
      if (productId) {
        const res = await chunkedUpload(file, 'product_media', { productId });
        if (res.error) setMsg('❌ ' + res.error);
        else { setMsg('✅ Clip vào kho sản phẩm (AI đang phân tích…)'); await load(); }
      } else {
        const fd = new FormData();
        fd.append('file', file); fd.append('brandId', brandId);
        const r = await fetch('/api/video/clips', { method: 'POST', body: fd });
        const d = await r.json() as { ok?: boolean; error?: string };
        if (!d.ok) setMsg('❌ ' + (d.error ?? 'Upload failed'));
        else { setMsg('✅ Clip đã vào kho (đã autotag)'); await load(); }
      }
    } catch (e) { setMsg('❌ ' + String(e)); }
    setUploading(false);
  }

  // BGM: accept an audio file (direct) OR a video file (auto-extract its audio track)
  async function uploadBgm(file: File) {
    setUploading(true); setMsg('');
    try {
      const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|mkv)$/i.test(file.name);
      if (isVideo) {
        setMsg('⏳ Đang bóc nhạc nền từ video…');
        const res = await chunkedUpload(file, 'bgm_video', {});
        if (res.error || !res.url) setMsg('❌ ' + (res.error ?? 'Bóc nhạc thất bại'));
        else { setBgmUrl(res.url); setBgmName(file.name + ' (audio)'); setMsg('✅ Đã bóc nhạc nền từ video'); }
      } else {
        const fd = new FormData();
        fd.append('file', file); fd.append('brandId', brandId);
        const r = await fetch('/api/video/clips', { method: 'POST', body: fd });
        const d = await r.json() as { ok?: boolean; url?: string; error?: string };
        if (!d.ok || !d.url) setMsg('❌ ' + (d.error ?? 'Upload failed'));
        else { setBgmUrl(d.url); setBgmName(file.name); setMsg('✅ Đã chọn nhạc: ' + file.name); }
      }
    } catch (e) { setMsg('❌ ' + String(e)); }
    setUploading(false);
  }

  async function createProject() {
    setCreating(true); setMsg('');
    try {
      const r = await fetch('/api/video/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, purpose, productId: productId || undefined, targetDurationS: duration, bgmUrl: bgmUrl || undefined, notes: notes || undefined, useVoiceover, voVoice, language, referenceClipId: referenceClipId || undefined }),
      });
      const d = await r.json() as { ok?: boolean; bpm?: number; error?: string; recipe?: { scenes: number; structure?: string } | null };
      if (!d.ok) setMsg('❌ ' + (d.error ?? 'Tạo storyboard thất bại'));
      else { setMsg(`✅ Storyboard sẵn sàng${d.bpm ? ` — beat-sync ${Math.round(d.bpm)} BPM` : ''}${d.recipe ? ` — học công thức ${d.recipe.scenes} cảnh từ video mẫu` : ''}. Bấm Render để dựng video.`); setNotes(''); await load(); }
    } catch (e) { setMsg('❌ ' + String(e)); }
    setCreating(false);
  }

  async function render(id: string) {
    await fetch(`/api/video/projects/${id}/render`, { method: 'POST' });
    await load();
  }
  async function remove(id: string) {
    if (!confirm('Xóa project này?')) return;
    await fetch(`/api/video/projects/${id}`, { method: 'DELETE' });
    await load();
  }

  const statusBadge = (s: string) => ({
    draft: 'bg-gray-700 text-gray-300', queued: 'bg-sky-600/30 text-sky-300',
    rendering: 'bg-amber-600/30 text-amber-300 animate-pulse', done: 'bg-emerald-600/30 text-emerald-300',
    failed: 'bg-red-600/30 text-red-300',
  }[s] ?? 'bg-gray-700 text-gray-300');

  const segs = (p: Project): SegmentView[] => { try { return (JSON.parse(p.script_json).segments ?? []) as SegmentView[]; } catch { return []; } };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      {msg && <p className={`text-xs ${msg.startsWith('✅') ? 'text-emerald-400' : 'text-red-400'}`}>{msg}</p>}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* ── New project ── */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 space-y-3">
          <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wide">🎬 Tạo video ngắn (9:16)</h3>
          <select value={purpose} onChange={e => setPurpose(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white">
            {PURPOSES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <select value={productId} onChange={e => setProductId(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white">
            <option value="">— Không gắn sản phẩm cụ thể —</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={language} onChange={e => setLanguage(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white">
            <option value="en">🇬🇧 English (text + voiceover) — mặc định, bán US</option>
            <option value="vi">🇻🇳 Tiếng Việt (text + lồng tiếng)</option>
          </select>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-gray-400">Thời lượng</label>
            <input type="range" min={12} max={45} value={duration} onChange={e => setDuration(Number(e.target.value))} className="flex-1 accent-brand-500" />
            <span className="text-xs text-white w-8">{duration}s</span>
          </div>
          {bgmTracks.length > 0 && (
            <label className="block">
              <span className="text-[11px] text-gray-400">🎵 Nhạc nền từ kho ({bgmTracks.length} bài)</span>
              <select value={bgmUrl} onChange={e => {
                setBgmUrl(e.target.value);
                setBgmName(bgmTracks.find(t => t.url === e.target.value)?.name ?? '');
              }}
                className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white">
                <option value="">— Không nhạc / tự upload bên dưới —</option>
                {bgmTracks.map(t => (
                  <option key={t.id} value={t.url}>
                    ♪ {t.name || t.id.slice(0, 8)} · {Math.round(t.duration_s)}s{t.bpm ? ` · ${Math.round(t.bpm)} BPM` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            <span className="text-[11px] text-gray-400">{bgmTracks.length > 0 ? 'Hoặc nhạc riêng cho video này' : 'Nhạc nền'} — mp3 hoặc <b>video</b> (tự bóc nhạc), cắt cảnh theo beat</span>
            <input type="file" accept="audio/*,video/*" disabled={uploading}
              onChange={e => e.target.files?.[0] && uploadBgm(e.target.files[0])}
              className="mt-1 block w-full text-[11px] text-gray-400 file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-gray-700 file:text-gray-200 file:text-xs" />
            {bgmName && <span className="text-[10px] text-emerald-400">♪ {bgmName}</span>}
          </label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ghi chú cho AI director (tùy chọn): thông điệp chính, ưu đãi, không khí…"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white resize-none h-16" />
          <label className="block">
            <span className="text-[11px] text-gray-400">🎯 Học công thức từ video mẫu viral (tùy chọn) — AI phân tích cấu trúc/nhịp/góc máy của clip rồi dựng lại bằng nội dung brand</span>
            <select value={referenceClipId} onChange={e => setReferenceClipId(e.target.value)}
              className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white">
              <option value="">— Không học mẫu (tự do sáng tạo) —</option>
              {clips.map(c => {
                let t: Record<string, unknown> = {}; try { t = JSON.parse(c.tags_json); } catch { /* */ }
                return <option key={c.id} value={c.id}>{String(t.subject ?? 'clip')} · {Math.round(c.duration_s)}s</option>;
              })}
            </select>
            <span className="text-[10px] text-gray-600">Upload clip viral mẫu vào kho rồi chọn ở đây. AI giữ công thức thắng, thay nội dung của bạn.</span>
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={useVoiceover} onChange={e => setUseVoiceover(e.target.checked)} className="rounded accent-brand-500" />
              <span className="text-[11px] text-gray-300">🎙️ Lồng tiếng (TTS, ducking nhạc nền)</span>
            </label>
            {useVoiceover && (
              <select value={voVoice} onChange={e => setVoVoice(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-[11px] text-white">
                <option value="nova">Nova (nữ ấm)</option>
                <option value="shimmer">Shimmer (nữ nhẹ)</option>
                <option value="alloy">Alloy (trung tính)</option>
                <option value="onyx">Onyx (nam trầm)</option>
              </select>
            )}
          </div>
          <button onClick={createProject} disabled={creating}
            className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-bold transition-colors">
            {creating ? '🧠 AI đang dựng storyboard…' : '🧠 Tạo storyboard'}
          </button>
          <p className="text-[10px] text-gray-600">AI trộn: clip kho ({clips.length}) + ảnh sản phẩm + ảnh AI gen mới → bám brand DNA + compliance.</p>
        </div>

        {/* ── Clip library ── */}
        <div className="lg:col-span-2 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wide">📼 Kho clip {productId ? `của ${products.find(p => p.id === productId)?.name ?? 'sản phẩm'}` : 'brand'} ({clips.length})</h3>
            <label className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-[11px] font-semibold cursor-pointer">
              {uploading ? 'Đang xử lý…' : '+ Upload clip (≤200MB)'}
              <input type="file" accept="video/*" className="hidden" disabled={uploading}
                onChange={e => e.target.files?.[0] && uploadClip(e.target.files[0])} />
            </label>
          </div>
          {clips.length === 0 ? (
            <p className="text-xs text-gray-600 py-6 text-center">Chưa có clip nào. Upload footage quay sản phẩm/quán/hậu trường — AI sẽ tự gắn tag (chủ thể, mood, motion) để director chọn đúng cảnh.</p>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2 max-h-72 overflow-y-auto">
              {clips.map(c => {
                let t: Record<string, unknown> = {}; try { t = JSON.parse(c.tags_json); } catch { /* */ }
                return (
                  <div key={c.id} className="rounded-lg overflow-hidden bg-gray-800 border border-gray-700/50">
                    <video src={c.url} muted playsInline preload="metadata" className="w-full aspect-[9/16] object-cover"
                      onMouseEnter={e => e.currentTarget.play().catch(() => {})} onMouseLeave={e => e.currentTarget.pause()} />
                    <div className="p-1.5">
                      <p className="text-[9px] text-gray-300 truncate">{String(t.subject ?? '—')}</p>
                      <p className="text-[8px] text-gray-500">{Math.round(c.duration_s)}s · {String(t.mood ?? '')}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Kho nhạc nền ── */}
      <BgmLibrarySection brandId={brandId} onTracks={setBgmTracks} />

      {/* ── Lịch video định kỳ ── */}
      <VideoScheduleSection brandId={brandId} products={products} />

      {/* ── Projects ── */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
        <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wide mb-3">🎞️ Video projects</h3>
        {projects.length === 0 ? (
          <p className="text-xs text-gray-600 py-4 text-center">Chưa có project nào.</p>
        ) : (
          <div className="space-y-3">
            {projects.map(p => (
              <div key={p.id} className="rounded-lg bg-gray-800/50 border border-gray-700/40 p-3 flex flex-col md:flex-row gap-3">
                {p.output_url && (
                  <video src={p.output_url} controls playsInline className="w-32 rounded-lg flex-shrink-0 aspect-[9/16] object-cover bg-black" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-semibold text-white">{p.title ?? '(untitled)'}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${statusBadge(p.status)}`}>{p.status}</span>
                    {p.bpm ? <span className="text-[9px] text-gray-500">♪ {Math.round(p.bpm)} BPM</span> : null}
                    <span className="text-[9px] text-gray-500">{p.target_duration_s}s · {p.purpose}</span>
                  </div>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {segs(p).map((s, i) => (
                      <span key={i} title={s.text ?? ''}
                        className={`px-1.5 py-0.5 rounded text-[8px] font-mono ${s.source === 'clip' ? 'bg-sky-600/20 text-sky-300' : s.source === 'ai_image' ? 'bg-purple-600/20 text-purple-300' : 'bg-emerald-600/20 text-emerald-300'}`}>
                        {s.source === 'clip' ? '🎥' : s.source === 'ai_image' ? '✨' : '🖼'} {s.dur_s}s
                      </span>
                    ))}
                  </div>
                  {p.error && <p className="text-[10px] text-red-400 mt-1.5 truncate">⚠ {p.error}</p>}
                  <div className="flex gap-2 mt-2.5">
                    {(p.status === 'draft' || p.status === 'failed') && (
                      <button onClick={() => render(p.id)} className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[10px] font-bold">▶ Render</button>
                    )}
                    {p.status === 'done' && p.output_url && (
                      <a href={p.output_url} download className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-[10px] font-bold">⬇ Tải về</a>
                    )}
                    <button onClick={() => remove(p.id)} className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-red-900/40 text-gray-500 hover:text-red-300 text-[10px]">Xóa</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

/**
 * Job Queue — feed THỐNG NHẤT mọi nơi "bấm Tạo": ảnh (CreateLab), content, carousel
 * (Template), bài từ plan, render video. Hiển thị trạng thái, tiến độ, log, lỗi, kết quả.
 */
import { useState, useEffect, useCallback } from 'react';

interface Job {
  id: string; brand_id: string; kind: string; title: string; source: string | null;
  status: 'pending' | 'running' | 'done' | 'failed';
  progress: number; log: string; error: string | null;
  result_json: string | null; duration_ms: number | null;
  created_at: string; completed_at: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'text-yellow-400 bg-yellow-900/20',
  running: 'text-blue-400 bg-blue-900/20 animate-pulse',
  done: 'text-green-400 bg-green-900/20',
  failed: 'text-red-400 bg-red-900/20',
};
const KIND_META: Record<string, { icon: string; label: string }> = {
  image: { icon: '🖼', label: 'Ảnh' },
  content: { icon: '✍️', label: 'Content' },
  carousel: { icon: '🎴', label: 'Carousel' },
  plan: { icon: '📅', label: 'Plan' },
  video: { icon: '🎬', label: 'Video' },
  reference: { icon: '🎯', label: 'Phân tích mẫu' },
};

function parseResult(j: Job): { url?: string; postId?: string; count?: number } {
  try { return JSON.parse(j.result_json || '{}'); } catch { return {}; }
}

export function JobQueueView() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [counts, setCounts] = useState<{ status: string; count: number }[]>([]);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const url = filter === 'all' ? '/api/jobs' : `/api/jobs?status=${filter}`;
      const d = await (await fetch(url)).json();
      setJobs(d.jobs ?? []);
      setCounts(d.counts ?? []);
      // keep selected fresh (live log/status)
      setSelected(prev => prev ? (d.jobs ?? []).find((j: Job) => j.id === prev.id) ?? prev : null);
    } catch { /* */ } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const busy = jobs.some(j => j.status === 'running' || j.status === 'pending');
    if (!busy && !selected) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [jobs, selected, load]);

  const byStatus = (s: string) => counts.find(c => c.status === s)?.count ?? 0;
  const total = counts.reduce((a, c) => a + c.count, 0);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto flex flex-col h-full">
      <div className="grid grid-cols-4 gap-3 mb-5 flex-shrink-0">
        {[
          { label: 'Tổng', value: total, color: 'text-white' },
          { label: 'Xong', value: byStatus('done'), color: 'text-green-400' },
          { label: 'Đang chạy', value: byStatus('running') + byStatus('pending'), color: 'text-blue-400' },
          { label: 'Lỗi', value: byStatus('failed'), color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-4 flex-shrink-0 flex-wrap">
        {[['all', 'Tất cả'], ['running', 'Đang chạy'], ['pending', 'Chờ'], ['done', 'Xong'], ['failed', 'Lỗi']].map(([s, l]) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === s ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>{l}</button>
        ))}
        <button onClick={load} className="ml-auto text-xs text-gray-600 hover:text-white px-3 py-1.5 bg-gray-800 rounded-lg">↻ Làm mới</button>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-20">Đang tải…</div>
      ) : jobs.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          <p className="text-3xl mb-2">🗂️</p>
          <p>Chưa có job nào. Mọi lần bấm <b>Tạo</b> (ảnh, content, carousel, bài từ plan, render video) sẽ hiện ở đây để theo dõi.</p>
        </div>
      ) : (
        <div className={`flex flex-1 min-h-0 ${selected ? 'flex-col md:flex-row gap-4' : 'flex-col'} overflow-hidden`}>
          <div className={`overflow-y-auto space-y-2 ${selected ? 'md:w-[440px] md:flex-shrink-0' : 'w-full'}`}>
            {jobs.map(job => {
              const km = KIND_META[job.kind] ?? { icon: '⚙️', label: job.kind };
              const res = parseResult(job);
              const isSel = selected?.id === job.id;
              return (
                <div key={job.id} onClick={() => setSelected(isSel ? null : job)}
                  className={`bg-gray-900 border rounded-xl p-3 cursor-pointer transition-colors ${isSel ? 'border-brand-500' : 'border-gray-800 hover:border-gray-700'}`}>
                  <div className="flex items-center gap-3">
                    {res.url ? (
                      <div className="w-14 h-[72px] rounded-lg overflow-hidden bg-gray-800 flex-shrink-0 border border-gray-700">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={res.url.includes('/api/images/') ? `${res.url}${res.url.includes('?') ? '&' : '?'}w=200` : res.url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-14 h-[72px] rounded-lg bg-gray-800 flex-shrink-0 flex items-center justify-center border border-gray-700 text-2xl">
                        {job.status === 'running' ? <span className="text-blue-400 animate-spin">⟳</span> : km.icon}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[job.status] ?? ''}`}>{job.status}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">{km.icon} {km.label}</span>
                        {job.source && <span className="text-[10px] text-gray-600">{job.source}</span>}
                      </div>
                      <p className="text-xs text-white font-medium truncate">{job.title}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-gray-600">{new Date(job.created_at + 'Z').toLocaleString('vi-VN')}</span>
                        {job.duration_ms ? <span className="text-[10px] text-gray-600">{(job.duration_ms / 1000).toFixed(1)}s</span> : null}
                        {res.count ? <span className="text-[10px] text-gray-500">{res.count} ảnh</span> : null}
                      </div>
                      {job.status === 'running' && job.progress > 0 && (
                        <div className="mt-1.5 h-1 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${job.progress}%` }} /></div>
                      )}
                    </div>
                  </div>
                  {job.status === 'failed' && job.error && (
                    <p className="text-xs text-red-400 mt-2 font-mono bg-red-900/10 rounded p-2 line-clamp-2">{job.error}</p>
                  )}
                </div>
              );
            })}
          </div>

          {selected && (
            <div className="flex-1 overflow-y-auto min-w-0">
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                {(() => { const r = parseResult(selected); return r.url ? (
                  <div className="relative bg-gray-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.url.includes('/api/images/') ? `${r.url}${r.url.includes('?') ? '&' : '?'}w=900` : r.url} alt="" className="w-full max-h-[420px] object-contain" />
                    <div className="absolute bottom-3 right-3 flex gap-2">
                      <a href={r.url} download onClick={e => e.stopPropagation()} className="px-3 py-1.5 bg-black/70 hover:bg-black text-white text-xs rounded-lg backdrop-blur">⬇ Tải</a>
                    </div>
                  </div>
                ) : null; })()}

                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-white font-medium flex-1 min-w-0">{selected.title}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_STYLE[selected.status] ?? ''}`}>{selected.status}</span>
                    <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-sm">✕</button>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                    <span>{(KIND_META[selected.kind] ?? { icon: '⚙️', label: selected.kind }).icon} {(KIND_META[selected.kind] ?? { label: selected.kind }).label}</span>
                    {selected.source && <span>📍 {selected.source}</span>}
                    {selected.duration_ms ? <span>⏱ {(selected.duration_ms / 1000).toFixed(1)}s</span> : null}
                    <span className="text-gray-600 font-mono">ID: {selected.id.slice(0, 8)}</span>
                  </div>

                  {selected.error && (
                    <div>
                      <p className="text-xs font-bold text-red-500 uppercase mb-1">Lỗi</p>
                      <p className="text-xs text-red-300 font-mono bg-red-900/15 rounded-lg p-3 whitespace-pre-wrap break-words">{selected.error}</p>
                    </div>
                  )}

                  {selected.log?.trim() && (
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase mb-1">Log</p>
                      <pre className="text-[11px] text-gray-300 leading-relaxed bg-black/40 rounded-lg p-3 max-h-72 overflow-auto whitespace-pre-wrap break-words">{selected.log.trim()}</pre>
                    </div>
                  )}

                  {(() => { const r = parseResult(selected); return r.postId ? (
                    <p className="text-xs text-gray-400">Đã tạo post: <span className="font-mono text-gray-300">{r.postId.slice(0, 8)}</span> — xem ở Review &amp; Queue / Plan &amp; Lịch.</p>
                  ) : null; })()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

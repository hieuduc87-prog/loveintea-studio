'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { SKUS } from '@/lib/brand-dna';

interface ImageJob {
  id: string; sku_id: string; usp_id: string; context_id: string;
  prompt: string; use_edit: number;
  status: 'pending'|'running'|'done'|'failed';
  result_url?: string; error?: string; duration_ms?: number;
  model: string; created_at: string; completed_at?: string;
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'text-yellow-400 bg-yellow-900/20',
  running: 'text-blue-400 bg-blue-900/20 animate-pulse',
  done:    'text-green-400 bg-green-900/20',
  failed:  'text-red-400 bg-red-900/20',
};

export function JobQueueView() {
  const [jobs, setJobs]         = useState<ImageJob[]>([]);
  const [counts, setCounts]     = useState<{status:string;count:number}[]>([]);
  const [filter, setFilter]     = useState('all');
  const [selected, setSelected] = useState<ImageJob | null>(null);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const url = filter === 'all' ? '/api/jobs' : `/api/jobs?status=${filter}`;
    const r = await fetch(url);
    const d = await r.json();
    setJobs(d.jobs ?? []);
    setCounts(d.counts ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const hasRunning = jobs.some(j => j.status === 'running' || j.status === 'pending');
    if (!hasRunning) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [jobs, load]);

  const total = counts.reduce((a, c) => a + c.count, 0);
  const byStatus = (s: string) => counts.find(c => c.status === s)?.count ?? 0;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto flex flex-col h-full">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5 flex-shrink-0">
        {[
          { label: 'Total',   value: total,                                      color: 'text-white' },
          { label: 'Done',    value: byStatus('done'),                            color: 'text-green-400' },
          { label: 'Running', value: byStatus('running') + byStatus('pending'),   color: 'text-blue-400' },
          { label: 'Failed',  value: byStatus('failed'),                          color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        {['all','pending','running','done','failed'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              filter === s ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}>{s}</button>
        ))}
        <button onClick={load} className="ml-auto text-xs text-gray-600 hover:text-white px-3 py-1.5 bg-gray-800 rounded-lg">↻ Refresh</button>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-20">Loading…</div>
      ) : jobs.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          <p className="text-3xl mb-2">🗂️</p>
          <p>No jobs yet. Generate images in Content Workshop or Image Studio.</p>
        </div>
      ) : (
        <div className={`flex flex-1 min-h-0 ${selected ? 'flex-col md:flex-row gap-4 md:gap-6 overflow-auto md:overflow-hidden' : 'flex-col overflow-hidden'}`}>
          {/* Job List */}
          <div className={`overflow-y-auto space-y-2 ${selected ? 'md:w-[420px] md:flex-shrink-0' : 'w-full'}`}>
            {jobs.map(job => {
              const sku = SKUS.find(s => s.id === job.sku_id);
              const isSelected = selected?.id === job.id;
              return (
                <div key={job.id} onClick={() => setSelected(isSelected ? null : job)}
                  className={`bg-gray-900 border rounded-xl p-3 cursor-pointer transition-colors ${
                    isSelected ? 'border-brand-500' : 'border-gray-800 hover:border-gray-700'
                  }`}>
                  <div className="flex items-center gap-3">
                    {/* Thumbnail — bigger now */}
                    {job.result_url ? (
                      <div className="w-14 h-[72px] rounded-lg overflow-hidden bg-gray-800 flex-shrink-0 border border-gray-700">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={job.result_url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-14 h-[72px] rounded-lg bg-gray-800 flex-shrink-0 flex items-center justify-center border border-gray-700">
                        {job.status === 'running' ? (
                          <span className="text-blue-400 animate-spin text-lg">⟳</span>
                        ) : (
                          <span style={{ color: sku?.color ?? '#666' }} className="text-xl">●</span>
                        )}
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[job.status] ?? ''}`}>
                          {job.status}
                        </span>
                        {sku && (
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sku.color }} />
                            <span className="text-xs text-white font-medium">{sku.name}</span>
                          </span>
                        )}
                        {job.usp_id && <span className="text-[10px] bg-gray-800 text-gray-400 rounded px-1.5 py-0.5">{job.usp_id}</span>}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{job.prompt?.slice(0, 70)}…</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-gray-600">{new Date(job.created_at).toLocaleString()}</span>
                        {job.duration_ms && <span className="text-[10px] text-gray-600">{(job.duration_ms/1000).toFixed(1)}s</span>}
                        <span className="text-[10px] text-gray-700">{job.model}</span>
                      </div>
                    </div>
                  </div>

                  {job.status === 'failed' && job.error && (
                    <p className="text-xs text-red-400 mt-2 font-mono bg-red-900/10 rounded p-2 truncate">{job.error}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Detail Panel — large image */}
          {selected && (
            <div className="flex-1 overflow-y-auto min-w-0">
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                {/* Large image */}
                {selected.result_url && (
                  <div className="relative bg-gray-800">
                    <div className="relative w-full" style={{ paddingBottom: '125%' }}>
                      {selected.result_url.startsWith('data:') ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={selected.result_url} alt="" className="absolute inset-0 w-full h-full object-contain" />
                      ) : (
                        <Image src={selected.result_url} alt="" fill className="object-contain" />
                      )}
                    </div>
                    {/* Floating actions */}
                    <div className="absolute bottom-3 right-3 flex gap-2">
                      <a href={selected.result_url} download={`loveintea-${selected.sku_id}-${selected.id}.png`}
                        onClick={e => e.stopPropagation()}
                        className="px-3 py-1.5 bg-black/70 hover:bg-black text-white text-xs rounded-lg backdrop-blur transition-colors">
                        ⬇ Download
                      </a>
                      <button onClick={() => navigator.clipboard.writeText(
                        selected.result_url!.startsWith('/') ? `https://loveintea.wealthpsy.com${selected.result_url}` : selected.result_url!
                      )} className="px-3 py-1.5 bg-black/70 hover:bg-black text-white text-xs rounded-lg backdrop-blur transition-colors">
                        Copy URL
                      </button>
                    </div>
                  </div>
                )}

                {selected.status === 'running' && (
                  <div className="aspect-[4/5] bg-gray-800 flex flex-col items-center justify-center">
                    <span className="animate-spin text-4xl text-blue-400 mb-3">⟳</span>
                    <p className="text-gray-400 text-sm">Generating with {selected.model}…</p>
                  </div>
                )}

                {selected.status === 'failed' && (
                  <div className="aspect-[4/5] bg-gray-800 flex flex-col items-center justify-center p-6">
                    <p className="text-4xl mb-3">❌</p>
                    <p className="text-red-400 text-sm text-center font-mono">{selected.error}</p>
                  </div>
                )}

                {/* Meta */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {(() => { const s = SKUS.find(x => x.id === selected.sku_id); return s ? (
                        <><span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} /><span className="text-white text-sm font-medium">{s.name}</span></>
                      ) : null; })()}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_STYLE[selected.status] ?? ''}`}>{selected.status}</span>
                    </div>
                    <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-sm">✕</button>
                  </div>

                  {selected.usp_id && <p className="text-xs text-gray-400">USP: <span className="text-white">{selected.usp_id}</span></p>}
                  {selected.duration_ms && <p className="text-xs text-gray-400">Duration: <span className="text-white">{(selected.duration_ms/1000).toFixed(1)}s</span></p>}
                  <p className="text-xs text-gray-500 font-mono">ID: {selected.id}</p>

                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Prompt</p>
                    <p className="text-xs text-gray-300 leading-relaxed bg-gray-800/50 rounded-lg p-3">{selected.prompt}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

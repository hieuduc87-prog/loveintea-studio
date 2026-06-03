'use client';

import { useState, useEffect, useCallback } from 'react';
import { SKUS } from '@/lib/brand-dna';

interface ImageJob {
  id: string;
  sku_id: string;
  usp_id: string;
  context_id: string;
  prompt: string;
  use_edit: number;
  status: 'pending' | 'running' | 'done' | 'failed';
  result_url?: string;
  error?: string;
  duration_ms?: number;
  model: string;
  created_at: string;
  completed_at?: string;
}

interface StatusCount { status: string; count: number; }

const STATUS_STYLE: Record<string, string> = {
  pending: 'text-yellow-400 bg-yellow-900/20',
  running: 'text-blue-400 bg-blue-900/20 animate-pulse',
  done:    'text-green-400 bg-green-900/20',
  failed:  'text-red-400 bg-red-900/20',
};

export function JobQueueView() {
  const [jobs, setJobs]       = useState<ImageJob[]>([]);
  const [counts, setCounts]   = useState<StatusCount[]>([]);
  const [filter, setFilter]   = useState('all');
  const [selected, setSelected] = useState<ImageJob | null>(null);
  const [loading, setLoading] = useState(true);

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

  // Auto-refresh while running jobs exist
  useEffect(() => {
    const hasRunning = jobs.some(j => j.status === 'running' || j.status === 'pending');
    if (!hasRunning) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [jobs, load]);

  const totalByStatus = (s: string) => counts.find(c => c.status === s)?.count ?? 0;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total',   value: counts.reduce((a, c) => a + c.count, 0), color: 'text-white' },
          { label: 'Done',    value: totalByStatus('done'),    color: 'text-green-400' },
          { label: 'Running', value: totalByStatus('running') + totalByStatus('pending'), color: 'text-blue-400' },
          { label: 'Failed',  value: totalByStatus('failed'),  color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label} Jobs</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-4">
        {['all', 'pending', 'running', 'done', 'failed'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              filter === s ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {s}
          </button>
        ))}
        <button onClick={load} className="ml-auto text-xs text-gray-600 hover:text-white px-3 py-1.5 bg-gray-800 rounded-lg">
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-20">Loading…</div>
      ) : jobs.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          <p className="text-3xl mb-2">🗂️</p>
          <p>No jobs yet. Generate images in Image Studio.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map(job => {
            const sku = SKUS.find(s => s.id === job.sku_id);
            const isSelected = selected?.id === job.id;
            return (
              <div
                key={job.id}
                onClick={() => setSelected(isSelected ? null : job)}
                className={`bg-gray-900 border rounded-xl p-4 cursor-pointer transition-colors ${
                  isSelected ? 'border-brand-500' : 'border-gray-800 hover:border-gray-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Status indicator */}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[job.status] ?? ''}`}>
                    {job.status}
                  </span>

                  {/* SKU */}
                  {sku && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sku.color }} />
                      <span className="text-xs text-white font-medium">{sku.name}</span>
                    </span>
                  )}

                  {/* Mode */}
                  <span className="text-[10px] text-gray-600">
                    {job.use_edit ? '✏️ edit' : '🎨 generate'}
                  </span>

                  {/* USP */}
                  {job.usp_id && (
                    <span className="text-[10px] bg-gray-800 text-gray-400 rounded px-1.5 py-0.5">{job.usp_id}</span>
                  )}

                  {/* Duration */}
                  {job.duration_ms && (
                    <span className="text-[10px] text-gray-600 ml-auto">{(job.duration_ms / 1000).toFixed(1)}s</span>
                  )}

                  {/* Time */}
                  <span className="text-[10px] text-gray-600">{new Date(job.created_at).toLocaleTimeString()}</span>

                  {/* Result thumbnail */}
                  {job.result_url && (
                    <div className="w-10 h-12 rounded overflow-hidden bg-gray-800 flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={job.result_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                {/* Error */}
                {job.status === 'failed' && job.error && (
                  <p className="text-xs text-red-400 mt-2 font-mono bg-red-900/10 rounded p-2">{job.error}</p>
                )}

                {/* Expanded */}
                {isSelected && (
                  <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-bold text-gray-500 mb-2">Prompt</p>
                      <p className="text-xs text-gray-300 leading-relaxed">{job.prompt}</p>
                      <p className="text-[10px] text-gray-600 mt-2 font-mono">ID: {job.id}</p>
                    </div>
                    {job.result_url && (
                      <div>
                        <p className="text-xs font-bold text-gray-500 mb-2">Result</p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={job.result_url} alt="" className="w-32 rounded-lg" />
                        <div className="mt-2">
                          <a
                            href={job.result_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-brand-400 hover:underline"
                          >
                            Open full size ↗
                          </a>
                        </div>
                      </div>
                    )}
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

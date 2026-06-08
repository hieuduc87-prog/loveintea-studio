'use client';

import { useState, useEffect, useCallback } from 'react';

interface ScoreboardEntry {
  id: string;
  angle: string;
  channel: string;
  saves: number;
  reach: number;
  er: number;
  sample_size: number;
  verdict: 'SCALE' | 'HOLD' | 'RETIRE';
  evidence_json: string | null;
  updated_at: string;
}

interface ScoreboardStats {
  scale: number;
  hold: number;
  retire: number;
}

interface ScoreboardResponse {
  entries: ScoreboardEntry[];
  stats: ScoreboardStats;
  postCount: number;
  hasEnoughData: boolean;
  message?: string;
}

const VERDICT_STYLES: Record<string, string> = {
  SCALE:  'bg-green-900/40 text-green-300 border border-green-700/40',
  HOLD:   'bg-yellow-900/40 text-yellow-300 border border-yellow-700/40',
  RETIRE: 'bg-red-900/40 text-red-300 border border-red-700/40',
};

const VERDICT_ORDER: Record<string, number> = { SCALE: 0, HOLD: 1, RETIRE: 2 };

const CHANNEL_STYLES: Record<string, string> = {
  fb: 'bg-blue-900/40 text-blue-300 border border-blue-700/40',
  ig: 'bg-purple-900/40 text-purple-300 border border-purple-700/40',
};

const CHANNEL_LABELS: Record<string, string> = { fb: 'FB', ig: 'IG' };

function EvidenceCell({ raw }: { raw: string | null }) {
  const [open, setOpen] = useState(false);
  if (!raw) return <span className="text-gray-600">—</span>;

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { parsed = raw; }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="text-xs text-brand-400 hover:text-brand-300 underline underline-offset-2"
      >
        {open ? 'hide' : 'view'}
      </button>
      {open && (
        <div className="absolute z-20 right-0 mt-1 w-72 bg-gray-800 border border-gray-700 rounded-xl p-3 shadow-2xl">
          <pre className="text-[10px] text-gray-300 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
            {typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export function ScoreboardView({ brandId }: { brandId: string }) {
  const [data, setData]           = useState<ScoreboardResponse | null>(null);
  const [loading, setLoading]     = useState(true);
  const [recomputing, setRecomp]  = useState(false);
  const [error, setError]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`/api/scoreboard?brandId=${encodeURIComponent(brandId)}`);
      const d = await r.json() as ScoreboardResponse;
      setData(d);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => { load(); }, [load]);

  async function handleRecompute() {
    setRecomp(true);
    setError('');
    try {
      await fetch('/api/scoreboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, action: 'recompute' }),
      });
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setRecomp(false);
    }
  }

  const sorted = data
    ? [...data.entries].sort((a, b) => VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict])
    : [];

  const stats = data?.stats ?? { scale: 0, hold: 0, retire: 0 };
  const postCount = data?.postCount ?? 0;
  const MIN_POSTS = 10;

  if (loading) {
    return <div className="text-center text-gray-500 py-20">Loading scoreboard…</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white">Scoreboard</h2>
          <p className="text-xs text-gray-500 mt-0.5">Content angle performance verdicts</p>
        </div>
        <button
          onClick={handleRecompute}
          disabled={recomputing}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {recomputing ? 'Recomputing…' : 'Recompute'}
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'SCALE', value: stats.scale, color: 'text-green-400' },
          { label: 'HOLD',  value: stats.hold,  color: 'text-yellow-400' },
          { label: 'RETIRE',value: stats.retire, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1 tracking-widest">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="text-red-400 text-sm p-4 bg-red-900/20 border border-red-800/40 rounded-xl">
          {error}
        </div>
      )}

      {/* Not enough data banner */}
      {data && !data.hasEnoughData && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">📊</span>
            <div>
              <p className="text-sm font-semibold text-white">Not enough data yet</p>
              <p className="text-sm text-gray-400 mt-1">
                {data.message ?? `Publish at least ${MIN_POSTS} posts and run Learn to generate verdicts.`}
              </p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Posts published</span>
              <span className="tabular-nums">{postCount} / {MIN_POSTS}</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-600 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (postCount / MIN_POSTS) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {sorted.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                <th className="text-left py-2.5 pr-4">Verdict</th>
                <th className="text-left py-2.5 pr-4">Angle</th>
                <th className="text-left py-2.5 pr-4">Channel</th>
                <th className="text-right py-2.5 pr-4">Saves</th>
                <th className="text-right py-2.5 pr-4">Sample</th>
                <th className="text-right py-2.5 pr-4">ER %</th>
                <th className="text-left py-2.5 pr-4">Evidence</th>
                <th className="text-right py-2.5">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {sorted.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-900/50 transition-colors">

                  <td className="py-3 pr-4">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${VERDICT_STYLES[entry.verdict] ?? ''}`}>
                      {entry.verdict}
                    </span>
                  </td>

                  <td className="py-3 pr-4 text-white font-medium max-w-[200px] truncate" title={entry.angle}>
                    {entry.angle}
                  </td>

                  <td className="py-3 pr-4">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${CHANNEL_STYLES[entry.channel.toLowerCase()] ?? 'bg-gray-800 text-gray-400'}`}>
                      {CHANNEL_LABELS[entry.channel.toLowerCase()] ?? entry.channel.toUpperCase()}
                    </span>
                  </td>

                  <td className="py-3 pr-4 text-right text-pink-400 font-semibold tabular-nums">
                    {entry.saves.toLocaleString()}
                  </td>

                  <td className="py-3 pr-4 text-right text-gray-400 tabular-nums">
                    {entry.sample_size}
                  </td>

                  <td className="py-3 pr-4 text-right tabular-nums">
                    <span className={entry.er >= 5 ? 'text-green-400' : entry.er >= 2 ? 'text-yellow-400' : 'text-red-400'}>
                      {entry.er.toFixed(2)}%
                    </span>
                  </td>

                  <td className="py-3 pr-4">
                    <EvidenceCell raw={entry.evidence_json} />
                  </td>

                  <td className="py-3 text-right text-gray-600 text-xs whitespace-nowrap">
                    {new Date(entry.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !loading && data?.hasEnoughData !== false && (
          <div className="text-center py-20">
            <p className="text-3xl mb-3">🏆</p>
            <p className="text-gray-400 text-sm">No scoreboard data yet.</p>
            <p className="text-gray-600 text-xs mt-1">Publish posts and run Learn to populate.</p>
          </div>
        )
      )}
    </div>
  );
}

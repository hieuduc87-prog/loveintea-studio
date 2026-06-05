'use client';

import { useRef, useState } from 'react';

interface PostPreview {
  id: string;
  date: string;
  sku: string;
  hook: string;
  surface: string;
}

interface StoriesData {
  daily: { day: string; theme: string; signal: string }[];
  highlights: { name: string; holds: string; cover: string }[];
}

interface ImportResult {
  ok: boolean;
  created: number;
  posts: PostPreview[];
  stories: StoriesData;
  summary: string[][];
  error?: string;
}

const SKU_COLORS: Record<string, string> = {
  hibiscus:     '#5B8C3E',
  'nighty-night':'#3F3D99',
  'lemon-balm': '#8BBF5C',
  peppermint:   '#5BBCD2',
  dandelion:    '#F4A020',
  ginger:       '#A8B525',
};

const PLATFORM_BADGE: Record<string, string> = {
  instagram:         'bg-pink-900/40 text-pink-300',
  'facebook,instagram': 'bg-purple-900/40 text-purple-300',
  facebook:          'bg-blue-900/40 text-blue-300',
};

export function ImportPlanView() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  function handleFile(f: File) {
    if (!f.name.endsWith('.xlsx') && !f.name.endsWith('.xls')) {
      setError('Only .xlsx files supported');
      return;
    }
    setFile(f);
    setResult(null);
    setError('');
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  async function doImport() {
    if (!file) return;
    setLoading(true); setError(''); setResult(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await fetch('/api/import-plan', { method: 'POST', body: fd });
      const d = await r.json() as ImportResult;
      if (d.error) { setError(d.error); }
      else { setResult(d); }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Import Content Plan</h2>
        <p className="text-sm text-gray-500 mt-0.5">Upload monthly content plan (.xlsx) — reads all 3 sheets</p>
      </div>

      {/* Upload zone */}
      {!result && (
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
            dragging ? 'border-brand-500 bg-brand-500/10' : file ? 'border-green-600 bg-green-900/10' : 'border-gray-700 hover:border-gray-600'
          }`}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <p className="text-3xl mb-3">{file ? '📊' : '📁'}</p>
          {file ? (
            <>
              <p className="text-white font-medium">{file.name}</p>
              <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB — click to change</p>
            </>
          ) : (
            <>
              <p className="text-white font-medium">Drop your .xlsx content plan here</p>
              <p className="text-xs text-gray-500 mt-1">or click to browse</p>
            </>
          )}
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Import button */}
      {file && !result && (
        <button onClick={doImport} disabled={loading}
          className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium transition-colors">
          {loading ? '⟳ Parsing & importing…' : `⬆ Import "${file.name}"`}
        </button>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Success banner */}
          <div className="flex items-center gap-4 p-4 bg-green-900/20 border border-green-800/50 rounded-xl">
            <p className="text-3xl">✅</p>
            <div>
              <p className="text-white font-semibold">{result.created} posts imported as drafts</p>
              <p className="text-sm text-gray-400">
                {result.stories.daily.length > 0 && `Stories rotation saved · `}
                Go to <span className="text-brand-400">Schedule</span> to review & publish
              </p>
            </div>
            <button onClick={() => { setResult(null); setFile(null); }}
              className="ml-auto px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded-lg">
              Import another
            </button>
          </div>

          {/* Sheet 1 — Posts preview */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              📅 Sheet 1 — Content Plan ({result.posts.length} posts)
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="text-left py-2 pr-4 font-medium">Date</th>
                    <th className="text-left py-2 pr-4 font-medium">SKU</th>
                    <th className="text-left py-2 pr-4 font-medium">Format</th>
                    <th className="text-left py-2 font-medium">Hook</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {result.posts.map(p => (
                    <tr key={p.id} className="hover:bg-gray-900/50">
                      <td className="py-2 pr-4 text-gray-400 whitespace-nowrap">{p.date}</td>
                      <td className="py-2 pr-4">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: SKU_COLORS[p.sku] ?? '#888' }} />
                          <span className="text-white capitalize">{p.sku.replace('-', ' ')}</span>
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${PLATFORM_BADGE[p.surface?.toLowerCase().includes('reel') ? 'instagram' : 'facebook,instagram'] ?? ''}`}>
                          {p.surface?.split('·')[0]?.trim() || '—'}
                        </span>
                      </td>
                      <td className="py-2 text-gray-300 max-w-[400px] truncate">{p.hook}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sheet 2 — Stories rotation */}
          {result.stories.daily.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                  📖 Sheet 2 — Daily Stories Rotation
                </p>
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-800">
                        <th className="text-left px-3 py-2 font-medium">Day</th>
                        <th className="text-left px-3 py-2 font-medium">Theme</th>
                        <th className="text-left px-3 py-2 font-medium">Signal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                      {result.stories.daily.map((s, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-brand-400 font-medium whitespace-nowrap">{s.day}</td>
                          <td className="px-3 py-2 text-gray-300">{s.theme}</td>
                          <td className="px-3 py-2 text-gray-500">{s.signal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {result.stories.highlights.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                    ⭐ Highlights Storefront
                  </p>
                  <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 border-b border-gray-800">
                          <th className="text-left px-3 py-2 font-medium">Highlight</th>
                          <th className="text-left px-3 py-2 font-medium">What it holds</th>
                          <th className="text-left px-3 py-2 font-medium">Cover</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/50">
                        {result.stories.highlights.map((h, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 text-brand-400 font-medium">{h.name}</td>
                            <td className="px-3 py-2 text-gray-300">{h.holds}</td>
                            <td className="px-3 py-2 text-gray-500">{h.cover}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sheet 3 — Summary */}
          {result.summary.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                📊 Sheet 3 — Balance Check
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {result.summary.filter(r => r[0] && r[1] && !isNaN(Number(r[1]))).map((r, i) => (
                  <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-white">{r[1]}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{r[0]}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

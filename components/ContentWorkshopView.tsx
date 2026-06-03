'use client';

import { useState } from 'react';
import Image from 'next/image';
import { SKUS, SEGMENTS, RTBS, USP_ANCHORS, NARRATIVES, CONTEXTS, CTA_OPTIONS } from '@/lib/brand-dna';

interface O3Result {
  caption: string;
  imagePrompt: string;
  hashtags: string;
  cellId: string;
  postId?: string;
}

function Select({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
      >
        <option value="">— Select —</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function ContentWorkshopView() {
  const [config, setConfig] = useState<{
    skuId: string;
    segmentId: string;
    rtbId: string;
    uspId: string;
    narrativeId: string;
    contextId: string;
    cta: string;
    extraNotes: string;
  }>({
    skuId: '',
    segmentId: '',
    rtbId: '',
    uspId: '',
    narrativeId: '',
    contextId: '',
    cta: CTA_OPTIONS[0],
    extraNotes: '',
  });
  const [result, setResult] = useState<O3Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const selectedSku = SKUS.find(s => s.id === config.skuId);

  async function generate() {
    if (!config.skuId || !config.segmentId || !config.rtbId || !config.uspId || !config.narrativeId || !config.contextId) {
      setError('Please fill all required fields');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const r = await fetch('/api/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Generation failed');
      setResult(data);
      setSaved(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function saveToQueue() {
    if (!result) return;
    setSaving(true);
    try {
      const r = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, ...result }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setResult(prev => prev ? { ...prev, postId: data.id } : null);
      setSaved(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-5 gap-6">
        {/* Config Panel */}
        <div className="col-span-2 space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-4">O3 Content Generator</h2>
            <div className="space-y-3">
              {/* SKU */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">SKU</label>
                <div className="grid grid-cols-2 gap-2">
                  {SKUS.map(sku => (
                    <button
                      key={sku.id}
                      onClick={() => setConfig(c => ({ ...c, skuId: sku.id }))}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-colors ${
                        config.skuId === sku.id
                          ? 'border-brand-500 bg-brand-600/10'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="w-8 h-10 rounded overflow-hidden flex-shrink-0 bg-gray-800">
                        <Image src={sku.image} alt={sku.name} width={32} height={40} className="object-cover w-full h-full" />
                      </div>
                      <div>
                        <p className="text-xs text-white font-medium">{sku.name}</p>
                        <p className="text-[10px] text-gray-500">{sku.bestMoment}</p>
                      </div>
                      <span className="ml-auto w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sku.color }} />
                    </button>
                  ))}
                </div>
              </div>

              <Select label="Segment" value={config.segmentId} onChange={v => setConfig(c => ({ ...c, segmentId: v }))}
                options={SEGMENTS.map(s => ({ value: s.id, label: `${s.id} — ${s.name}` }))} />
              <Select label="Reason to Buy" value={config.rtbId} onChange={v => setConfig(c => ({ ...c, rtbId: v }))}
                options={RTBS.map(r => ({ value: r.id, label: `${r.id}: ${r.label.slice(0, 40)}…` }))} />
              <Select label="USP Anchor" value={config.uspId} onChange={v => setConfig(c => ({ ...c, uspId: v }))}
                options={USP_ANCHORS.map(u => ({ value: u.id, label: `${u.id} — ${u.label}` }))} />
              <Select label="Narrative" value={config.narrativeId} onChange={v => setConfig(c => ({ ...c, narrativeId: v }))}
                options={NARRATIVES.map(n => ({ value: n.id, label: `${n.id} — ${n.label}` }))} />
              <Select label="Scene / Context" value={config.contextId} onChange={v => setConfig(c => ({ ...c, contextId: v }))}
                options={CONTEXTS.map(c => ({ value: c.id, label: c.label }))} />
              <Select label="CTA" value={config.cta} onChange={v => setConfig(c => ({ ...c, cta: v }))}
                options={CTA_OPTIONS.map(c => ({ value: c, label: c }))} />

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Extra Notes (optional)</label>
                <textarea
                  value={config.extraNotes}
                  onChange={e => setConfig(c => ({ ...c, extraNotes: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-brand-500"
                  rows={2}
                  placeholder="Any extra context…"
                />
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}

              <button
                onClick={generate}
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><span className="animate-spin">⟳</span> Generating…</>
                ) : (
                  <><span>✨</span> Generate Content</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Result Panel */}
        <div className="col-span-3 space-y-4">
          {selectedSku && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-3 items-center">
              <div className="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800">
                <Image src={selectedSku.image} alt={selectedSku.name} width={48} height={64} className="object-cover w-full h-full" />
              </div>
              <div>
                <p className="text-white font-semibold">{selectedSku.productName}</p>
                <p className="text-xs text-gray-400">{selectedSku.theme}</p>
                <p className="text-xs text-gray-500 mt-1">{selectedSku.ingredients.join(' · ')}</p>
              </div>
              <span className="ml-auto w-4 h-4 rounded-full" style={{ backgroundColor: selectedSku.color }} />
            </div>
          )}

          {result ? (
            <div className="space-y-4">
              {/* Caption */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Caption (English)</h3>
                  <button
                    onClick={() => navigator.clipboard.writeText(result.caption + '\n\n' + result.hashtags)}
                    className="text-xs text-gray-500 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{result.caption}</p>
                  <p className="text-xs text-brand-400 mt-2">{result.hashtags}</p>
                </div>
              </div>

              {/* Image Prompt */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Image Brief → GPT-image-1 Prompt</h3>
                  <button
                    onClick={() => navigator.clipboard.writeText(result.imagePrompt)}
                    className="text-xs text-gray-500 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed bg-gray-800/50 rounded-lg p-3">{result.imagePrompt}</p>
              </div>

              {/* Cell ID */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Cell ID</p>
                  <p className="text-xs font-mono text-gray-300">{result.cellId}</p>
                </div>
                <div className="flex gap-2">
                  {saved ? (
                    <span className="text-green-400 text-sm">✓ Saved to queue</span>
                  ) : (
                    <button
                      onClick={saveToQueue}
                      disabled={saving}
                      className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                    >
                      {saving ? 'Saving…' : '📋 Save to Queue'}
                    </button>
                  )}
                  <button
                    onClick={generate}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                  >
                    ↻ Regenerate
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 flex flex-col items-center justify-center text-center">
              <p className="text-4xl mb-3">✍️</p>
              <p className="text-white font-medium mb-1">Configure & Generate</p>
              <p className="text-gray-500 text-sm">Select a SKU, segment, and strategy on the left,<br />then click Generate Content.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

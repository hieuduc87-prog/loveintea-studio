'use client';

import { useState } from 'react';
import Image from 'next/image';
import { SKUS, SEGMENTS, RTBS, USP_ANCHORS, NARRATIVES, CONTEXTS, CTA_OPTIONS } from '@/lib/brand-dna';

interface O3Result { caption: string; imagePrompt: string; hashtags: string; cellId: string; }
interface LogEntry  { msg: string; status: 'loading' | 'ok' | 'error'; }
interface BatchJob  { id: string; skuId: string; status: 'pending'|'running'|'done'|'error'; logs: LogEntry[]; imageUrl?: string; caption?: string; }

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500">
        <option value="">— Select —</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function MultiCheck({ label, items, selected, onToggle }: {
  label: string; items: { id: string; label: string; color?: string }[];
  selected: string[]; onToggle: (id: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}
        <span className="ml-2 text-gray-600">({selected.length} selected)</span>
      </label>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {items.map(item => (
          <label key={item.id} className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-colors ${
            selected.includes(item.id) ? 'bg-brand-600/20 border border-brand-500/50' : 'hover:bg-gray-800'
          }`}>
            <input type="checkbox" checked={selected.includes(item.id)} onChange={() => onToggle(item.id)}
              className="rounded accent-brand-500" />
            {item.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />}
            <span className="text-xs text-white">{item.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function ContentWorkshopView() {
  const [mode, setMode] = useState<'single' | 'batch'>('single');

  // Single mode state
  const [config, setConfig] = useState<{
    skuId: string; segmentId: string; rtbId: string; uspId: string;
    narrativeId: string; contextId: string; cta: string; extraNotes: string;
  }>({
    skuId: '', segmentId: '', rtbId: '', uspId: '',
    narrativeId: '', contextId: '', cta: CTA_OPTIONS[0], extraNotes: '',
  });
  const [result, setResult]     = useState<O3Result | null>(null);
  const [loading, setLoading]   = useState(false);
  const [imgLoading, setImgLoading] = useState(false);
  const [error, setError]       = useState('');
  const [logs, setLogs]         = useState<LogEntry[]>([]);
  const [genImage, setGenImage] = useState<{ url: string; jobId: string; durationMs: number } | null>(null);

  // Batch mode state
  const [batchSkus, setBatchSkus]         = useState<string[]>([]);
  const [batchContexts, setBatchContexts] = useState<string[]>([]);
  const [batchUsps, setBatchUsps]         = useState<string[]>([]);
  const [batchSegments, setBatchSegments] = useState<string[]>([]);
  const [batchRtbs, setBatchRtbs]         = useState<string[]>([]);
  const [batchNarratives, setBatchNarratives] = useState<string[]>([]);
  const [batchCtas, setBatchCtas]         = useState<string[]>([CTA_OPTIONS[0]]);
  const [batchJobs, setBatchJobs]   = useState<BatchJob[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);

  const selectedSku = SKUS.find(s => s.id === config.skuId);

  function addLog(msg: string, status: LogEntry['status']) {
    setLogs(l => [...l, { msg, status }]);
  }
  function updateLastLog(msg: string, status: LogEntry['status']) {
    setLogs(l => { const c = [...l]; c[c.length - 1] = { msg, status }; return c; });
  }

  async function runSingleJob(cfg: typeof config): Promise<{ caption: string; imageUrl: string } | null> {
    // Step 1: Caption
    const r1 = await fetch('/api/content/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    });
    const d1 = await r1.json() as O3Result & { error?: string };
    if (!r1.ok || d1.error) throw new Error(d1.error ?? 'Caption failed');

    // Step 2: Save to queue immediately (even before image)
    const r3 = await fetch('/api/posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...cfg, ...d1, status: 'draft' }),
    });
    const postData = await r3.json() as { id?: string };
    const postId = postData.id;

    // Step 3: Image
    let imageUrl = '';
    try {
      const r2 = await fetch('/api/content/image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skuId: cfg.skuId, uspId: cfg.uspId, contextId: cfg.contextId, customPrompt: d1.imagePrompt, useEdit: true }),
      });
      const d2 = await r2.json() as { imageUrl?: string; error?: string };
      if (r2.ok && !d2.error && d2.imageUrl) {
        imageUrl = d2.imageUrl;
        // Update post with image
        if (postId) await fetch(`/api/posts/${postId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_url: imageUrl }),
        });
      } else {
        if (postId) await fetch(`/api/posts/${postId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: d2.error ?? 'Image generation failed' }),
        });
      }
    } catch (e) {
      if (postId) await fetch(`/api/posts/${postId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: String(e) }),
      });
    }

    return { caption: d1.caption, imageUrl };
  }

  async function generate() {
    if (!config.skuId || !config.segmentId || !config.rtbId || !config.uspId || !config.narrativeId || !config.contextId) {
      setError('Please fill all required fields'); return;
    }
    setLoading(true); setError(''); setResult(null); setGenImage(null); setLogs([]);
    addLog('⟳ Generating caption & image prompt (Gemini)…', 'loading');
    try {
      const r = await fetch('/api/content/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await r.json() as O3Result & { error?: string };
      if (!r.ok || data.error) throw new Error(data.error ?? 'Generation failed');
      setResult(data);
      updateLastLog('✓ Caption & image prompt ready', 'ok');
      setLoading(false);

      // Save to queue immediately (before image, so it's always visible)
      addLog('⟳ Saving to Content Queue…', 'loading');
      const r3 = await fetch('/api/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, ...data, status: 'draft' }),
      });
      const postData = r3.ok ? await r3.json() as { id?: string } : {};
      const postId = (postData as { id?: string }).id;
      updateLastLog(r3.ok ? '✓ Saved to Content Queue (draft)' : '⚠ Queue save failed', r3.ok ? 'ok' : 'error');

      // Auto-gen image
      setImgLoading(true);
      addLog('⟳ Generating image with GPT-image-2 edit…', 'loading');
      const r2 = await fetch('/api/content/image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skuId: config.skuId, uspId: config.uspId, contextId: config.contextId, customPrompt: data.imagePrompt, useEdit: true }),
      });
      const d2 = await r2.json() as { imageUrl?: string; jobId?: string; durationMs?: number; error?: string };
      if (!r2.ok || d2.error) {
        // Image failed — update post with error note, still show in queue
        if (postId) await fetch(`/api/posts/${postId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: d2.error ?? 'Image generation failed' }),
        });
        updateLastLog(`✗ Image failed: ${d2.error ?? 'unknown'} (post saved without image)`, 'error');
      } else {
        setGenImage({ url: d2.imageUrl!, jobId: d2.jobId!, durationMs: d2.durationMs ?? 0 });
        updateLastLog(`✓ Image ready (${Math.round((d2.durationMs ?? 0) / 1000)}s)`, 'ok');
        // Update post with image url
        if (postId) await fetch(`/api/posts/${postId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_url: d2.imageUrl }),
        });
      }
    } catch (e) {
      updateLastLog(`✗ ${String(e)}`, 'error');
      setError(String(e));
      setLoading(false);
    } finally {
      setImgLoading(false);
    }
  }

  // Batch: full cartesian product
  const batchCombinations = (() => {
    const skus  = batchSkus.length     ? batchSkus     : [''];
    const ctxs  = batchContexts.length ? batchContexts : [''];
    const usps  = batchUsps.length     ? batchUsps     : [''];
    const segs  = batchSegments.length ? batchSegments : [''];
    const rtbs  = batchRtbs.length     ? batchRtbs     : [''];
    const navs  = batchNarratives.length ? batchNarratives : [''];
    const ctas  = batchCtas.length     ? batchCtas     : [CTA_OPTIONS[0]];
    const out: { skuId:string; contextId:string; uspId:string; segmentId:string; rtbId:string; narrativeId:string; cta:string }[] = [];
    for (const skuId of skus) for (const contextId of ctxs) for (const uspId of usps)
      for (const segmentId of segs) for (const rtbId of rtbs) for (const narrativeId of navs)
        for (const cta of ctas) out.push({ skuId, contextId, uspId, segmentId, rtbId, narrativeId, cta });
    return out;
  })();

  async function runBatch() {
    if (!batchSkus.length) return;
    const jobs: BatchJob[] = batchCombinations.map((c, i) => ({
      id: `batch-${i}`, skuId: c.skuId, status: 'pending', logs: [],
    }));
    setBatchJobs(jobs);
    setBatchRunning(true);

    for (let i = 0; i < jobs.length; i++) {
      const combo = batchCombinations[i];
      setBatchJobs(prev => prev.map((j, idx) => idx === i ? { ...j, status: 'running', logs: [{ msg: '⟳ Running…', status: 'loading' }] } : j));
      try {
        const cfg = { ...combo, extraNotes: '' };
        const res = await runSingleJob(cfg);
        setBatchJobs(prev => prev.map((j, idx) => idx === i ? {
          ...j, status: 'done', imageUrl: res?.imageUrl, caption: res?.caption,
          logs: [{ msg: '✓ Done — saved to queue', status: 'ok' }],
        } : j));
      } catch (e) {
        setBatchJobs(prev => prev.map((j, idx) => idx === i ? {
          ...j, status: 'error', logs: [{ msg: `✗ ${String(e)}`, status: 'error' }],
        } : j));
      }
    }
    setBatchRunning(false);
  }

  function toggle(setter: React.Dispatch<React.SetStateAction<string[]>>) {
    return (id: string) => setter(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Mode Switch */}
      <div className="flex gap-2 mb-5">
        <button onClick={() => setMode('single')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'single' ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
          ✍️ Single
        </button>
        <button onClick={() => setMode('batch')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'batch' ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
          🗂 Batch
        </button>
      </div>

      {/* ── SINGLE MODE ── */}
      {mode === 'single' && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-6">
          <div className="md:col-span-2 space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-white mb-4">O3 Content Generator</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">SKU</label>
                  <div className="grid grid-cols-3 sm:grid-cols-2 gap-2">
                    {SKUS.map(sku => (
                      <button key={sku.id} onClick={() => setConfig(c => ({ ...c, skuId: sku.id }))}
                        className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-left transition-colors ${config.skuId === sku.id ? 'border-brand-500 bg-brand-600/10' : 'border-gray-700 hover:border-gray-600'}`}>
                        <div className="w-8 h-10 rounded overflow-hidden flex-shrink-0 bg-gray-800">
                          <Image src={sku.image} alt={sku.name} width={32} height={40} className="object-cover w-full h-full" />
                        </div>
                        <div><p className="text-xs text-white font-medium">{sku.name}</p><p className="text-[10px] text-gray-500">{sku.bestMoment}</p></div>
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
                  <textarea value={config.extraNotes} onChange={e => setConfig(c => ({ ...c, extraNotes: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-brand-500"
                    rows={2} placeholder="Any extra context…" />
                </div>
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <button onClick={generate} disabled={loading || imgLoading}
                  className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2">
                  {(loading || imgLoading) ? <><span className="animate-spin inline-block">⟳</span> Working…</> : <><span>✨</span> Generate + Image + Save</>}
                </button>
              </div>
            </div>
          </div>

          <div className="md:col-span-3 space-y-4">
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

            {logs.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Job Log</p>
                <div className="space-y-1 font-mono">
                  {logs.map((l, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {l.status === 'loading' && <span className="animate-spin text-yellow-400">⟳</span>}
                      {l.status === 'ok'      && <span className="text-green-400">✓</span>}
                      {l.status === 'error'   && <span className="text-red-400">✗</span>}
                      <span className={l.status === 'ok' ? 'text-green-300' : l.status === 'error' ? 'text-red-300' : 'text-yellow-300'}>{l.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Caption (English)</h3>
                    <button onClick={() => navigator.clipboard.writeText(result.caption + '\n\n' + result.hashtags)}
                      className="text-xs text-gray-500 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors">Copy</button>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{result.caption}</p>
                    <p className="text-xs text-brand-400 mt-2">{result.hashtags}</p>
                  </div>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Image Brief → GPT-image-2 Prompt</h3>
                    <button onClick={() => navigator.clipboard.writeText(result.imagePrompt)}
                      className="text-xs text-gray-500 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors">Copy</button>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed bg-gray-800/50 rounded-lg p-3">{result.imagePrompt}</p>
                </div>

                {imgLoading && !genImage && (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl aspect-[4/5] flex items-center justify-center">
                    <div className="text-center">
                      <span className="animate-spin text-4xl inline-block mb-3">⟳</span>
                      <p className="text-gray-400 text-sm">GPT-image-2 generating…</p>
                      <p className="text-gray-600 text-xs mt-1">usually 15–40s</p>
                    </div>
                  </div>
                )}
                {genImage && (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                    <div className="relative aspect-[4/5] bg-gray-800">
                      {genImage.url.startsWith('data:') ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={genImage.url} alt="Generated" className="w-full h-full object-contain" />
                      ) : (
                        <Image src={genImage.url} alt="Generated" fill className="object-contain" />
                      )}
                    </div>
                    <div className="p-3 flex items-center justify-between bg-gray-900">
                      <p className="text-xs text-gray-500 font-mono">Job: {genImage.jobId.slice(0, 8)}… · {Math.round(genImage.durationMs / 1000)}s</p>
                      <div className="flex gap-2">
                        <a href={genImage.url} download={`loveintea-${config.skuId}-${genImage.jobId}.png`}
                          className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs rounded-lg transition-colors">⬇ Download</a>
                        <button onClick={() => navigator.clipboard.writeText(`https://loveintea.wealthpsy.com${genImage.url}`)}
                          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition-colors">Copy URL</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!loading && logs.length === 0 && !result && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 flex flex-col items-center justify-center text-center">
                <p className="text-4xl mb-3">✍️</p>
                <p className="text-white font-medium mb-1">Configure & Generate</p>
                <p className="text-gray-500 text-sm">Select options → auto generates caption + image + saves to queue.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── BATCH MODE ── */}
      {mode === 'batch' && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-6">
          <div className="md:col-span-2 space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
              <h2 className="text-sm font-semibold text-white">Batch Generator</h2>

              <MultiCheck label="SKUs" selected={batchSkus} onToggle={toggle(setBatchSkus)}
                items={SKUS.map(s => ({ id: s.id, label: s.name, color: s.color }))} />
              <MultiCheck label="Scenes / Contexts" selected={batchContexts} onToggle={toggle(setBatchContexts)}
                items={CONTEXTS.map(c => ({ id: c.id, label: c.label }))} />
              <MultiCheck label="USP Anchors" selected={batchUsps} onToggle={toggle(setBatchUsps)}
                items={USP_ANCHORS.map(u => ({ id: u.id, label: `${u.id} — ${u.label}` }))} />
              <MultiCheck label="Segments" selected={batchSegments} onToggle={toggle(setBatchSegments)}
                items={SEGMENTS.map(s => ({ id: s.id, label: `${s.id} — ${s.name}` }))} />
              <MultiCheck label="Reasons to Buy" selected={batchRtbs} onToggle={toggle(setBatchRtbs)}
                items={RTBS.map(r => ({ id: r.id, label: `${r.id}: ${r.label.slice(0, 35)}…` }))} />
              <MultiCheck label="Narratives" selected={batchNarratives} onToggle={toggle(setBatchNarratives)}
                items={NARRATIVES.map(n => ({ id: n.id, label: `${n.id} — ${n.label}` }))} />
              <MultiCheck label="CTAs" selected={batchCtas} onToggle={toggle(setBatchCtas)}
                items={CTA_OPTIONS.map(c => ({ id: c, label: c }))} />

              <div className={`rounded-lg p-3 text-xs ${batchCombinations.length > 20 ? 'bg-yellow-900/30 border border-yellow-800/50' : 'bg-gray-800/50'}`}>
                <span className={`font-bold text-sm ${batchCombinations.length > 20 ? 'text-yellow-400' : 'text-white'}`}>{batchCombinations.length}</span>
                <span className="text-gray-400"> combinations total</span>
                {batchCombinations.length > 20 && <p className="text-yellow-500 mt-1">⚠ Large batch — each job ~30-60s</p>}
              </div>

              <button onClick={runBatch}
                disabled={batchRunning || batchCombinations.length === 0 || !batchSkus.length}
                className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2">
                {batchRunning ? <><span className="animate-spin inline-block">⟳</span> Running batch…</> : `🗂 Run ${batchCombinations.length} Jobs`}
              </button>
            </div>
          </div>

          <div className="md:col-span-3 space-y-3">
            {batchJobs.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 flex flex-col items-center justify-center text-center">
                <p className="text-4xl mb-3">🗂</p>
                <p className="text-white font-medium mb-1">Select combinations on the left</p>
                <p className="text-gray-500 text-sm">Each combination generates caption + image<br />and auto-saves to Content Queue.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-400">
                    {batchJobs.filter(j => j.status === 'done').length}/{batchJobs.length} done
                    {batchJobs.some(j => j.status === 'error') && <span className="text-red-400 ml-2">· {batchJobs.filter(j => j.status === 'error').length} errors</span>}
                  </p>
                  {batchRunning && (
                    <div className="w-32 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 transition-all duration-500"
                        style={{ width: `${(batchJobs.filter(j => j.status === 'done' || j.status === 'error').length / batchJobs.length) * 100}%` }} />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  {batchJobs.map(job => {
                    const sku = SKUS.find(s => s.id === job.skuId);
                    return (
                      <div key={job.id} className={`bg-gray-900 border rounded-xl p-3 flex items-center gap-3 ${
                        job.status === 'done' ? 'border-green-800/50' :
                        job.status === 'error' ? 'border-red-800/50' :
                        job.status === 'running' ? 'border-yellow-800/50' : 'border-gray-800'
                      }`}>
                        {job.imageUrl ? (
                          <div className="w-10 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800">
                            {job.imageUrl.startsWith('data:') ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={job.imageUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Image src={job.imageUrl} alt="" width={40} height={48} className="object-cover w-full h-full" />
                            )}
                          </div>
                        ) : (
                          <div className="w-10 h-12 rounded-lg flex-shrink-0 bg-gray-800 flex items-center justify-center">
                            <span style={{ color: sku?.color }} className="text-lg">●</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white font-medium">{sku?.name} — {job.id}</p>
                          {job.logs.map((l, i) => (
                            <p key={i} className={`text-xs font-mono mt-0.5 ${l.status === 'ok' ? 'text-green-400' : l.status === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>{l.msg}</p>
                          ))}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          job.status === 'done' ? 'bg-green-900/40 text-green-400' :
                          job.status === 'error' ? 'bg-red-900/40 text-red-400' :
                          job.status === 'running' ? 'bg-yellow-900/40 text-yellow-400' : 'bg-gray-800 text-gray-500'
                        }`}>{job.status}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import Image from 'next/image';
import { SKUS, USP_ANCHORS, CONTEXTS } from '@/lib/brand-dna';

interface GeneratedImage {
  jobId: string;
  imageUrl: string;
  prompt: string;
  skuId: string;
}

export function ImageStudioView({ brandId }: { brandId?: string } = {}) {
  const [skuId, setSkuId]         = useState('');
  const [uspId, setUspId]         = useState('');
  const [contextId, setContextId] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [useEdit, setUseEdit]     = useState(true);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [result, setResult]       = useState<GeneratedImage | null>(null);
  const [history, setHistory]     = useState<GeneratedImage[]>([]);
  // Card #3: AI phủ chữ thẳng lên ảnh vừa gen (1 bước) — không cần qua tab Chữ lên ảnh.
  const [addingText, setAddingText] = useState(false);
  const [overlaidUrl, setOverlaidUrl] = useState<string | null>(null);

  const selectedSku = SKUS.find(s => s.id === skuId);

  async function generate() {
    if (!skuId || !uspId || !contextId) {
      setError('Select SKU, USP Anchor, and Scene first');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/content/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skuId, uspId, contextId, customPrompt, useEdit }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Image generation failed');
      setResult(data);
      setOverlaidUrl(null);
      setHistory(h => [data, ...h].slice(0, 12));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  // 1 bước: AI gợi ý chữ theo brand+sản phẩm rồi phủ thẳng lên ảnh vừa gen.
  async function addText() {
    if (!result) return;
    setAddingText(true); setError('');
    try {
      const q = brandId ? `?brand=${encodeURIComponent(brandId)}` : '';
      const s = await fetch(`/api/content/text-overlay/suggest${q}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: result.skuId }),
      });
      const sd = await s.json();
      if (!s.ok) { setError(sd.error || 'Lỗi gợi ý chữ'); return; }
      const r = await fetch(`/api/content/text-overlay${q}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseImageUrl: result.imageUrl, layout: sd.layout, headline: sd.headline, sub: sd.sub, cta: sd.cta, badge: sd.badge }),
      });
      const rd = await r.json();
      if (!r.ok) { setError(rd.error || 'Lỗi phủ chữ lên ảnh'); return; }
      setOverlaidUrl(rd.url);
    } catch (e) {
      setError(String(e));
    } finally {
      setAddingText(false);
      setLoading(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Config */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-4">Image Studio — GPT-image-2 Edit</h2>

            {/* Mode */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setUseEdit(true)}
                className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                  useEdit ? 'bg-brand-600/20 border-brand-500 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                ✏️ Edit Product
              </button>
              <button
                onClick={() => setUseEdit(false)}
                className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                  !useEdit ? 'bg-brand-600/20 border-brand-500 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                🎨 Generate New
              </button>
            </div>
            {useEdit && (
              <p className="text-xs text-gray-500 mb-4 bg-gray-800/50 rounded-lg p-2">
                Edit mode: product image is reference. GPT will keep the product intact and add lifestyle scene.
              </p>
            )}

            {/* SKU */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-400 mb-1">SKU</label>
              <div className="grid grid-cols-1 gap-2">
                {SKUS.map(sku => (
                  <button
                    key={sku.id}
                    onClick={() => setSkuId(sku.id)}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-colors ${
                      skuId === sku.id ? 'border-brand-500 bg-brand-600/10' : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="w-8 h-10 rounded overflow-hidden flex-shrink-0">
                      <Image src={sku.image} alt={sku.name} width={32} height={40} className="object-cover w-full h-full" />
                    </div>
                    <span className="text-xs text-white">{sku.name}</span>
                    <span className="ml-auto w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sku.color }} />
                  </button>
                ))}
              </div>
            </div>

            {/* USP */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-400 mb-1">USP Anchor</label>
              <div className="space-y-1">
                {USP_ANCHORS.map(u => (
                  <button
                    key={u.id}
                    onClick={() => setUspId(u.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                      uspId === u.id ? 'border-brand-500 bg-brand-600/10 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <span className="font-medium">{u.id}</span> — {u.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Context */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-400 mb-1">Scene / Context</label>
              <div className="space-y-1">
                {CONTEXTS.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setContextId(c.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                      contextId === c.id ? 'border-brand-500 bg-brand-600/10 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <span className="font-medium">{c.label}</span>
                    <span className="text-xs text-gray-500 ml-2">{c.light}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-400 mb-1">Extra prompt notes (optional)</label>
              <textarea
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-brand-500"
                rows={2}
                placeholder="Add extra details…"
              />
            </div>

            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

            <button
              onClick={generate}
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-coral-600 hover:bg-coral-700 disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <><span className="animate-spin">⟳</span> Generating image…</>
              ) : (
                <><span>🎨</span> Generate Image</>
              )}
            </button>
          </div>
        </div>

        {/* Result */}
        <div className="md:col-span-3 space-y-4">
          {result ? (
            <div className="space-y-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="relative aspect-[4/5] bg-gray-800">
                  {result.imageUrl.startsWith('data:') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={result.imageUrl} alt="Generated" className="w-full h-full object-contain" />
                  ) : (
                    <Image src={result.imageUrl} alt="Generated" fill className="object-contain" />
                  )}
                </div>
                <div className="p-4 flex items-center justify-between">
                  <p className="text-xs text-gray-500 font-mono">{result.jobId}</p>
                  <div className="flex gap-2">
                    <a
                      href={result.imageUrl}
                      download={`loveintea-${result.skuId}-${result.jobId}.png`}
                      className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs rounded-lg transition-colors"
                    >
                      ⬇ Download
                    </a>
                    <button
                      onClick={addText}
                      disabled={addingText}
                      title="AI gợi ý chữ theo brand + sản phẩm rồi phủ thẳng lên ảnh"
                      className="px-3 py-1.5 bg-brand-600/20 border border-brand-600/40 text-brand-200 hover:bg-brand-600/30 disabled:opacity-50 text-xs rounded-lg transition-colors"
                    >
                      {addingText ? '⟳ Đang phủ chữ…' : '✨ Thêm chữ lên ảnh'}
                    </button>
                    <button
                      onClick={generate}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition-colors"
                    >
                      ↻ Regenerate
                    </button>
                  </div>
                </div>
              </div>

              {overlaidUrl && (
                <div className="bg-gray-900 border border-brand-600/40 rounded-xl overflow-hidden">
                  <div className="relative aspect-[4/5] bg-gray-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={overlaidUrl} alt="Ảnh có chữ" className="w-full h-full object-contain" />
                  </div>
                  <div className="p-4 flex items-center justify-between">
                    <p className="text-xs text-brand-300">✨ Ảnh đã phủ chữ (AI gợi ý theo brand)</p>
                    <a href={overlaidUrl} download={`loveintea-${result.skuId}-text.png`}
                      className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs rounded-lg transition-colors">⬇ Tải ảnh có chữ</a>
                  </div>
                </div>
              )}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs font-bold text-gray-400 mb-2">Prompt Used</p>
                <p className="text-xs text-gray-300 leading-relaxed">{result.prompt}</p>
              </div>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl aspect-[4/5] flex flex-col items-center justify-center text-center">
              <p className="text-5xl mb-3">🖼️</p>
              <p className="text-white font-medium mb-1">Select SKU + Scene + USP</p>
              <p className="text-gray-500 text-sm">GPT-image-2 edit keeps the product intact<br />and builds a lifestyle scene around it.</p>
            </div>
          )}

          {/* History */}
          {history.length > 1 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs font-bold text-gray-400 uppercase mb-3">Recent generations</p>
              <div className="grid grid-cols-4 gap-2">
                {history.slice(1).map(h => (
                  <button
                    key={h.jobId}
                    onClick={() => setResult(h)}
                    className="relative aspect-[4/5] rounded-lg overflow-hidden bg-gray-800 border border-gray-700 hover:border-brand-500 transition-colors"
                  >
                    {h.imageUrl.startsWith('data:') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={h.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Image src={h.imageUrl} alt="" fill className="object-cover" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

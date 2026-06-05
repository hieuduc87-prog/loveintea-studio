'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SKUS, USP_ANCHORS } from '@/lib/brand-dna';

interface LibImage {
  id: string;
  job_id: string;
  sku_id: string;
  usp_id: string;
  context_id: string;
  prompt: string;
  image_url: string;
  model: string;
  is_favorite: number;
  used_in_post: string;
  created_at: string;
}

export function ImageLibraryView() {
  const [images, setImages]     = useState<LibImage[]>([]);
  const [loading, setLoading]   = useState(true);
  const [skuFilter, setSkuFilter] = useState('');
  const [uspFilter, setUspFilter] = useState('');
  const [favOnly, setFavOnly]   = useState(false);
  const [selected, setSelected] = useState<LibImage | null>(null);
  const [copying, setCopying]   = useState('');

  // Upload
  const uploadRef = useRef<HTMLInputElement>(null);
  const [uploadSku, setUploadSku] = useState('hibiscus');
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (skuFilter) params.set('sku', skuFilter);
    if (uspFilter) params.set('usp', uspFilter);
    if (favOnly)   params.set('fav', '1');
    params.set('limit', '120');
    const r = await fetch(`/api/image-library?${params}`);
    const d = await r.json();
    setImages(d.images ?? []);
    setLoading(false);
  }, [skuFilter, uspFilter, favOnly]);

  useEffect(() => { load(); }, [load]);

  async function toggleFavorite(img: LibImage) {
    const newVal = img.is_favorite ? 0 : 1;
    await fetch(`/api/image-library/${img.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_favorite: newVal }),
    });
    setImages(imgs => imgs.map(i => i.id === img.id ? { ...i, is_favorite: newVal } : i));
    if (selected?.id === img.id) setSelected(prev => prev ? { ...prev, is_favorite: newVal } : null);
  }

  async function deleteImage(id: string) {
    if (!confirm('Delete this image from library?')) return;
    await fetch(`/api/image-library/${id}`, { method: 'DELETE' });
    setImages(imgs => imgs.filter(i => i.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  async function uploadFile(file: File) {
    setUploading(true); setUploadMsg('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('sku_id', uploadSku);
    const r = await fetch('/api/image-library/upload', { method: 'POST', body: fd });
    const d = await r.json() as { ok?: boolean; error?: string };
    if (d.ok) { setUploadMsg('✓ Uploaded'); await load(); }
    else { setUploadMsg('✗ ' + d.error); }
    setUploading(false);
    setTimeout(() => setUploadMsg(''), 3000);
  }

  async function copyUrl(url: string, id: string) {
    await navigator.clipboard.writeText(url);
    setCopying(id);
    setTimeout(() => setCopying(''), 1500);
  }

  const sku = (id: string) => SKUS.find(s => s.id === id);
  const usp = (id: string) => USP_ANCHORS.find(u => u.id === id);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span className="text-sm font-semibold text-white">Image Library</span>

        {/* SKU filter */}
        <select
          value={skuFilter}
          onChange={e => setSkuFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
        >
          <option value="">All SKUs</option>
          {SKUS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        {/* USP filter */}
        <select
          value={uspFilter}
          onChange={e => setUspFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
        >
          <option value="">All USPs</option>
          {USP_ANCHORS.map(u => <option key={u.id} value={u.id}>{u.id} — {u.label}</option>)}
        </select>

        {/* Fav toggle */}
        <button
          onClick={() => setFavOnly(f => !f)}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            favOnly ? 'bg-yellow-600/30 text-yellow-400 border border-yellow-600/50' : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          ⭐ Favorites
        </button>

        <span className="text-xs text-gray-600">{images.length} images</span>

        {/* Upload */}
        <div className="ml-auto flex items-center gap-2">
          {uploadMsg && <span className={`text-xs ${uploadMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{uploadMsg}</span>}
          <select value={uploadSku} onChange={e => setUploadSku(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none">
            {SKUS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input ref={uploadRef} type="file" accept="image/*" className="hidden" multiple
            onChange={e => { const files = Array.from(e.target.files ?? []); files.forEach(f => uploadFile(f)); e.target.value = ''; }} />
          <button onClick={() => uploadRef.current?.click()} disabled={uploading}
            className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs rounded-lg transition-colors">
            {uploading ? '⟳' : '⬆ Upload'}
          </button>
          <button onClick={load} className="text-xs text-gray-600 hover:text-white px-3 py-1.5 bg-gray-800 rounded-lg">↻</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-20">Loading…</div>
      ) : images.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          <p className="text-4xl mb-2">🖼️</p>
          <p>No images yet. Generate in Image Studio — all results auto-save here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {images.map(img => {
            const s = sku(img.sku_id);
            const isSelected = selected?.id === img.id;
            return (
              <div
                key={img.id}
                className={`group relative rounded-xl overflow-hidden border cursor-pointer transition-all ${
                  isSelected ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-gray-800 hover:border-gray-600'
                }`}
                onClick={() => setSelected(isSelected ? null : img)}
              >
                {/* Image */}
                <div className="aspect-[2/3] bg-gray-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.image_url}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>

                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                  <div className="flex items-center gap-1">
                    {s && (
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                    )}
                    <span className="text-[9px] text-white truncate">{s?.name}</span>
                  </div>
                  {img.usp_id && (
                    <span className="text-[9px] text-gray-400">{img.usp_id}</span>
                  )}
                </div>

                {/* Favorite badge */}
                {img.is_favorite ? (
                  <span className="absolute top-1.5 right-1.5 text-yellow-400 text-sm">⭐</span>
                ) : null}

                {/* Actions on hover */}
                <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={e => { e.stopPropagation(); toggleFavorite(img); }}
                    className="w-6 h-6 rounded bg-black/60 text-xs flex items-center justify-center hover:bg-black/80"
                    title={img.is_favorite ? 'Unfavorite' : 'Favorite'}
                  >
                    {img.is_favorite ? '★' : '☆'}
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); copyUrl(img.image_url, img.id); }}
                    className="w-6 h-6 rounded bg-black/60 text-xs flex items-center justify-center hover:bg-black/80"
                    title="Copy URL"
                  >
                    {copying === img.id ? '✓' : '⎘'}
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); deleteImage(img.id); }}
                    className="w-6 h-6 rounded bg-black/60 text-xs flex items-center justify-center hover:bg-red-900/80 text-red-400"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-gray-950 rounded-2xl overflow-hidden flex flex-col md:flex-row max-w-5xl w-full max-h-[95vh] shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Image — full height, object-contain */}
            <div className="flex-1 bg-black flex items-center justify-center min-h-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selected.image_url}
                alt=""
                className="max-h-[85vh] md:max-h-[95vh] max-w-full object-contain"
              />
            </div>

            {/* Sidebar info */}
            <div className="md:w-64 flex-shrink-0 p-5 flex flex-col gap-4 border-t md:border-t-0 md:border-l border-gray-800 overflow-y-auto">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-white uppercase tracking-widest">Detail</p>
                <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
              </div>

              <div className="space-y-1 text-xs">
                {sku(selected.sku_id) && (
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: sku(selected.sku_id)?.color }} />
                    <span className="text-white font-medium">{sku(selected.sku_id)?.name}</span>
                  </div>
                )}
                {selected.usp_id && (
                  <span className="inline-block bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">{selected.usp_id}</span>
                )}
              </div>

              <div className="text-xs">
                <p className="text-gray-500 mb-1">Prompt</p>
                <p className="text-gray-300 leading-relaxed">{selected.prompt.slice(0, 200)}…</p>
              </div>

              <p className="text-[10px] text-gray-600">{new Date(selected.created_at).toLocaleString()}</p>

              <div className="flex flex-col gap-2 mt-auto">
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleFavorite(selected)}
                    className="flex-1 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs transition-colors"
                  >
                    {selected.is_favorite ? '★ Unfav' : '☆ Fav'}
                  </button>
                  <button
                    onClick={() => copyUrl(selected.image_url, selected.id)}
                    className="flex-1 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs transition-colors"
                  >
                    {copying === selected.id ? '✓ Copied' : '⎘ URL'}
                  </button>
                </div>
                <a
                  href={selected.image_url}
                  download={`loveintea-${selected.sku_id}-${selected.id.slice(0, 8)}.png`}
                  className="block text-center py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs transition-colors"
                >
                  ⬇ Download Full Res
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

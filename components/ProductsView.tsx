'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { chunkedUpload } from '@/lib/chunk-upload';
import { ProductKnowledgePanel } from './ProductKnowledgePanel';

interface ProductVideo {
  id: string; url: string; duration_s: number; status: string; tags_json: string;
}

interface Product {
  id: string; brand_id: string; slug: string; name: string;
  display_name: string; theme: string; color: string; color_name: string;
  ingredients: string; image_url: string; best_moment: string;
  use_cases: string; pitch: string; image_count: number;
}

interface ProductImage {
  id: string; product_id: string; image_url: string;
  type: string; caption: string; is_hero: number; sort_order: number;
}

const IMAGE_TYPES = [
  { value: 'photo', label: 'Product Photo' },
  { value: 'packshot', label: 'Packshot' },
  { value: 'lifestyle', label: 'Lifestyle Shot' },
  { value: 'macro', label: 'Macro / Close-up' },
  { value: 'flat-lay', label: 'Flat Lay' },
  { value: 'ingredient', label: 'Ingredient Detail' },
];

const EMPTY_NEW = { name: '', display_name: '', theme: '', color: '#888888', color_name: '', pitch: '', image_url: '' };

export function ProductsView({ brandId = 'loveintea' }: { brandId?: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<Product | null>(null);
  const [images, setImages]     = useState<ProductImage[]>([]);
  const [videos, setVideos]     = useState<ProductVideo[]>([]);
  const [imgLoading, setImgLoading] = useState(false);

  // Upload (unified images + videos, chunked up to 200MB)
  const uploadRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading]   = useState(false);
  const [uploadMsg, setUploadMsg]   = useState('');
  const [uploadPct, setUploadPct]   = useState(0);

  // Lightbox
  const [lightbox, setLightbox] = useState<ProductImage | null>(null);

  // Detail tab: media gallery vs brief & knowledge
  const [detailTab, setDetailTab] = useState<'media' | 'brief'>('media');

  async function setImageType(imageId: string, type: string) {
    if (!selected) return;
    await fetch(`/api/products/${selected.id}/images`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageId, type }),
    });
    setImages(imgs => imgs.map(im => im.id === imageId ? { ...im, type } : im));
    setLightbox(lb => lb && lb.id === imageId ? { ...lb, type } : lb);
  }
  async function deleteImage(imageId: string) {
    if (!selected || !confirm('Xóa ảnh này?')) return;
    await fetch(`/api/products/${selected.id}/images?imageId=${imageId}`, { method: 'DELETE' });
    setImages(imgs => imgs.filter(im => im.id !== imageId));
    setLightbox(null);
  }

  // Add product form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct]   = useState(EMPTY_NEW);
  const [adding, setAdding]           = useState(false);
  const [addMsg, setAddMsg]           = useState('');

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/products?brand=${brandId}`);
    const d = await r.json() as { products: Product[] };
    setProducts(d.products ?? []);
    setLoading(false);
  }, [brandId]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const loadMedia = useCallback(async (productId: string) => {
    setImgLoading(true);
    const [ir, vr] = await Promise.all([
      fetch(`/api/products/${productId}/images`),
      fetch(`/api/products/${productId}/videos`),
    ]);
    setImages(((await ir.json()).images ?? []) as ProductImage[]);
    setVideos(((await vr.json()).clips ?? []) as ProductVideo[]);
    setImgLoading(false);
  }, []);

  async function selectProduct(p: Product) {
    setSelected(p);
    await loadMedia(p.id);
  }

  // Chunked upload (images + videos) up to ~200MB, bypassing the CF 100MB limit
  async function uploadFiles(files: File[]) {
    if (!selected || !files.length) return;
    setUploading(true); setUploadMsg('');
    let ok = 0; let hasTagging = false;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.size > 210 * 1024 * 1024) { setUploadMsg(`✗ ${f.name} > 200MB`); continue; }
      try {
        setUploadPct(0);
        const res = await chunkedUpload(f, 'product_media', { productId: selected.id }, setUploadPct);
        if (res.error) { setUploadMsg('✗ ' + res.error); continue; }
        ok++;
        if (res.status === 'tagging') hasTagging = true;
        setUploadMsg(`⬆ ${i + 1}/${files.length} xong`);
      } catch (e) { setUploadMsg('✗ ' + String(e)); }
    }
    setUploadPct(0);
    if (ok) setUploadMsg(`✓ ${ok} file đã tải lên${hasTagging ? ' (AI đang phân tích video…)' : ''}`);
    await loadMedia(selected.id);
    await loadProducts();
    setUploading(false);
    // Poll a couple times if videos are still tagging
    if (hasTagging) setTimeout(() => selected && loadMedia(selected.id), 12000);
    setTimeout(() => setUploadMsg(''), 6000);
  }

  async function deleteVideo(clipId: string) {
    if (!selected || !confirm('Xóa video này?')) return;
    await fetch(`/api/products/${selected.id}/videos?clipId=${clipId}`, { method: 'DELETE' });
    setVideos(v => v.filter(x => x.id !== clipId));
  }

  async function addProduct() {
    if (!newProduct.name.trim()) return;
    setAdding(true); setAddMsg('');
    const r = await fetch(`/api/brands/${brandId}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProduct),
    });
    const d = await r.json() as { ok?: boolean; error?: string };
    if (d.ok) {
      setShowAddForm(false);
      setNewProduct(EMPTY_NEW);
      await loadProducts();
    } else {
      setAddMsg('✗ ' + (d.error || 'Error'));
    }
    setAdding(false);
  }

  const parseJson = (s: string) => { try { return JSON.parse(s); } catch { return []; } };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Products & Asset Library</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage product catalog and original product photography</p>
        </div>
        <button onClick={() => { setShowAddForm(s => !s); setAddMsg(''); }}
          className="ml-auto px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs rounded-lg transition-colors">
          {showAddForm ? '✕ Cancel' : '+ Add Product'}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-gray-900 border border-brand-600/30 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">New Product</h3>
          <div className="grid grid-cols-2 gap-3">
            {([
              ['name',         'Name *',         'text', 'e.g. Green Tea'],
              ['display_name', 'Display Name',   'text', 'e.g. GREEN TEA BAGS'],
              ['theme',        'Theme',          'text', 'e.g. Daily refresh ritual'],
              ['color_name',   'Color Name',     'text', 'e.g. Emerald Green'],
              ['pitch',        'Pitch',          'text', 'One-line pitch'],
              ['image_url',    'Image URL',      'text', '/brand/products/XX.png'],
            ] as [keyof typeof EMPTY_NEW, string, string, string][]).map(([key, label, type, placeholder]) => (
              <div key={key} className={key === 'pitch' || key === 'image_url' ? 'col-span-2' : ''}>
                <label className="block text-xs text-gray-400 mb-1">{label}</label>
                <input type={type} value={newProduct[key]}
                  onChange={e => setNewProduct(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500" />
              </div>
            ))}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={newProduct.color}
                  onChange={e => setNewProduct(p => ({ ...p, color: e.target.value }))}
                  className="w-10 h-9 rounded border border-gray-700 bg-gray-800 cursor-pointer" />
                <span className="text-xs text-gray-400">{newProduct.color}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button onClick={addProduct} disabled={adding || !newProduct.name.trim()}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors">
              {adding ? '⟳ Adding…' : 'Add Product'}
            </button>
            {addMsg && <span className="text-xs text-red-400">{addMsg}</span>}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-500 py-20">Loading…</div>
      ) : (
        <div className="flex gap-6 min-h-0">
          {/* Product list */}
          <div className={`space-y-2 ${selected ? 'w-72 flex-shrink-0' : 'flex-1'}`}>
            {products.map(p => {
              const ingredients = parseJson(p.ingredients);
              const isActive = selected?.id === p.id;
              return (
                <div key={p.id} onClick={() => selectProduct(p)}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    isActive ? 'border-brand-500 bg-brand-600/10' : 'border-gray-800 bg-gray-900 hover:border-gray-700'
                  }`}
                >
                  <div className="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800">
                    <Image src={p.image_url} alt={p.name} width={48} height={64} className="object-cover w-full h-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="text-white font-semibold text-sm">{p.name}</span>
                      <span className="text-[10px] text-gray-600 ml-auto">{p.image_count} photos</span>
                    </div>
                    <p className="text-xs text-gray-400 truncate">{p.theme}</p>
                    <p className="text-[10px] text-gray-600 truncate">{ingredients.slice(0, 3).join(' · ')}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Product detail + asset library */}
          {selected && (
            <div className="flex-1 overflow-y-auto space-y-5">
              {/* Detail tab toggle */}
              <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-0.5 w-fit">
                {([['media', '📦 Ảnh & Video'], ['brief', '📋 Brief & Knowledge']] as const).map(([t, label]) => (
                  <button key={t} onClick={() => setDetailTab(t)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${detailTab === t ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                    {label}
                  </button>
                ))}
              </div>
              {/* Product header */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-start gap-4">
                  <div className="w-20 h-28 rounded-xl overflow-hidden flex-shrink-0 bg-gray-800">
                    <Image src={selected.image_url} alt={selected.name} width={80} height={112} className="object-cover w-full h-full" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="w-4 h-4 rounded-full" style={{ backgroundColor: selected.color }} />
                      <h3 className="text-lg font-bold text-white">{selected.display_name}</h3>
                      <button onClick={() => setSelected(null)} className="ml-auto text-gray-500 hover:text-white">✕</button>
                    </div>
                    <p className="text-sm text-gray-400 mb-1">{selected.theme}</p>
                    <p className="text-xs text-gray-500 mb-2">{selected.pitch}</p>
                    <div className="flex flex-wrap gap-1">
                      {parseJson(selected.ingredients).map((i: string) => (
                        <span key={i} className="text-[10px] bg-gray-800 text-gray-400 rounded px-1.5 py-0.5">{i}</span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {parseJson(selected.use_cases).map((u: string) => (
                        <span key={u} className="text-[10px] bg-brand-600/20 text-brand-300 rounded px-1.5 py-0.5">{u}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {detailTab === 'brief' && <ProductKnowledgePanel productId={selected.id} productName={selected.name} />}

              {detailTab === 'media' && (<>
              {/* Upload zone — images + videos, up to 200MB each */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Kho ảnh & video sản phẩm</p>
                  <div className="ml-auto flex items-center gap-2">
                    {uploadMsg && <span className={`text-xs ${uploadMsg.startsWith('✓') || uploadMsg.startsWith('⬆') ? 'text-green-400' : 'text-red-400'}`}>{uploadMsg}</span>}
                    {uploading && uploadPct > 0 && (
                      <span className="text-[10px] text-gray-400 w-24 bg-gray-800 rounded-full overflow-hidden h-2 relative">
                        <span className="absolute inset-y-0 left-0 bg-brand-500" style={{ width: `${uploadPct}%` }} />
                      </span>
                    )}
                    <input ref={uploadRef} type="file" accept="image/*,video/*" className="hidden" multiple
                      onChange={e => { uploadFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
                    <button onClick={() => uploadRef.current?.click()} disabled={uploading}
                      className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs rounded-lg transition-colors">
                      {uploading ? `⟳ ${uploadPct || ''}%` : '⬆ Upload ảnh / video (≤200MB)'}
                    </button>
                  </div>
                </div>

                {imgLoading ? (
                  <div className="text-center text-gray-500 py-10">Loading…</div>
                ) : images.length === 0 ? (
                  <div
                    className="border-2 border-dashed border-gray-700 rounded-xl p-10 text-center cursor-pointer hover:border-gray-600 transition-colors"
                    onClick={() => uploadRef.current?.click()}
                  >
                    <p className="text-3xl mb-2">📸</p>
                    <p className="text-gray-400 text-sm">Drop product photos here or click to upload</p>
                    <p className="text-[10px] text-gray-600 mt-1">Pack shots, lifestyle, macro, flat-lays — all original photography</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {images.map(img => (
                      <div key={img.id}
                        onClick={() => setLightbox(img)}
                        className="group relative rounded-lg overflow-hidden border border-gray-800 hover:border-gray-600 cursor-pointer transition-colors"
                      >
                        <div className="aspect-[3/4] bg-gray-800">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </div>
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[9px] text-gray-300 bg-black/40 px-1 rounded capitalize">{img.type}</span>
                          {img.is_hero ? <span className="text-[9px] text-yellow-400 ml-1">★ Hero</span> : null}
                        </div>
                      </div>
                    ))}
                    {/* Upload more tile */}
                    <div
                      onClick={() => uploadRef.current?.click()}
                      className="aspect-[3/4] rounded-lg border-2 border-dashed border-gray-700 hover:border-gray-600 flex flex-col items-center justify-center cursor-pointer transition-colors"
                    >
                      <span className="text-2xl text-gray-600 mb-1">+</span>
                      <span className="text-[10px] text-gray-600">Add more</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Video clip library for this product */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">🎬 Kho video sản phẩm ({videos.length})</p>
                  <p className="text-[10px] text-gray-600 ml-auto">AI tự phân tích cảnh/mood để Video Studio dùng đúng footage</p>
                </div>
                {videos.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center cursor-pointer hover:border-gray-600 transition-colors"
                    onClick={() => uploadRef.current?.click()}>
                    <p className="text-3xl mb-2">🎥</p>
                    <p className="text-gray-400 text-sm">Upload video footage của sản phẩm này</p>
                    <p className="text-[10px] text-gray-600 mt-1">Quay tay, b-roll, hậu trường — tối đa 200MB/clip</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {videos.map(v => {
                      let t: Record<string, unknown> = {}; try { t = JSON.parse(v.tags_json); } catch { /* */ }
                      return (
                        <div key={v.id} className="group relative rounded-lg overflow-hidden border border-gray-800 hover:border-gray-600 transition-colors">
                          <video src={v.url} muted playsInline preload="metadata" className="w-full aspect-[9/16] object-cover bg-black"
                            onMouseEnter={e => e.currentTarget.play().catch(() => {})} onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }} />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                            <p className="text-[9px] text-gray-200 truncate">{String(t.subject ?? (v.status === 'tagging' ? '⏳ đang phân tích…' : '—'))}</p>
                            <p className="text-[8px] text-gray-400">{Math.round(v.duration_s)}s · {String(t.mood ?? '')}</p>
                          </div>
                          <button onClick={() => deleteVideo(v.id)}
                            className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-red-900/80 text-gray-300 hover:text-red-300 rounded opacity-0 group-hover:opacity-100 transition-opacity text-xs">✕</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              </>)}
            </div>
          )}

          {/* Empty state */}
          {!selected && products.length > 0 && (
            <div className="flex-1 flex items-center justify-center text-center">
              <div>
                <p className="text-4xl mb-3">📦</p>
                <p className="text-white font-medium">Select a product</p>
                <p className="text-gray-500 text-sm mt-1">View details and manage product photography</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}>
          <div className="max-w-4xl max-h-[90vh] relative" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.image_url} alt="" className="max-h-[90vh] object-contain rounded-xl" />
            <div className="absolute top-3 right-3 flex gap-2">
              <a href={lightbox.image_url} download
                className="px-3 py-1.5 bg-black/70 hover:bg-black/90 text-white text-xs rounded-lg backdrop-blur">
                ⬇ Download
              </a>
              <button onClick={() => setLightbox(null)}
                className="w-8 h-8 bg-black/70 hover:bg-black/90 text-white rounded-lg backdrop-blur flex items-center justify-center">
                ✕
              </button>
            </div>
            <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 bg-black/70 rounded-lg px-3 py-2 backdrop-blur">
              <span className="text-[11px] text-gray-400">Loại:</span>
              <select value={lightbox.type} onChange={e => setImageType(lightbox.id, e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white">
                {IMAGE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {lightbox.is_hero ? <span className="text-xs text-yellow-400">★ Hero</span> : null}
              <button onClick={() => deleteImage(lightbox.id)} className="ml-auto text-xs text-red-400 hover:text-red-300">🗑 Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

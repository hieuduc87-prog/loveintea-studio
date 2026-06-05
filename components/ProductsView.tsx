'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';

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

export function ProductsView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<Product | null>(null);
  const [images, setImages]     = useState<ProductImage[]>([]);
  const [imgLoading, setImgLoading] = useState(false);

  // Upload
  const uploadRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState('photo');
  const [uploading, setUploading]   = useState(false);
  const [uploadMsg, setUploadMsg]   = useState('');

  // Lightbox
  const [lightbox, setLightbox] = useState<ProductImage | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/products?brand=loveintea');
    const d = await r.json() as { products: Product[] };
    setProducts(d.products ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  async function selectProduct(p: Product) {
    setSelected(p);
    setImgLoading(true);
    const r = await fetch(`/api/products/${p.id}/images`);
    const d = await r.json() as { images: ProductImage[] };
    setImages(d.images ?? []);
    setImgLoading(false);
  }

  async function uploadFiles(files: File[]) {
    if (!selected || !files.length) return;
    setUploading(true); setUploadMsg('');
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    fd.append('type', uploadType);
    const r = await fetch(`/api/products/${selected.id}/images`, { method: 'POST', body: fd });
    const d = await r.json() as { ok?: boolean; uploaded?: { id: string }[]; error?: string };
    if (d.ok) {
      setUploadMsg(`✓ ${d.uploaded?.length ?? 0} images uploaded`);
      await selectProduct(selected);
      await loadProducts();
    } else {
      setUploadMsg('✗ ' + d.error);
    }
    setUploading(false);
    setTimeout(() => setUploadMsg(''), 3000);
  }

  const parseJson = (s: string) => { try { return JSON.parse(s); } catch { return []; } };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Products & Asset Library</h2>
        <p className="text-sm text-gray-500 mt-0.5">Manage product catalog and original product photography</p>
      </div>

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

              {/* Upload zone */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Product Photography</p>
                  <div className="ml-auto flex items-center gap-2">
                    {uploadMsg && <span className={`text-xs ${uploadMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{uploadMsg}</span>}
                    <select value={uploadType} onChange={e => setUploadType(e.target.value)}
                      className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none">
                      {IMAGE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <input ref={uploadRef} type="file" accept="image/*" className="hidden" multiple
                      onChange={e => { uploadFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
                    <button onClick={() => uploadRef.current?.click()} disabled={uploading}
                      className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs rounded-lg transition-colors">
                      {uploading ? '⟳ Uploading…' : '⬆ Upload Photos'}
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
              <span className="text-xs text-gray-300 capitalize">{lightbox.type}</span>
              {lightbox.is_hero ? <span className="text-xs text-yellow-400">★ Hero image</span> : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

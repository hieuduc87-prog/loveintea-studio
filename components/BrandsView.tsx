'use client';

import { useState, useEffect, useCallback } from 'react';

interface Brand {
  id: string; name: string; slug: string; logo_url: string | null;
  domain: string | null; product_count: number; created_at: string;
}
interface Product {
  id: string; brand_id: string; name: string; display_name: string;
  slug: string; theme: string; color: string; pitch: string; image_url: string;
}

const EMPTY_BRAND = { name: '', slug: '', domain: '', logo_url: '' };
const EMPTY_PRODUCT = { name: '', display_name: '', theme: '', color: '#888888', color_name: '', pitch: '', image_url: '' };

export function BrandsView({ onSelectBrand }: { onSelectBrand?: (id: string) => void }) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Brand | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // New brand form
  const [showBrandForm, setShowBrandForm] = useState(false);
  const [brandForm, setBrandForm] = useState({ ...EMPTY_BRAND });
  const [savingBrand, setSavingBrand] = useState(false);
  const [brandMsg, setBrandMsg] = useState('');

  // New product form
  const [showProductForm, setShowProductForm] = useState(false);
  const [productForm, setProductForm] = useState({ ...EMPTY_PRODUCT });
  const [savingProduct, setSavingProduct] = useState(false);
  const [productMsg, setProductMsg] = useState('');

  // Edit brand
  const [editBrand, setEditBrand] = useState<Brand | null>(null);
  const [editForm, setEditForm] = useState({ name: '', domain: '', logo_url: '' });

  const loadBrands = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/brands');
    const d = await r.json() as { brands: Brand[] };
    setBrands(d.brands ?? []);
    setLoading(false);
  }, []);

  const loadProducts = useCallback(async (brandId: string) => {
    setLoadingProducts(true);
    const r = await fetch(`/api/brands/${brandId}`);
    const d = await r.json() as { products: Product[] };
    setProducts(d.products ?? []);
    setLoadingProducts(false);
  }, []);

  useEffect(() => { loadBrands(); }, [loadBrands]);

  async function selectBrand(b: Brand) {
    setSelected(b);
    setShowBrandForm(false);
    setShowProductForm(false);
    await loadProducts(b.id);
  }

  async function createBrand() {
    if (!brandForm.name.trim()) return;
    setSavingBrand(true); setBrandMsg('');
    const r = await fetch('/api/brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(brandForm),
    });
    const d = await r.json() as { ok?: boolean; error?: string; id?: string };
    if (d.ok) {
      setBrandForm({ ...EMPTY_BRAND });
      setShowBrandForm(false);
      await loadBrands();
    } else {
      setBrandMsg('✗ ' + d.error);
    }
    setSavingBrand(false);
  }

  async function saveBrandEdit() {
    if (!editBrand) return;
    setSavingBrand(true);
    await fetch(`/api/brands/${editBrand.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    setEditBrand(null);
    await loadBrands();
    if (selected?.id === editBrand.id) {
      setSelected(prev => prev ? { ...prev, ...editForm } : null);
    }
    setSavingBrand(false);
  }

  async function deleteBrand(id: string, name: string) {
    if (!confirm(`Delete brand "${name}"? This will delete all associated data.`)) return;
    await fetch(`/api/brands/${id}`, { method: 'DELETE' });
    if (selected?.id === id) { setSelected(null); setProducts([]); }
    await loadBrands();
  }

  async function createProduct() {
    if (!selected || !productForm.name.trim()) return;
    setSavingProduct(true); setProductMsg('');
    const r = await fetch(`/api/brands/${selected.id}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productForm),
    });
    const d = await r.json() as { ok?: boolean; error?: string };
    if (d.ok) {
      setProductForm({ ...EMPTY_PRODUCT });
      setShowProductForm(false);
      await loadProducts(selected.id);
      await loadBrands(); // refresh product count
    } else {
      setProductMsg('✗ ' + d.error);
    }
    setSavingProduct(false);
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Brands & Products</h2>
          <p className="text-xs text-gray-500">{brands.length} brands in system</p>
        </div>
        <button
          onClick={() => { setShowBrandForm(true); setSelected(null); }}
          className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg transition-colors"
        >
          + New Brand
        </button>
      </div>

      <div className="flex gap-5 min-h-0">
        {/* Brand list */}
        <div className={`space-y-2 ${selected ? 'w-72 flex-shrink-0' : 'flex-1'}`}>
          {/* New brand form */}
          {showBrandForm && (
            <div className="bg-gray-900 border border-brand-700/50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-white">New Brand</p>
              <input value={brandForm.name} onChange={e => setBrandForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Brand name *"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
              <input value={brandForm.slug} onChange={e => setBrandForm(f => ({ ...f, slug: e.target.value }))}
                placeholder="slug (auto-generated)"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
              <input value={brandForm.domain} onChange={e => setBrandForm(f => ({ ...f, domain: e.target.value }))}
                placeholder="domain (e.g. mybrand.com)"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
              <input value={brandForm.logo_url} onChange={e => setBrandForm(f => ({ ...f, logo_url: e.target.value }))}
                placeholder="Logo URL (optional)"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
              {brandMsg && <p className="text-xs text-red-400">{brandMsg}</p>}
              <div className="flex gap-2">
                <button onClick={() => { setShowBrandForm(false); setBrandMsg(''); }}
                  className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded-lg">Cancel</button>
                <button onClick={createBrand} disabled={savingBrand || !brandForm.name.trim()}
                  className="flex-1 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs rounded-lg">
                  {savingBrand ? '⟳…' : 'Create Brand'}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center text-gray-500 py-10">Loading…</div>
          ) : brands.length === 0 ? (
            <div className="text-center py-16 space-y-2">
              <p className="text-3xl">🏷️</p>
              <p className="text-white font-medium">No brands yet</p>
              <p className="text-gray-500 text-sm">Create your first brand to get started</p>
            </div>
          ) : (
            brands.map(b => {
              const isActive = selected?.id === b.id;
              return (
                <div key={b.id}
                  onClick={() => selectBrand(b)}
                  className={`group flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                    isActive ? 'border-brand-500 bg-brand-600/10' : 'border-gray-800 bg-gray-900 hover:border-gray-700'
                  }`}>
                  {/* Logo */}
                  <div className="w-10 h-10 rounded-lg bg-gray-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {b.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.logo_url} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-gray-500 text-lg">🏷️</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{b.name}</p>
                    <p className="text-[10px] text-gray-500">{b.slug} · {b.product_count} products</p>
                    {b.domain && <p className="text-[10px] text-gray-600">{b.domain}</p>}
                  </div>
                  {/* Actions */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => { setEditBrand(b); setEditForm({ name: b.name, domain: b.domain || '', logo_url: b.logo_url || '' }); }}
                      className="p-1.5 hover:bg-gray-800 rounded text-gray-500 hover:text-white text-xs"
                      title="Edit"
                    >✎</button>
                    {b.id !== 'loveintea' && (
                      <button
                        onClick={() => deleteBrand(b.id, b.name)}
                        className="p-1.5 hover:bg-red-900/30 rounded text-gray-500 hover:text-red-400 text-xs"
                        title="Delete"
                      >🗑</button>
                    )}
                  </div>
                  {/* Use button */}
                  {onSelectBrand && (
                    <button
                      onClick={e => { e.stopPropagation(); onSelectBrand(b.id); }}
                      className="px-2.5 py-1 bg-brand-600/20 hover:bg-brand-600/40 text-brand-400 text-[10px] rounded-lg flex-shrink-0"
                    >
                      Switch →
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Brand detail panel */}
        {selected && (
          <div className="flex-1 min-w-0 space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {selected.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selected.logo_url} alt="" className="w-full h-full object-contain" />
                  ) : <span className="text-3xl">🏷️</span>}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white">{selected.name}</h3>
                  <p className="text-xs text-gray-500 font-mono">{selected.id}</p>
                  {selected.domain && <p className="text-xs text-brand-400 mt-0.5">{selected.domain}</p>}
                  <p className="text-xs text-gray-600 mt-1">Created {new Date(selected.created_at).toLocaleDateString()}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-sm">✕</button>
              </div>
            </div>

            {/* Products */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Products ({products.length})
                </p>
                <button
                  onClick={() => setShowProductForm(true)}
                  className="text-xs text-brand-400 hover:text-brand-300"
                >
                  + Add Product
                </button>
              </div>

              {showProductForm && (
                <div className="bg-gray-800 rounded-xl p-4 space-y-3 border border-brand-700/30">
                  <p className="text-xs font-bold text-white">New Product for {selected.name}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Product name *"
                      className="col-span-2 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
                    <input value={productForm.display_name} onChange={e => setProductForm(f => ({ ...f, display_name: e.target.value }))}
                      placeholder="Display name"
                      className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
                    <input value={productForm.theme} onChange={e => setProductForm(f => ({ ...f, theme: e.target.value }))}
                      placeholder="Theme / tagline"
                      className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
                    <div className="flex gap-2 items-center">
                      <input type="color" value={productForm.color} onChange={e => setProductForm(f => ({ ...f, color: e.target.value }))}
                        className="w-9 h-9 rounded border border-gray-600 cursor-pointer bg-gray-700 border-0 flex-shrink-0" />
                      <input value={productForm.color_name} onChange={e => setProductForm(f => ({ ...f, color_name: e.target.value }))}
                        placeholder="Color name"
                        className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
                    </div>
                    <input value={productForm.image_url} onChange={e => setProductForm(f => ({ ...f, image_url: e.target.value }))}
                      placeholder="Image URL"
                      className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
                    <input value={productForm.pitch} onChange={e => setProductForm(f => ({ ...f, pitch: e.target.value }))}
                      placeholder="One-line pitch"
                      className="col-span-2 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
                  </div>
                  {productMsg && <p className="text-xs text-red-400">{productMsg}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => { setShowProductForm(false); setProductMsg(''); }}
                      className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg">Cancel</button>
                    <button onClick={createProduct} disabled={savingProduct || !productForm.name.trim()}
                      className="flex-1 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs rounded-lg">
                      {savingProduct ? '⟳…' : 'Add Product'}
                    </button>
                  </div>
                </div>
              )}

              {loadingProducts ? (
                <div className="text-center text-gray-500 py-6">Loading…</div>
              ) : products.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-2xl mb-2">📦</p>
                  <p className="text-gray-500 text-sm">No products yet</p>
                  <button onClick={() => setShowProductForm(true)} className="mt-2 text-xs text-brand-400 hover:text-brand-300">
                    Add first product
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {products.map(p => (
                    <div key={p.id} className="flex items-center gap-3 p-3 bg-gray-800 rounded-xl border border-gray-700">
                      <div className="w-2.5 h-8 rounded flex-shrink-0" style={{ backgroundColor: p.color }} />
                      {p.image_url && (
                        <div className="w-10 h-12 rounded overflow-hidden flex-shrink-0 bg-gray-700">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{p.display_name || p.name}</p>
                        <p className="text-[10px] text-gray-500">{p.slug} · {p.theme}</p>
                        {p.pitch && <p className="text-[10px] text-gray-600 truncate">{p.pitch}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit Brand Modal */}
      {editBrand && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-5 space-y-4">
            <p className="text-sm font-semibold text-white">Edit Brand: {editBrand.name}</p>
            <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Brand name"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
            <input value={editForm.domain} onChange={e => setEditForm(f => ({ ...f, domain: e.target.value }))}
              placeholder="Domain"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
            <input value={editForm.logo_url} onChange={e => setEditForm(f => ({ ...f, logo_url: e.target.value }))}
              placeholder="Logo URL"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
            <div className="flex gap-2">
              <button onClick={() => setEditBrand(null)} className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-xl">Cancel</button>
              <button onClick={saveBrandEdit} disabled={savingBrand}
                className="flex-1 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm rounded-xl">
                {savingBrand ? '⟳…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

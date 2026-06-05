'use client';

import { useState, useEffect, useCallback } from 'react';

interface ContentEntry {
  id: string; brand_id: string; product_id: string | null;
  product_name: string | null; product_color: string | null;
  title: string | null; caption: string | null;
  content_type: string; platform: string; status: string;
  scheduled_at: string | null; aired_at: string | null;
  post_url: string | null; notes: string | null; created_at: string;
}
interface Product { id: string; name: string; color: string; }

const STATUS_STYLES: Record<string, string> = {
  draft:     'bg-gray-800 text-gray-400',
  scheduled: 'bg-yellow-900/40 text-yellow-300',
  aired:     'bg-green-900/40 text-green-300',
};
const PLATFORMS = ['instagram', 'facebook', 'tiktok', 'youtube', 'other'];
const CONTENT_TYPES = ['post', 'reel', 'story', 'carousel', 'video', 'blog'];
const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸', facebook: '📘', tiktok: '🎵', youtube: '▶️', other: '🌐',
};

const EMPTY_FORM = {
  title: '', caption: '', content_type: 'post', platform: 'instagram',
  status: 'draft', product_id: '', scheduled_at: '', aired_at: '', post_url: '', notes: '',
};

export function ContentLogView({ brandId = 'loveintea' }: { brandId?: string }) {
  const [items, setItems]       = useState<ContentEntry[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [products, setProducts] = useState<Product[]>([]);

  // Filters
  const [filterProduct, setFilterProduct] = useState('');
  const [filterStatus, setFilterStatus]   = useState('');
  const [filterPlatform, setFilterPlatform] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [form, setForm]           = useState({ ...EMPTY_FORM });
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState('');

  const loadItems = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ brand: brandId, limit: '100' });
    if (filterProduct)  p.set('product', filterProduct);
    if (filterStatus)   p.set('status', filterStatus);
    if (filterPlatform) p.set('platform', filterPlatform);
    const r = await fetch(`/api/hub/content-log?${p}`);
    const d = await r.json() as { items: ContentEntry[]; total: number };
    setItems(d.items ?? []);
    setTotal(d.total ?? 0);
    setLoading(false);
  }, [filterProduct, filterStatus, filterPlatform]);

  useEffect(() => {
    fetch(`/api/products?brand=${brandId}`)
      .then(r => r.json())
      .then((d: { products: Product[] }) => setProducts(d.products ?? []));
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  function openCreate() {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setSaveMsg('');
    setShowModal(true);
  }

  function openEdit(item: ContentEntry) {
    setEditId(item.id);
    setForm({
      title:        item.title || '',
      caption:      item.caption || '',
      content_type: item.content_type,
      platform:     item.platform,
      status:       item.status,
      product_id:   item.product_id || '',
      scheduled_at: item.scheduled_at ? item.scheduled_at.slice(0, 16) : '',
      aired_at:     item.aired_at    ? item.aired_at.slice(0, 16)    : '',
      post_url:     item.post_url || '',
      notes:        item.notes || '',
    });
    setSaveMsg('');
    setShowModal(true);
  }

  async function save() {
    setSaving(true); setSaveMsg('');
    const body = {
      ...form,
      product_id:   form.product_id   || null,
      scheduled_at: form.scheduled_at  || null,
      aired_at:     form.aired_at      || null,
      post_url:     form.post_url      || null,
      notes:        form.notes         || null,
      title:        form.title         || null,
      caption:      form.caption       || null,
    };

    const url  = editId ? `/api/hub/content-log/${editId}` : '/api/hub/content-log';
    const method = editId ? 'PATCH' : 'POST';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

    setSaving(false);
    setShowModal(false);
    await loadItems();
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete this content log entry?')) return;
    await fetch(`/api/hub/content-log/${id}`, { method: 'DELETE' });
    setItems(prev => prev.filter(i => i.id !== id));
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Content Log</h2>
          <p className="text-xs text-gray-500">{total} entries · track what aired, where, and when</p>
        </div>
        <button
          onClick={openCreate}
          className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg transition-colors"
        >
          + Log Content
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filterProduct} onChange={e => setFilterProduct(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
        >
          <option value="">All Products</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <select
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="aired">Aired</option>
        </select>

        <select
          value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
        >
          <option value="">All Platforms</option>
          {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_ICONS[p]} {p}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center text-gray-500 py-16">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 space-y-2">
          <p className="text-3xl">📜</p>
          <p className="text-white font-medium">No content logged yet</p>
          <p className="text-gray-500 text-sm">Track posts, reels, and stories once they air</p>
          <button onClick={openCreate}
            className="mt-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-lg transition-colors">
            Log first content
          </button>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-[10px] uppercase tracking-wider">
                <th className="text-left px-4 py-2.5 font-medium">Content</th>
                <th className="text-left px-3 py-2.5 font-medium hidden sm:table-cell">Product</th>
                <th className="text-left px-3 py-2.5 font-medium">Platform</th>
                <th className="text-left px-3 py-2.5 font-medium">Status</th>
                <th className="text-left px-3 py-2.5 font-medium hidden md:table-cell">Date</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id}
                  className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-900/50'}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{item.title || item.caption?.slice(0, 50) || '—'}</div>
                    <div className="text-[10px] text-gray-500 capitalize">{item.content_type}</div>
                  </td>
                  <td className="px-3 py-3 hidden sm:table-cell">
                    {item.product_name ? (
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.product_color || '#888' }} />
                        <span className="text-gray-300">{item.product_name}</span>
                      </div>
                    ) : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-gray-300">{PLATFORM_ICONS[item.platform]} {item.platform}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_STYLES[item.status] || 'bg-gray-800 text-gray-400'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 hidden md:table-cell text-gray-500">
                    {item.aired_at
                      ? new Date(item.aired_at).toLocaleDateString()
                      : item.scheduled_at
                        ? new Date(item.scheduled_at).toLocaleDateString()
                        : new Date(item.created_at).toLocaleDateString()
                    }
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {item.post_url && (
                        <a href={item.post_url} target="_blank" rel="noopener noreferrer"
                          className="text-gray-500 hover:text-white text-[11px]" title="View live post">↗</a>
                      )}
                      <button onClick={() => openEdit(item)} className="text-gray-500 hover:text-white px-1" title="Edit">✎</button>
                      <button onClick={() => deleteItem(item.id)} className="text-red-500/60 hover:text-red-400 px-1" title="Delete">🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">{editId ? 'Edit Entry' : 'Log Content'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white">✕</button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Title</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Post title or caption headline…"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Caption</label>
                <textarea value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
                  rows={3} placeholder="Full caption text…"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-brand-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Product</label>
                  <select value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-2 text-sm text-white focus:outline-none">
                    <option value="">None</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Content Type</label>
                  <select value={form.content_type} onChange={e => setForm(f => ({ ...f, content_type: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-2 text-sm text-white focus:outline-none">
                    {CONTENT_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Platform</label>
                  <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-2 text-sm text-white focus:outline-none">
                    {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_ICONS[p]} {p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-2 text-sm text-white focus:outline-none">
                    <option value="draft">Draft</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="aired">Aired ✓</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Scheduled At</label>
                  <input type="datetime-local" value={form.scheduled_at}
                    onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-2 text-sm text-white focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Aired At</label>
                  <input type="datetime-local" value={form.aired_at}
                    onChange={e => setForm(f => ({ ...f, aired_at: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-2 text-sm text-white focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Post URL (live link)</label>
                <input value={form.post_url} onChange={e => setForm(f => ({ ...f, post_url: e.target.value }))}
                  type="url" placeholder="https://instagram.com/p/…"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Internal notes…"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-brand-500" />
              </div>

              {saveMsg && <p className="text-xs text-red-400">{saveMsg}</p>}
            </div>

            <div className="px-5 py-4 border-t border-gray-800 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={save} disabled={saving}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors">
                {saving ? '⟳ Saving…' : editId ? 'Save Changes' : 'Log Content'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

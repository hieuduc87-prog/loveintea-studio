'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Tag {
  id: string; name: string; slug: string; type: string; color: string; usage_count?: number;
}
interface Asset {
  id: string; brand_id: string; product_id: string | null;
  product_name: string | null; product_color: string | null;
  url: string; filename: string; file_type: string;
  status: 'unused' | 'scheduled' | 'aired';
  source: 'generated' | 'upload' | 'product_photo';
  notes: string | null; created_at: string;
  folder?: string | null;
  tags: Tag[];
}
interface Product { id: string; name: string; color: string; slug: string; }

const STATUS_STYLES = {
  unused:    'bg-gray-800 text-gray-400 border-gray-700',
  scheduled: 'bg-yellow-900/40 text-yellow-300 border-yellow-800/50',
  aired:     'bg-green-900/40 text-green-300 border-green-800/50',
};
const STATUS_LABELS = { unused: 'Unused', scheduled: 'Scheduled', aired: 'Aired' };
const SOURCE_LABELS = { generated: 'AI Generated', upload: 'Uploaded', product_photo: 'Product Photo' };
const TAG_TYPES = ['product', 'season', 'format', 'content_goal', 'occasion', 'custom'];

// Video vs ảnh + thumbnail nhẹ. Ảnh gốc là bản 4x (~10MB) → grid phải xin bản
// resize qua ?w=N để load nhanh, tránh kéo cả trăm MB khi mở Library.
const isVideoAsset = (a: { file_type?: string; url: string }) =>
  a.file_type === 'video' || /\.(mp4|mov|webm|avi)$/i.test(a.url);
const thumbUrl = (url: string, w: number) =>
  url.includes('/api/images/') && !/[?&]w=/.test(url) ? `${url}${url.includes('?') ? '&' : '?'}w=${w}` : url;
const TAG_TYPE_LABELS: Record<string, string> = {
  product: 'Product', season: 'Time', format: 'Format',
  content_goal: 'Goal', occasion: 'Occasion', custom: 'Custom',
};

export function AssetDamView({ brandId = 'loveintea' }: { brandId?: string }) {
  const [assets, setAssets]         = useState<Asset[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [allTags, setAllTags]       = useState<Tag[]>([]);
  const [products, setProducts]     = useState<Product[]>([]);
  const [selected, setSelected]     = useState<Asset | null>(null);

  // Filters
  const [filterProduct, setFilterProduct] = useState('');
  const [filterStatus, setFilterStatus]   = useState('');
  const [filterSource, setFilterSource]   = useState('');
  const [filterTags, setFilterTags]       = useState<string[]>([]);

  // Detail panel state
  const [detailStatus, setDetailStatus] = useState<string>('unused');
  const [detailNotes, setDetailNotes]   = useState('');
  const [detailTags, setDetailTags]     = useState<string[]>([]); // tag IDs
  const [saving, setSaving]             = useState(false);
  const [saveMsg, setSaveMsg]           = useState('');

  // Upload
  const uploadRef = useRef<HTMLInputElement>(null);
  const [uploadProduct, setUploadProduct] = useState('');
  const [uploading, setUploading]         = useState(false);
  const [uploadMsg, setUploadMsg]         = useState('');

  // New tag
  const [newTagName, setNewTagName]   = useState('');
  const [newTagType, setNewTagType]   = useState('custom');
  const [newTagColor, setNewTagColor] = useState('#6b7280');
  const [showTagForm, setShowTagForm] = useState(false);

  // Lightbox
  const [lightbox, setLightbox] = useState<Asset | null>(null);

  // Folders (drag-to-group)
  const [filterFolder, setFilterFolder] = useState<string | null>(null); // null=all, '__none__'=ungrouped
  const [folders, setFolders] = useState<Array<{ folder: string; n: number }>>([]);
  const [ungrouped, setUngrouped] = useState(0);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dragAssetId, setDragAssetId] = useState<string | null>(null);
  const [dropFolder, setDropFolder] = useState<string | null>(null);

  const loadFolders = useCallback(async () => {
    const r = await fetch(`/api/hub/assets/folder?brand=${brandId}`);
    const d = await r.json() as { folders: Array<{ folder: string; n: number }>; ungrouped: number };
    setFolders(d.folders ?? []); setUngrouped(d.ungrouped ?? 0);
  }, [brandId]);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ brand: brandId, limit: '200' });
    if (filterProduct) p.set('product', filterProduct);
    if (filterStatus)  p.set('status', filterStatus);
    if (filterSource)  p.set('source', filterSource);
    if (filterTags.length) p.set('tags', filterTags.join(','));
    if (filterFolder) p.set('folder', filterFolder);
    const r = await fetch(`/api/hub/assets?${p}`);
    const d = await r.json() as { assets: Asset[]; total: number };
    setAssets(d.assets ?? []);
    setTotal(d.total ?? 0);
    setLoading(false);
  }, [filterProduct, filterStatus, filterSource, filterTags, filterFolder, brandId]);

  // Move assets into a folder ('' = ungroup). Drag a card (or selected set) onto a folder chip.
  async function moveToFolder(ids: string[], folder: string) {
    if (!ids.length) return;
    await fetch('/api/hub/assets/folder', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, folder }),
    });
    setSelectedIds(new Set());
    await Promise.all([loadAssets(), loadFolders()]);
  }
  async function createFolderFromSelection() {
    const name = prompt('Tên folder mới:')?.trim();
    if (!name) return;
    await moveToFolder([...selectedIds], name);
  }
  function toggleSelect(id: string) {
    setSelectedIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const loadMeta = useCallback(async () => {
    const [tr, pr] = await Promise.all([
      fetch(`/api/hub/tags?brand=${brandId}`).then(r => r.json()),
      fetch(`/api/products?brand=${brandId}`).then(r => r.json()),
    ]);
    setAllTags((tr as { tags: Tag[] }).tags ?? []);
    setProducts(((pr as { products: Product[] }).products ?? []).map((p: Product) => ({
      id: p.id, name: p.name, color: p.color, slug: (p as unknown as Record<string,string>).slug,
    })));
  }, []);

  useEffect(() => { loadMeta(); loadFolders(); }, [loadMeta, loadFolders]);
  useEffect(() => { loadAssets(); }, [loadAssets]);

  function openDetail(asset: Asset) {
    setSelected(asset);
    setDetailStatus(asset.status);
    setDetailNotes(asset.notes || '');
    setDetailTags(asset.tags.map(t => t.id));
    setSaveMsg('');
  }

  async function saveDetail() {
    if (!selected) return;
    setSaving(true); setSaveMsg('');
    const original = selected.tags.map(t => t.id);
    const add = detailTags.filter(id => !original.includes(id));
    const remove = original.filter(id => !detailTags.includes(id));

    await fetch(`/api/hub/assets/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: detailStatus,
        notes: detailNotes || null,
        add_tags: add,
        remove_tags: remove,
      }),
    });

    // Optimistic update
    setAssets(prev => prev.map(a => {
      if (a.id !== selected.id) return a;
      const currentTags = allTags.filter(t => detailTags.includes(t.id));
      return { ...a, status: detailStatus as Asset['status'], notes: detailNotes || null, tags: currentTags };
    }));
    setSelected(prev => prev ? {
      ...prev, status: detailStatus as Asset['status'],
      notes: detailNotes || null,
      tags: allTags.filter(t => detailTags.includes(t.id)),
    } : null);

    setSaving(false);
    setSaveMsg('✓ Saved');
    setTimeout(() => setSaveMsg(''), 2000);
  }

  async function deleteAsset() {
    if (!selected || !confirm('Remove this asset from the library?')) return;
    await fetch(`/api/hub/assets/${selected.id}`, { method: 'DELETE' });
    setAssets(prev => prev.filter(a => a.id !== selected.id));
    setSelected(null);
  }

  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    setUploading(true); setUploadMsg('');
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    fd.append('brand_id', brandId);
    if (uploadProduct) fd.append('product_id', uploadProduct);
    const r = await fetch('/api/hub/assets/upload', { method: 'POST', body: fd });
    const d = await r.json() as { ok?: boolean; uploaded?: { id: string }[]; error?: string };
    if (d.ok) {
      setUploadMsg(`✓ ${d.uploaded?.length ?? 0} uploaded`);
      await loadAssets();
    } else {
      setUploadMsg('✗ ' + d.error);
    }
    setUploading(false);
    setTimeout(() => setUploadMsg(''), 3000);
  }

  async function createTag() {
    if (!newTagName.trim()) return;
    const r = await fetch('/api/hub/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTagName.trim(), type: newTagType, color: newTagColor }),
    });
    const d = await r.json() as { ok?: boolean; error?: string };
    if (d.ok) {
      setNewTagName(''); setShowTagForm(false);
      await loadMeta();
    }
  }

  function toggleFilterTag(tagId: string) {
    setFilterTags(prev => prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]);
  }
  function toggleDetailTag(tagId: string) {
    setDetailTags(prev => prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]);
  }

  const tagsByType = TAG_TYPES.reduce<Record<string, Tag[]>>((acc, type) => {
    acc[type] = allTags.filter(t => t.type === type);
    return acc;
  }, {});

  return (
    <div className="flex h-full min-h-0">
      {/* ──────────── Sidebar Filters ──────────── */}
      <aside className="w-56 flex-shrink-0 border-r border-gray-800 bg-gray-900/50 flex flex-col overflow-y-auto p-3 gap-4 hidden md:flex">
        <div>
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-2">Product</p>
          <select
            value={filterProduct}
            onChange={e => setFilterProduct(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
          >
            <option value="">All Products</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div>
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-2">Status</p>
          {(['', 'unused', 'scheduled', 'aired'] as const).map(s => (
            <button key={s}
              onClick={() => setFilterStatus(s)}
              className={`w-full text-left px-2.5 py-1 rounded text-xs mb-0.5 transition-colors ${
                filterStatus === s ? 'bg-brand-600/20 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {s === '' ? 'All Status' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        <div>
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-2">Source</p>
          {([['', 'All Sources'], ['generated', 'AI Generated'], ['upload', 'Uploaded'], ['product_photo', 'Product Photo']] as const).map(([val, label]) => (
            <button key={val}
              onClick={() => setFilterSource(val)}
              className={`w-full text-left px-2.5 py-1 rounded text-xs mb-0.5 transition-colors ${
                filterSource === val ? 'bg-brand-600/20 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div>
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-2">Filter by Tags</p>
          <div className="flex flex-wrap gap-1">
            {allTags.map(t => (
              <button key={t.id}
                onClick={() => toggleFilterTag(t.id)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                  filterTags.includes(t.id)
                    ? 'text-white border-transparent'
                    : 'text-gray-400 border-gray-700 hover:border-gray-600'
                }`}
                style={filterTags.includes(t.id) ? { backgroundColor: t.color, borderColor: t.color } : {}}
              >
                {t.name}
              </button>
            ))}
          </div>
          {filterTags.length > 0 && (
            <button onClick={() => setFilterTags([])} className="text-[10px] text-gray-600 hover:text-gray-400 mt-1">
              Clear tags ×
            </button>
          )}
        </div>

        {/* Upload */}
        <div className="border-t border-gray-800 pt-3">
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-2">Upload Assets</p>
          <select
            value={uploadProduct}
            onChange={e => setUploadProduct(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white mb-2 focus:outline-none"
          >
            <option value="">No product</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {uploadMsg && (
            <p className={`text-[10px] mb-1 ${uploadMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{uploadMsg}</p>
          )}
          <input ref={uploadRef} type="file" accept="image/*" multiple className="hidden"
            onChange={e => { uploadFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
          <button
            onClick={() => uploadRef.current?.click()}
            disabled={uploading}
            className="w-full py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
          >
            {uploading ? '⟳ Uploading…' : '⬆ Upload Images'}
          </button>
        </div>
      </aside>

      {/* ──────────── Image Grid ──────────── */}
      <div className={`flex-1 min-w-0 overflow-y-auto p-4 ${selected ? 'hidden md:block' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Asset Library</h2>
            <p className="text-xs text-gray-500">{total} assets total</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setSelectMode(m => !m); setSelectedIds(new Set()); }}
              className={`text-xs px-2 py-1 rounded border ${selectMode ? 'bg-brand-600 text-white border-brand-500' : 'text-gray-400 border-gray-700 hover:text-white'}`}>
              {selectMode ? '✓ Đang chọn' : '☑ Chọn nhiều'}
            </button>
            {(filterProduct || filterStatus || filterSource || filterTags.length > 0) && (
              <button
                onClick={() => { setFilterProduct(''); setFilterStatus(''); setFilterSource(''); setFilterTags([]); }}
                className="text-xs text-gray-500 hover:text-white border border-gray-700 hover:border-gray-600 px-2 py-1 rounded"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* ── Folder bar — drag images (or selected set) onto a folder to group ── */}
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {[{ key: null as string | null, label: '📂 Tất cả', n: total }, { key: '__none__', label: '• Chưa gom', n: ungrouped },
            ...folders.map(f => ({ key: f.folder, label: `🗂 ${f.folder}`, n: f.n }))].map(chip => (
            <button key={chip.key ?? 'all'}
              onClick={() => setFilterFolder(chip.key)}
              onDragOver={e => { if (dragAssetId || selectedIds.size) { e.preventDefault(); setDropFolder(chip.key ?? 'all'); } }}
              onDragLeave={() => setDropFolder(null)}
              onDrop={e => { e.preventDefault(); const ids = selectedIds.size ? [...selectedIds] : dragAssetId ? [dragAssetId] : []; const target = chip.key === '__none__' || chip.key === null ? (chip.key === '__none__' ? '' : '') : chip.key; if (chip.key && chip.key !== '__none__') moveToFolder(ids, chip.key); else if (chip.key === '__none__') moveToFolder(ids, ''); setDropFolder(null); setDragAssetId(null); }}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                (dropFolder === (chip.key ?? 'all')) ? 'border-brand-400 bg-brand-600/30 text-white ring-1 ring-brand-400' :
                filterFolder === chip.key ? 'bg-brand-600/20 text-brand-300 border-brand-600/40' : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'}`}>
              {chip.label} <span className="text-gray-500">({chip.n})</span>
            </button>
          ))}
          {selectMode && selectedIds.size > 0 && (
            <>
              <span className="text-[11px] text-gray-400 ml-1">{selectedIds.size} đã chọn →</span>
              <button onClick={createFolderFromSelection} className="text-xs px-2.5 py-1 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold">+ Gom vào folder mới</button>
              {folders.map(f => (
                <button key={'mv' + f.folder} onClick={() => moveToFolder([...selectedIds], f.folder)}
                  className="text-xs px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300">→ {f.folder}</button>
              ))}
              <button onClick={() => moveToFolder([...selectedIds], '')} className="text-xs px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-500">Bỏ gom</button>
            </>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-500 text-sm">Loading…</div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-4xl mb-3">🗃️</p>
            <p className="text-white font-medium">No assets yet</p>
            <p className="text-gray-500 text-sm mt-1">Upload images using the sidebar, or generate via Image Studio</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {assets.map(asset => (
              <div
                key={asset.id}
                draggable
                onDragStart={() => setDragAssetId(asset.id)}
                onDragEnd={() => setDragAssetId(null)}
                onClick={() => { if (selectMode) toggleSelect(asset.id); else openDetail(asset); }}
                className={`group relative rounded-xl overflow-hidden border cursor-pointer transition-all ${
                  selectedIds.has(asset.id) ? 'border-brand-400 ring-2 ring-brand-400' :
                  selected?.id === asset.id
                    ? 'border-brand-500 ring-1 ring-brand-500'
                    : 'border-gray-800 hover:border-gray-600'
                } ${dragAssetId === asset.id ? 'opacity-40' : ''}`}
              >
                {(selectMode || selectedIds.has(asset.id)) && (
                  <div className={`absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] ${selectedIds.has(asset.id) ? 'bg-brand-500 border-brand-400 text-white' : 'bg-black/50 border-gray-400'}`}>
                    {selectedIds.has(asset.id) ? '✓' : ''}
                  </div>
                )}
                {asset.folder && (
                  <span className="absolute bottom-1.5 right-1.5 z-10 text-[8px] bg-black/70 text-brand-300 px-1 rounded">🗂 {asset.folder}</span>
                )}
                <div className="aspect-square bg-gray-900 relative">
                  {isVideoAsset(asset) ? (
                    <>
                      <video
                        src={`${asset.url}#t=0.1`}
                        muted playsInline preload="metadata"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 text-[8px] bg-black/70 text-white px-1 rounded flex items-center gap-0.5">▶ video</span>
                    </>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={thumbUrl(asset.url, 400)}
                      alt={asset.filename}
                      loading="lazy"
                      className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.opacity = '0.2'; }}
                    />
                  )}
                </div>

                {/* Status badge */}
                <div className="absolute top-1.5 left-1.5">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${STATUS_STYLES[asset.status]}`}>
                    {STATUS_LABELS[asset.status]}
                  </span>
                </div>

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-1.5 space-y-0.5">
                    {asset.product_name && (
                      <div className="flex items-center gap-1">
                        {asset.product_color && (
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: asset.product_color }} />
                        )}
                        <span className="text-[9px] text-gray-300 truncate">{asset.product_name}</span>
                      </div>
                    )}
                    {asset.tags.length > 0 && (
                      <div className="flex flex-wrap gap-0.5">
                        {asset.tags.slice(0, 3).map(t => (
                          <span key={t.id} className="text-[8px] px-1 py-px rounded" style={{ backgroundColor: t.color + '50', color: t.color }}>
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Expand icon */}
                <button
                  onClick={e => { e.stopPropagation(); setLightbox(asset); }}
                  className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px]"
                >
                  ⛶
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ──────────── Detail Panel ──────────── */}
      {selected && (
        <aside className="w-72 flex-shrink-0 border-l border-gray-800 bg-gray-900 flex flex-col overflow-y-auto fixed md:relative inset-0 md:inset-auto z-20 md:z-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
            <p className="text-xs font-semibold text-white">Asset Detail</p>
            <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-sm">✕</button>
          </div>

          {/* Preview */}
          <div className="mx-4 mt-4 rounded-xl overflow-hidden bg-gray-800 flex-shrink-0">
            {isVideoAsset(selected) ? (
              <video src={selected.url} controls muted playsInline preload="metadata" className="w-full object-contain max-h-48" />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={thumbUrl(selected.url, 600)} alt="" className="w-full object-contain max-h-48" />
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {/* Source & date */}
            <div className="flex items-center justify-between text-[10px] text-gray-500">
              <span>{SOURCE_LABELS[selected.source]}</span>
              <span>{new Date(selected.created_at).toLocaleDateString()}</span>
            </div>

            {/* Product */}
            {selected.product_name && (
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: selected.product_color || '#888' }} />
                <span className="text-xs text-gray-300">{selected.product_name}</span>
              </div>
            )}

            {/* Status */}
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Status</p>
              <div className="flex gap-2">
                {(['unused', 'scheduled', 'aired'] as const).map(s => (
                  <button key={s}
                    onClick={() => setDetailStatus(s)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      detailStatus === s ? STATUS_STYLES[s] + ' !border-current' : 'bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-300'
                    }`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Tags</p>
                <button onClick={() => setShowTagForm(!showTagForm)} className="text-[10px] text-brand-400 hover:text-brand-300">
                  + New tag
                </button>
              </div>

              {showTagForm && (
                <div className="bg-gray-800 rounded-lg p-3 mb-3 space-y-2">
                  <input
                    value={newTagName} onChange={e => setNewTagName(e.target.value)}
                    placeholder="Tag name…"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none"
                    onKeyDown={e => { if (e.key === 'Enter') createTag(); }}
                  />
                  <div className="flex gap-2">
                    <select value={newTagType} onChange={e => setNewTagType(e.target.value)}
                      className="flex-1 bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-[10px] text-white focus:outline-none">
                      {TAG_TYPES.map(t => <option key={t} value={t}>{TAG_TYPE_LABELS[t] || t}</option>)}
                    </select>
                    <input type="color" value={newTagColor} onChange={e => setNewTagColor(e.target.value)}
                      className="w-8 h-7 rounded border-gray-600 cursor-pointer bg-gray-700 border" />
                    <button onClick={createTag} className="px-2 py-1 bg-brand-600 hover:bg-brand-700 text-white text-[10px] rounded">
                      Add
                    </button>
                  </div>
                </div>
              )}

              {TAG_TYPES.map(type => {
                const typeTags = tagsByType[type] || [];
                if (!typeTags.length) return null;
                return (
                  <div key={type} className="mb-2">
                    <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-1">{TAG_TYPE_LABELS[type]}</p>
                    <div className="flex flex-wrap gap-1">
                      {typeTags.map(t => (
                        <button key={t.id}
                          onClick={() => toggleDetailTag(t.id)}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
                            detailTags.includes(t.id)
                              ? 'text-white border-transparent scale-105'
                              : 'text-gray-400 border-gray-700 hover:border-gray-500'
                          }`}
                          style={detailTags.includes(t.id) ? { backgroundColor: t.color, borderColor: t.color } : {}}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Notes */}
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Notes</p>
              <textarea
                value={detailNotes}
                onChange={e => setDetailNotes(e.target.value)}
                rows={3}
                placeholder="Add notes about this asset…"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white resize-none focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Actions */}
            {saveMsg && (
              <p className={`text-xs ${saveMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{saveMsg}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={saveDetail}
                disabled={saving}
                className="flex-1 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
              >
                {saving ? '⟳ Saving…' : 'Save Changes'}
              </button>
              <button
                onClick={deleteAsset}
                className="px-3 py-2 bg-red-900/30 hover:bg-red-900/60 text-red-400 text-xs rounded-lg transition-colors border border-red-900/50"
              >
                🗑
              </button>
            </div>

            {/* Quick links */}
            <div className="flex gap-2 pt-1">
              <a href={selected.url} target="_blank" rel="noopener noreferrer"
                className="flex-1 py-1.5 text-center text-[10px] text-gray-500 hover:text-white border border-gray-800 rounded-lg transition-colors">
                Open original ↗
              </a>
              <a href={selected.url} download
                className="flex-1 py-1.5 text-center text-[10px] text-gray-500 hover:text-white border border-gray-800 rounded-lg transition-colors">
                ⬇ Download
              </a>
            </div>
          </div>
        </aside>
      )}

      {/* ──────────── Lightbox ──────────── */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}>
          <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            {isVideoAsset(lightbox) ? (
              <video src={lightbox.url} controls autoPlay muted playsInline className="max-h-[90vh] object-contain rounded-xl" />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={thumbUrl(lightbox.url, 1440)} alt="" className="max-h-[90vh] object-contain rounded-xl" />
            )}
            <div className="absolute top-3 right-3 flex gap-2">
              <a href={lightbox.url} download
                className="px-3 py-1.5 bg-black/70 hover:bg-black/90 text-white text-xs rounded-lg backdrop-blur">
                ⬇ Download
              </a>
              <button onClick={() => setLightbox(null)}
                className="w-8 h-8 bg-black/70 hover:bg-black/90 text-white rounded-lg backdrop-blur flex items-center justify-center text-sm">
                ✕
              </button>
            </div>
            {(lightbox.product_name || lightbox.tags.length > 0) && (
              <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3 bg-black/70 rounded-xl px-4 py-2.5 backdrop-blur">
                {lightbox.product_name && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: lightbox.product_color || '#888' }} />
                    <span className="text-xs text-white">{lightbox.product_name}</span>
                  </div>
                )}
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_STYLES[lightbox.status]}`}>
                  {STATUS_LABELS[lightbox.status]}
                </span>
                <div className="flex flex-wrap gap-1 ml-auto">
                  {lightbox.tags.map(t => (
                    <span key={t.id} className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: t.color + '40', color: t.color }}>
                      {t.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ──────────────────────────────────────────────────
interface TemplateAnalysis {
  layout?: { type: string; columns: number; rows: number; description: string };
  zones?: Array<{ zone_id: string; type: string; position: string; size: string; description: string }>;
  typography?: { headline_style: string; body_style: string; text_hierarchy: string; estimated_word_count: { headline: number; body: number } };
  colors?: { palette: string[]; mood: string; contrast: string };
  product_placement?: { has_product: boolean; position: string; size: string; style: string };
  style_keywords?: string[];
  best_for?: string[];
  content_direction?: string;
}

interface Template {
  id: string;
  brand_id: string;
  name: string;
  category: string;
  purpose: string;
  format: string;
  aspect_ratio: string;
  image_url: string;
  thumbnail_url: string;
  tags: string;
  color_palette: string;
  notes: string;
  analysis: string;
  is_active: number;
  usage_count: number;
  created_at: string;
  file_type?: string;
  kind?: string;
  slides_json?: string;
}

const CATEGORIES = [
  { id: 'layout',   label: 'Layout',   color: 'bg-blue-500' },
  { id: 'promo',    label: 'Promo',    color: 'bg-red-500' },
  { id: 'story',    label: 'Story',    color: 'bg-purple-500' },
  { id: 'quote',    label: 'Quote',    color: 'bg-yellow-500' },
  { id: 'product',  label: 'Product',  color: 'bg-green-500' },
  { id: 'event',    label: 'Event',    color: 'bg-pink-500' },
  { id: 'seasonal', label: 'Seasonal', color: 'bg-orange-500' },
  { id: 'general',  label: 'General',  color: 'bg-gray-500' },
];

const FORMATS = [
  { id: 'post',       label: 'Post' },
  { id: 'story',      label: 'Story' },
  { id: 'reel_cover', label: 'Reel Cover' },
  { id: 'carousel',   label: 'Carousel' },
  { id: 'banner',     label: 'Banner' },
];

const ASPECT_RATIOS = ['1:1', '4:5', '2:3', '9:16', '16:9'];

// ─── Main Component ─────────────────────────────────────────
export function ContentTemplatesView({ brandId }: { brandId?: string } = {}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState('');
  const [fmtFilter, setFmtFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Template | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [perf, setPerf] = useState<Record<string, { posts: number; avg_engaged: number; win: boolean }>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [newTplName, setNewTplName] = useState('');
  const [newTplType, setNewTplType] = useState<'single' | 'collection' | 'video'>('single');

  const bid = brandId || 'loveintea';

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ brand: bid, active: '1', limit: '200' });
    if (catFilter) p.set('category', catFilter);
    if (fmtFilter) p.set('format', fmtFilter);
    if (search) p.set('q', search);
    const r = await fetch(`/api/content-templates?${p}`);
    const d = await r.json();
    setTemplates(d.templates ?? []);
    setLoading(false);
  }, [bid, catFilter, fmtFilter, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch(`/api/templates/performance?brand=${bid}`).then(r => r.json()).then((d: { templates?: Array<{ id: string; posts: number; avg_engaged: number; win: boolean }> }) => {
      const m: Record<string, { posts: number; avg_engaged: number; win: boolean }> = {};
      for (const t of d.templates ?? []) m[t.id] = { posts: t.posts, avg_engaged: t.avg_engaged, win: t.win };
      setPerf(m);
    }).catch(() => {});
  }, [bid]);

  async function deleteTemplate(id: string) {
    if (!confirm('Delete this template?')) return;
    await fetch(`/api/content-templates/${id}`, { method: 'DELETE' });
    setTemplates(ts => ts.filter(t => t.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  // Create an empty template shell with a chosen type → open its detail to add media
  async function createShell(type: 'single' | 'collection' | 'video', nm: string) {
    const r = await fetch('/api/content-templates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandId: bid, name: nm?.trim() || 'Template mới',
        file_type: type === 'video' ? 'video' : 'image',
        kind: type === 'collection' ? 'collection' : 'single',
      }),
    });
    const d = await r.json() as { id?: string };
    if (!d.id) return;
    const list = await fetch(`/api/content-templates?brand=${bid}&active=1&limit=200`).then(x => x.json()) as { templates: Template[] };
    setTemplates(list.templates ?? []);
    const created = (list.templates ?? []).find(t => t.id === d.id);
    if (created) setSelected(created);
    setShowCreate(false); setNewTplName('');
  }

  // After slides change in DetailPanel — refresh that template's cover/kind/slides everywhere
  function applySlides(id: string, patch: Partial<Template>) {
    setTemplates(ts => ts.map(t => t.id === id ? { ...t, ...patch } : t));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, ...patch } : null);
  }

  async function updateTemplate(id: string, data: Partial<Template>) {
    await fetch(`/api/content-templates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setTemplates(ts => ts.map(t => t.id === id ? { ...t, ...data } : t));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, ...data } : null);
    setEditingId(null);
  }

  const parseTags = (t: Template): string[] => {
    try { return JSON.parse(t.tags); } catch { return []; }
  };

  const parseAnalysis = (t: Template): TemplateAnalysis | null => {
    if (!t.analysis) return null;
    try { return JSON.parse(t.analysis); } catch { return null; }
  };

  async function reAnalyze(id: string) {
    const r = await fetch(`/api/content-templates/${id}/analyze`, { method: 'POST' });
    const d = await r.json();
    if (d.ok && d.analysis) {
      setTemplates(ts => ts.map(t => t.id === id ? { ...t, analysis: JSON.stringify(d.analysis) } : t));
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, analysis: JSON.stringify(d.analysis) } : null);
    }
  }

  // Template chưa phân tích → chưa có "prompt thật" để bám khi tạo content. Phân tích hết 1 lần.
  const isUnanalyzed = (t: Template) => !t.analysis || t.analysis === '{}' || t.analysis.trim() === '';
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [analyzeProg, setAnalyzeProg] = useState('');
  async function analyzeAllMissing() {
    const missing = templates.filter(isUnanalyzed);
    if (!missing.length) { setAnalyzeProg('✓ Tất cả template đã có prompt phân tích'); return; }
    setAnalyzingAll(true);
    for (let i = 0; i < missing.length; i++) {
      setAnalyzeProg(`Đang phân tích ${i + 1}/${missing.length}: ${missing[i].name}…`);
      try { await reAnalyze(missing[i].id); } catch { /* skip lỗi, làm tiếp */ }
    }
    setAnalyzingAll(false);
    setAnalyzeProg(`✓ Xong — đã phân tích ${missing.length} template`);
  }

  const catColor = (cat: string) => CATEGORIES.find(c => c.id === cat)?.color ?? 'bg-gray-500';
  const catLabel = (cat: string) => CATEGORIES.find(c => c.id === cat)?.label ?? cat;

  // Stats
  const stats = {
    total: templates.length,
    byCategory: CATEGORIES.map(c => ({
      ...c,
      count: templates.filter(t => t.category === c.id).length,
    })).filter(c => c.count > 0),
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-white">Content Templates</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Upload visual templates for the system to reference when creating content
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(() => { const n = templates.filter(isUnanalyzed).length; return n > 0 ? (
            <button onClick={analyzeAllMissing} disabled={analyzingAll}
              className="px-3 py-1.5 bg-amber-600/80 hover:bg-amber-600 text-white text-xs font-medium rounded-lg disabled:opacity-50"
              title="Phân tích các template chưa có prompt — để khi tạo content bám đúng template">
              {analyzingAll ? '⟳ Đang phân tích…' : `⚠ Phân tích ${n} template chưa có prompt`}
            </button>
          ) : null; })()}
          <button onClick={load} className="text-xs text-gray-600 hover:text-white px-3 py-1.5 bg-gray-800 rounded-lg">
            ↻ Refresh
          </button>
          <button onClick={() => setShowCreate(v => !v)}
            className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg transition-colors">
            {showCreate ? '✕ Đóng' : '+ Tạo template'}
          </button>
          <button onClick={() => setShowUpload(true)}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium rounded-lg transition-colors">
            ⬆ Upload nhanh
          </button>
        </div>
      </div>
      {analyzeProg && <p className="text-[11px] text-amber-400 mb-3 flex-shrink-0">{analyzeProg}</p>}

      {/* Create template — chọn loại */}
      {showCreate && (
        <div className="flex items-center gap-2 flex-wrap mb-4 bg-gray-900 border border-brand-600/30 rounded-xl p-3 flex-shrink-0">
          <span className="text-xs text-gray-400">Tạo template mới:</span>
          <input value={newTplName} onChange={e => setNewTplName(e.target.value)} placeholder="Tên template"
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white w-48" />
          <select value={newTplType} onChange={e => setNewTplType(e.target.value as 'single' | 'collection' | 'video')}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white">
            <option value="single">🖼 1 ảnh</option>
            <option value="collection">📚 Collection (nhiều ảnh có thứ tự)</option>
            <option value="video">🎬 Video</option>
          </select>
          <button onClick={() => createShell(newTplType, newTplName)}
            className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-lg">Tạo & thêm media →</button>
        </div>
      )}

      {/* Stats Bar */}
      {stats.total > 0 && (
        <div className="flex items-center gap-3 mb-4 flex-shrink-0 overflow-x-auto pb-1">
          <span className="text-xs text-gray-500">{stats.total} templates</span>
          <span className="text-gray-700">|</span>
          {stats.byCategory.map(c => (
            <button
              key={c.id}
              onClick={() => setCatFilter(catFilter === c.id ? '' : c.id)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors ${
                catFilter === c.id ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${c.color}`} />
              {c.label} <span className="text-gray-600">{c.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4 flex-shrink-0">
        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>

        <select
          value={fmtFilter}
          onChange={e => setFmtFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
        >
          <option value="">All Formats</option>
          {FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>

        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search templates..."
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500 w-48"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center text-gray-500 py-20">Loading...</div>
      ) : templates.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          <p className="text-4xl mb-3">🎨</p>
          <p className="mb-1">No content templates yet</p>
          <p className="text-xs text-gray-600 mb-4">
            Upload template images to build your visual style library.
            <br />The system will reference these when auto-creating content.
          </p>
          <button
            onClick={() => setShowUpload(true)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-lg transition-colors"
          >
            + Upload First Template
          </button>
        </div>
      ) : (
        <div className={`flex-1 flex min-h-0 ${selected ? 'flex-col md:flex-row gap-4 md:gap-6 overflow-auto md:overflow-hidden' : 'flex-col overflow-hidden'}`}>
          {/* Grid */}
          <div className={`overflow-y-auto ${selected ? 'md:w-[480px] md:flex-shrink-0' : 'w-full'}`}>
            <div className={`grid gap-3 ${selected ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'}`}>
              {templates.map(tpl => (
                <TemplateCard
                  key={tpl.id}
                  tpl={tpl}
                  perf={perf[tpl.id]}
                  isSelected={selected?.id === tpl.id}
                  catColor={catColor}
                  catLabel={catLabel}
                  parseTags={parseTags}
                  onSelect={() => setSelected(selected?.id === tpl.id ? null : tpl)}
                  onDelete={() => deleteTemplate(tpl.id)}
                />
              ))}
            </div>
          </div>

          {/* Detail Panel */}
          {selected && (
            <DetailPanel
              tpl={selected}
              catColor={catColor}
              catLabel={catLabel}
              parseTags={parseTags}
              parseAnalysis={parseAnalysis}
              editingId={editingId}
              onStartEdit={() => setEditingId(selected.id)}
              onSlidesChanged={(patch) => applySlides(selected.id, patch)}
              onSave={(data) => updateTemplate(selected.id, data)}
              onCancelEdit={() => setEditingId(null)}
              onClose={() => setSelected(null)}
              onDelete={() => deleteTemplate(selected.id)}
              onReAnalyze={() => reAnalyze(selected.id)}
            />
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal
          brandId={bid}
          onClose={() => setShowUpload(false)}
          onUploaded={() => { setShowUpload(false); load(); }}
        />
      )}
    </div>
  );
}

// ─── Template Card ──────────────────────────────────────────
function TemplateCard({
  tpl, perf, isSelected, catColor, catLabel, parseTags, onSelect, onDelete,
}: {
  tpl: Template;
  perf?: { posts: number; avg_engaged: number; win: boolean };
  isSelected: boolean;
  catColor: (c: string) => string;
  catLabel: (c: string) => string;
  parseTags: (t: Template) => string[];
  onSelect: () => void;
  onDelete: () => void;
}) {
  const tags = parseTags(tpl);
  const [expanded, setExpanded] = useState(false);
  const innerSlides: Array<{ url: string }> = (() => { try { return JSON.parse(tpl.slides_json || '[]'); } catch { return []; } })();
  return (
    <div
      onClick={onSelect}
      className={`group relative rounded-xl overflow-hidden border cursor-pointer transition-all ${
        isSelected ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-gray-800 hover:border-gray-600'
      }`}
    >
      {/* Thumbnail */}
      <div className="aspect-[3/4] bg-gray-800 relative">
        {tpl.file_type === 'video' ? (
          <>
            <video
              src={tpl.image_url}
              className="w-full h-full object-cover"
              muted
              preload="metadata"
            />
            <span className="absolute bottom-1.5 right-1.5 text-[9px] bg-black/70 text-white px-1.5 py-0.5 rounded-full font-medium">
              VIDEO
            </span>
          </>
        ) : innerSlides.length > 1 ? (
          // Collection → collapsed collage of ALL inner images
          <div className={`w-full h-full grid gap-px bg-gray-900 ${innerSlides.length === 2 ? 'grid-cols-2' : innerSlides.length === 3 ? 'grid-cols-2 grid-rows-2' : 'grid-cols-2 grid-rows-2'}`}>
            {innerSlides.slice(0, 4).map((s, i) => (
              <div key={i} className={`relative overflow-hidden ${innerSlides.length === 3 && i === 0 ? 'row-span-2' : ''}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                {i === 3 && innerSlides.length > 4 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-sm font-bold">+{innerSlides.length - 4}</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tpl.thumbnail_url || tpl.image_url}
            alt={tpl.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        )}
        {tpl.kind === 'collection' && innerSlides.length > 1 && (
          <button onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
            className="absolute bottom-1.5 left-1.5 text-[9px] bg-purple-600/90 hover:bg-purple-500 text-white px-1.5 py-0.5 rounded-full font-medium">
            📚 {innerSlides.length} {expanded ? '▲' : '▾'}
          </button>
        )}
      </div>

      {/* Collapse/expand inner ordered images (collection) */}
      {expanded && innerSlides.length > 1 && (
        <div className="flex gap-1 p-1.5 bg-gray-950/80 overflow-x-auto" onClick={e => e.stopPropagation()}>
          {innerSlides.map((s, i) => (
            <div key={i} className="relative flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.url} alt="" className="w-10 h-14 object-cover rounded" />
              <span className="absolute top-0 left-0 w-3.5 h-3.5 bg-brand-600 text-white text-[7px] rounded-br flex items-center justify-center">{i + 1}</span>
            </div>
          ))}
        </div>
      )}

      {/* Category + type badge */}
      <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 items-start">
        <span className={`text-[9px] text-white px-1.5 py-0.5 rounded-full font-medium ${catColor(tpl.category)}`}>
          {catLabel(tpl.category)}
        </span>
        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-black/70 text-gray-200">
          {tpl.file_type === 'video' ? '🎬 Video' : innerSlides.length > 1 ? `📚 Collection ${innerSlides.length}` : '🖼 1 ảnh'}
        </span>
        {perf && perf.posts > 0 && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${perf.win ? 'bg-emerald-600/90 text-white' : 'bg-gray-700/90 text-gray-300'}`}
            title={`${perf.posts} bài đã đăng · TB engaged ${Math.round(perf.avg_engaged)}`}>
            {perf.win ? '🏆 win' : '📊'} {Math.round(perf.avg_engaged)}
          </span>
        )}
      </div>

      {/* Usage count */}
      {tpl.usage_count > 0 && (
        <span className="absolute top-1.5 right-1.5 text-[9px] bg-black/60 text-gray-300 px-1.5 py-0.5 rounded-full">
          {tpl.usage_count}x used
        </span>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
        <p className="text-xs text-white font-medium truncate">{tpl.name}</p>
        {tpl.purpose && <p className="text-[9px] text-gray-400 truncate">{tpl.purpose}</p>}
        <div className="flex items-center gap-1 mt-1">
          <span className="text-[9px] text-gray-500">{tpl.format}</span>
          <span className="text-[9px] text-gray-600">{tpl.aspect_ratio}</span>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-0.5 mt-1">
            {tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="text-[8px] bg-white/10 text-gray-300 px-1 rounded">{tag}</span>
            ))}
            {tags.length > 3 && <span className="text-[8px] text-gray-500">+{tags.length - 3}</span>}
          </div>
        )}
      </div>

      {/* Delete button (hover) */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        className="absolute top-1.5 right-1.5 w-5 h-5 rounded bg-black/60 text-xs flex items-center justify-center text-red-400 hover:bg-red-900/80 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Delete"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Detail Panel ───────────────────────────────────────────
function DetailPanel({
  tpl, catColor, catLabel, parseTags, parseAnalysis, editingId, onStartEdit, onSave, onCancelEdit, onClose, onDelete, onReAnalyze, onSlidesChanged,
}: {
  tpl: Template;
  catColor: (c: string) => string;
  catLabel: (c: string) => string;
  parseTags: (t: Template) => string[];
  parseAnalysis: (t: Template) => TemplateAnalysis | null;
  editingId: string | null;
  onStartEdit: () => void;
  onSave: (data: Partial<Template>) => void;
  onCancelEdit: () => void;
  onClose: () => void;
  onDelete: () => void;
  onReAnalyze: () => void;
  onSlidesChanged: (patch: Partial<Template>) => void;
}) {
  const slideFileRef = useRef<HTMLInputElement>(null);
  const [slides, setSlides] = useState<Array<{ url: string; order: number }>>([]);
  const [slideBusy, setSlideBusy] = useState(false);
  const [slideDrag, setSlideDrag] = useState<number | null>(null);

  useEffect(() => {
    try { const a = JSON.parse(tpl.slides_json || '[]'); setSlides(Array.isArray(a) ? a : []); } catch { setSlides([]); }
  }, [tpl.id, tpl.slides_json]);

  // Library picker (drag/select existing images into this template)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lib, setLib] = useState<Array<{ id: string; url: string }>>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  function applyResp(d: { ok?: boolean; slides?: typeof slides; cover?: string; kind?: string; file_type?: string }) {
    if (!d.ok) return;
    if (d.file_type === 'video') { onSlidesChanged({ image_url: d.cover, kind: 'single', file_type: 'video', slides_json: '[]' }); setSlides([]); return; }
    if (d.slides) { setSlides(d.slides); onSlidesChanged({ slides_json: JSON.stringify(d.slides), image_url: d.cover, kind: d.kind }); }
  }
  async function openPicker() {
    setPickerOpen(true);
    if (lib.length) return;
    const r = await fetch(`/api/hub/assets?brand=${tpl.brand_id}&limit=200`).catch(() => null);
    if (r?.ok) { const d = await r.json() as { assets?: Array<{ id: string; url: string }> }; setLib(d.assets ?? []); }
  }
  async function addUrls(urls: string[]) {
    if (!urls.length) return;
    setSlideBusy(true);
    const r = await fetch(`/api/content-templates/${tpl.id}/slides`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ addUrls: urls }),
    });
    applyResp(await r.json());
    setPicked(new Set()); setSlideBusy(false);
  }

  async function uploadSlides(files: FileList | null) {
    if (!files?.length) return;
    setSlideBusy(true);
    const fd = new FormData();
    Array.from(files).forEach(f => fd.append('files', f));
    const r = await fetch(`/api/content-templates/${tpl.id}/slides`, { method: 'POST', body: fd });
    applyResp(await r.json());
    setSlideBusy(false);
  }
  async function saveSlideOrder(next: typeof slides) {
    setSlides(next);
    const r = await fetch(`/api/content-templates/${tpl.id}/slides`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slides: next }),
    });
    const d = await r.json() as { ok?: boolean; slides?: typeof slides; cover?: string; kind?: string };
    if (d.ok && d.slides) { setSlides(d.slides); onSlidesChanged({ slides_json: JSON.stringify(d.slides), image_url: d.cover, kind: d.kind }); }
  }
  function moveSlide(from: number, to: number) {
    if (from === to) return;
    const a = [...slides]; const [m] = a.splice(from, 1); a.splice(to, 0, m);
    saveSlideOrder(a.map((s, i) => ({ url: s.url, order: i })));
  }
  function removeSlide(i: number) { saveSlideOrder(slides.filter((_, x) => x !== i).map((s, j) => ({ url: s.url, order: j }))); }
  const isEditing = editingId === tpl.id;
  const [editName, setEditName] = useState(tpl.name);
  const [editCategory, setEditCategory] = useState(tpl.category);
  const [editPurpose, setEditPurpose] = useState(tpl.purpose);
  const [editFormat, setEditFormat] = useState(tpl.format);
  const [editNotes, setEditNotes] = useState(tpl.notes);
  const [editTags, setEditTags] = useState(parseTags(tpl).join(', '));

  useEffect(() => {
    setEditName(tpl.name);
    setEditCategory(tpl.category);
    setEditPurpose(tpl.purpose);
    setEditFormat(tpl.format);
    setEditNotes(tpl.notes);
    setEditTags(parseTags(tpl).join(', '));
  }, [tpl]); // eslint-disable-line react-hooks/exhaustive-deps

  const tags = parseTags(tpl);

  return (
    <div className="flex-1 overflow-y-auto min-w-0">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] text-white px-2 py-0.5 rounded-full font-medium ${catColor(tpl.category)}`}>
              {catLabel(tpl.category)}
            </span>
            <span className="text-white font-semibold text-sm">{tpl.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <button onClick={onStartEdit} className="text-xs text-gray-500 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors">
                Edit
              </button>
            )}
            <button onClick={onClose} className="text-gray-500 hover:text-white text-sm">✕ Close</button>
          </div>
        </div>

        {/* Media trong template */}
        {tpl.file_type === 'video' ? (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Video template</p>
              <input ref={slideFileRef} type="file" accept="video/*" className="hidden" onChange={e => { uploadSlides(e.target.files); e.target.value = ''; }} />
              <button onClick={() => slideFileRef.current?.click()} disabled={slideBusy}
                className="ml-auto px-2.5 py-1 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-[11px] font-semibold">
                {slideBusy ? '⟳ Đang tải…' : tpl.image_url ? 'Đổi video' : '+ Upload video'}
              </button>
            </div>
            {tpl.image_url ? (
              <div className="rounded-xl overflow-hidden bg-gray-800"><video src={tpl.image_url} controls className="w-full" preload="metadata" /></div>
            ) : (
              <div onClick={() => slideFileRef.current?.click()} className="border-2 border-dashed border-gray-700 hover:border-brand-500 rounded-xl p-8 text-center cursor-pointer">
                <p className="text-2xl mb-1">🎬</p><p className="text-xs text-gray-400">Tải video cho template này</p>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Ảnh trong template ({slides.length})</p>
              <span className="text-[10px] text-gray-600">{slides.length > 1 ? 'collection — kéo để sắp thứ tự' : slides.length === 1 ? 'single' : 'trống — thêm ảnh'}</span>
              <input ref={slideFileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { uploadSlides(e.target.files); e.target.value = ''; }} />
              <button onClick={openPicker} disabled={slideBusy}
                className="ml-auto px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-200 text-[11px] font-semibold">
                🖼 Ảnh có sẵn
              </button>
              <button onClick={() => slideFileRef.current?.click()} disabled={slideBusy}
                className="px-2.5 py-1 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-[11px] font-semibold">
                {slideBusy ? '⟳ Đang tải…' : '+ Upload ảnh'}
              </button>
            </div>

            {/* Library picker — kéo/chọn ảnh cũ vào template */}
            {pickerOpen && (
              <div className="mb-2 bg-gray-950/70 border border-gray-800 rounded-lg p-2">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] text-gray-400">Kéo ảnh vào khung ảnh template, hoặc chọn rồi bấm Thêm</span>
                  {picked.size > 0 && <button onClick={() => addUrls([...picked])} className="ml-auto px-2 py-0.5 rounded bg-brand-600 hover:bg-brand-500 text-white text-[10px] font-semibold">+ Thêm {picked.size} ảnh</button>}
                  <button onClick={() => setPickerOpen(false)} className="text-gray-500 hover:text-white text-xs">✕</button>
                </div>
                {lib.length === 0 ? <p className="text-[10px] text-gray-600 py-2">Đang tải thư viện…</p> : (
                  <div className="grid grid-cols-6 gap-1 max-h-40 overflow-y-auto">
                    {lib.map(a => (
                      <div key={a.id} draggable onDragStart={e => e.dataTransfer.setData('text/uri-list', a.url)}
                        onClick={() => setPicked(p => { const n = new Set(p); n.has(a.url) ? n.delete(a.url) : n.add(a.url); return n; })}
                        className={`relative rounded overflow-hidden border cursor-pointer ${picked.has(a.url) ? 'border-brand-400 ring-1 ring-brand-400' : 'border-gray-800'}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.url} alt="" className="w-full aspect-square object-cover" loading="lazy" />
                        {picked.has(a.url) && <span className="absolute top-0.5 right-0.5 text-[8px] bg-brand-500 text-white rounded-full w-3 h-3 flex items-center justify-center">✓</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {slides.length === 0 ? (
              <div onClick={() => slideFileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const u = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain'); if (u && u.startsWith('/')) addUrls([u]); }}
                className="border-2 border-dashed border-gray-700 hover:border-brand-500 rounded-xl p-8 text-center cursor-pointer">
                <p className="text-2xl mb-1">🖼</p><p className="text-xs text-gray-400">Upload, hoặc <b>kéo ảnh có sẵn</b> từ thư viện vào đây (có thứ tự)</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2"
                onDragOver={e => { if (slideDrag === null) e.preventDefault(); }}
                onDrop={e => { const u = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain'); if (u && u.startsWith('/') && slideDrag === null) { e.preventDefault(); addUrls([u]); } }}>
                {slides.map((s, i) => (
                  <div key={s.url} className={`relative group rounded-lg overflow-hidden border border-gray-700 ${slideDrag === i ? 'opacity-40' : ''}`}
                    draggable onDragStart={() => setSlideDrag(i)} onDragEnd={() => setSlideDrag(null)}
                    onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (slideDrag !== null) moveSlide(slideDrag, i); setSlideDrag(null); }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.url} alt="" className="w-full aspect-[3/4] object-cover cursor-grab active:cursor-grabbing" />
                    <span className="absolute top-1 left-1 w-4 h-4 bg-brand-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{i + 1}</span>
                    {i === 0 && <span className="absolute bottom-1 left-1 text-[8px] bg-black/70 text-yellow-300 px-1 rounded">cover</span>}
                    <button onClick={() => removeSlide(i)} className="absolute top-1 right-1 w-4 h-4 bg-black/70 hover:bg-red-700 text-white text-[9px] rounded-full opacity-0 group-hover:opacity-100">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Edit / View Mode */}
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name</label>
              <input value={editName} onChange={e => setEditName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Category</label>
                <select value={editCategory} onChange={e => setEditCategory(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Format</label>
                <select value={editFormat} onChange={e => setEditFormat(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                  {FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Purpose</label>
              <input value={editPurpose} onChange={e => setEditPurpose(e.target.value)}
                placeholder="e.g. flash sale, new launch, testimonial"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tags <span className="text-gray-600">(comma-separated)</span></label>
              <input value={editTags} onChange={e => setEditTags(e.target.value)}
                placeholder="minimal, bold text, warm tones"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Notes</label>
              <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 resize-none" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onSave({
                  name: editName,
                  category: editCategory,
                  purpose: editPurpose,
                  format: editFormat,
                  notes: editNotes,
                  tags: JSON.stringify(editTags.split(',').map(t => t.trim()).filter(Boolean)),
                })}
                className="flex-1 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors"
              >
                Save Changes
              </button>
              <button onClick={onCancelEdit}
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm transition-colors">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Format</p>
                <p className="text-sm text-white capitalize">{tpl.format.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Aspect Ratio</p>
                <p className="text-sm text-white">{tpl.aspect_ratio}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Usage</p>
                <p className="text-sm text-white">{tpl.usage_count}x used</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Added</p>
                <p className="text-sm text-white">{new Date(tpl.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Purpose */}
            {tpl.purpose && (
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Purpose</p>
                <p className="text-sm text-white">{tpl.purpose}</p>
              </div>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1.5">Style Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag, i) => (
                    <span key={i} className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Color palette */}
            {tpl.color_palette && (
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Dominant Color</p>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full border border-gray-700" style={{ backgroundColor: tpl.color_palette }} />
                  <span className="text-xs text-gray-400">{tpl.color_palette}</span>
                </div>
              </div>
            )}

            {/* Notes */}
            {tpl.notes && (
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Notes</p>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{tpl.notes}</p>
              </div>
            )}

            {/* AI Analysis */}
            <AnalysisSection analysis={parseAnalysis(tpl)} onReAnalyze={onReAnalyze} />

            {/* Generate carousel post from this template */}
            <GenerateFromTemplate tpl={tpl} slideCount={slides.length || 1} />

            {/* Actions */}
            <div className="border-t border-gray-800 pt-4 flex gap-2">
              <a
                href={tpl.image_url}
                download={`template-${tpl.name.replace(/\s+/g, '-')}.png`}
                className="flex-1 text-center py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs transition-colors"
              >
                Download
              </a>
              <button
                onClick={() => navigator.clipboard.writeText(
                  tpl.image_url.startsWith('/') ? `${window.location.origin}${tpl.image_url}` : tpl.image_url
                )}
                className="flex-1 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs transition-colors"
              >
                Copy URL
              </button>
              <button
                onClick={onDelete}
                className="px-4 py-2 rounded-lg bg-red-900/20 hover:bg-red-900/40 text-red-400 text-xs transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Upload Modal ───────────────────────────────────────────
function UploadModal({
  brandId, onClose, onUploaded,
}: {
  brandId: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('general');
  const [purpose, setPurpose] = useState('');
  const [format, setFormat] = useState('post');
  const [aspectRatio, setAspectRatio] = useState('2:3');
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [fileStatuses, setFileStatuses] = useState<Record<string, 'pending' | 'uploading' | 'done' | 'error'>>({});
  const [error, setError] = useState('');
  const [asCollection, setAsCollection] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // Reorder the image tray (drag a thumbnail onto another) — sets slide order
  function moveFile(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    setFiles(fs => { const a = [...fs]; const [m] = a.splice(from, 1); a.splice(to, 0, m); return a; });
    setPreviews(ps => { const a = [...ps]; const [m] = a.splice(from, 1); a.splice(to, 0, m); return a; });
  }
  function removeFile(i: number) {
    setFiles(fs => fs.filter((_, x) => x !== i));
    setPreviews(ps => ps.filter((_, x) => x !== i));
  }

  // Common preset templates — pre-fill the form (user then drops images in)
  const PRESETS = [
    { label: '🛍️ Sản phẩm 1 ảnh', category: 'product', format: 'post', aspect: '4:5', slides: 1 },
    { label: '🔥 Flash Sale', category: 'promo', format: 'post', aspect: '1:1', slides: 1 },
    { label: '📖 Carousel kể chuyện', category: 'story', format: 'carousel', aspect: '4:5', slides: 5 },
    { label: '💬 Quote / Tip', category: 'quote', format: 'post', aspect: '1:1', slides: 1 },
    { label: '🔄 Before / After', category: 'product', format: 'carousel', aspect: '4:5', slides: 2 },
    { label: '🎬 Reel cover', category: 'story', format: 'reel_cover', aspect: '9:16', slides: 1 },
  ];

  const doneCount = Object.values(fileStatuses).filter(s => s === 'done').length;
  const progress = files.length > 0 ? Math.round((doneCount / files.length) * 100) : 0;

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const arr = Array.from(fileList).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (!arr.length) return;
    setFiles(prev => [...prev, ...arr]);                                   // append (drop + "Thêm ảnh")
    setPreviews(prev => [...prev, ...arr.map(f => URL.createObjectURL(f))]);
    setFiles(prev => { if (prev.length > 1) setAsCollection(true); return prev; }); // auto-collection when multi
    if (files.length === 0 && arr.length === 1 && !name) {
      setName(arr[0].name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
    }
  }

  async function upload() {
    if (files.length === 0) { setError('Select at least one image or video'); return; }
    setUploading(true); setError('');

    // Collection mode: all files → ONE ordered template (carousel)
    if (asCollection && files.length > 1) {
      try {
        const fd = new FormData();
        files.forEach(f => fd.append('files', f));
        fd.append('brand_id', brandId);
        fd.append('name', name || files[0].name.replace(/\.[^.]+$/, ''));
        fd.append('category', category);
        fd.append('purpose', purpose);
        fd.append('format', format === 'post' ? 'carousel' : format);
        fd.append('aspect_ratio', aspectRatio);
        fd.append('tags', JSON.stringify(tags.split(',').map(t => t.trim()).filter(Boolean)));
        fd.append('notes', notes);
        const r = await fetch('/api/content-templates/upload', { method: 'POST', body: fd });
        const d = await r.json();
        setUploading(false);
        if (!d.ok) { setError(d.error || 'Upload failed'); return; }
        onUploaded();
      } catch (e) { setUploading(false); setError(String(e)); }
      return;
    }

    // Initialize per-file status
    const initial = Object.fromEntries(files.map(f => [f.name + f.size, 'pending' as const]));
    setFileStatuses(initial);

    // Upload ALL files in parallel
    const results = await Promise.allSettled(
      files.map(async (file) => {
        const key = file.name + file.size;
        setFileStatuses(s => ({ ...s, [key]: 'uploading' }));

        const fd = new FormData();
        fd.append('file', file);
        fd.append('brand_id', brandId);
        fd.append('name', files.length === 1 ? (name || file.name) : file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
        fd.append('category', category);
        fd.append('purpose', purpose);
        fd.append('format', format);
        fd.append('aspect_ratio', aspectRatio);
        fd.append('tags', JSON.stringify(tags.split(',').map(t => t.trim()).filter(Boolean)));
        fd.append('notes', notes);

        const r = await fetch('/api/content-templates/upload', { method: 'POST', body: fd });
        const d = await r.json();
        if (!d.ok) {
          setFileStatuses(s => ({ ...s, [key]: 'error' }));
          throw new Error(d.error || 'Upload failed');
        }
        setFileStatuses(s => ({ ...s, [key]: 'done' }));
      })
    );

    setUploading(false);
    const failed = results.filter(r => r.status === 'rejected');
    const succeeded = results.filter(r => r.status === 'fulfilled').length;

    if (failed.length === 0) {
      onUploaded();
    } else {
      const errMsg = (failed[0] as PromiseRejectedResult).reason?.message ?? 'Upload failed';
      setError(`${failed.length} file(s) failed: ${errMsg}`);
      if (succeeded > 0) onUploaded(); // reload even on partial success
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold text-sm">🎨 Tạo Content Template</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
          </div>

          {/* Preset picker — common template types */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Mẫu phổ biến (chọn để điền nhanh)</label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map(p => (
                <button key={p.label} onClick={() => { setCategory(p.category); setFormat(p.format); setAspectRatio(p.aspect); setAsCollection(p.slides > 1); if (!name) setName(p.label.replace(/^\S+\s/, '')); }}
                  className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-brand-600/30 border border-gray-700 hover:border-brand-500 text-[11px] text-gray-200 transition-colors"
                  title={`${p.format} · ${p.aspect} · ${p.slides} ảnh`}>
                  {p.label}{p.slides > 1 ? ` (${p.slides})` : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-brand-500'); }}
            onDragLeave={e => e.currentTarget.classList.remove('border-brand-500')}
            onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('border-brand-500'); handleFiles(e.dataTransfer.files); }}
            className="border-2 border-dashed border-gray-700 rounded-xl p-6 text-center cursor-pointer hover:border-gray-500 transition-colors"
          >
            {previews.length > 0 ? (
              <div className="grid grid-cols-4 gap-2" onClick={e => e.stopPropagation()}>
                {files.map((file, i) => {
                  const key = file.name + file.size;
                  const status = fileStatuses[key];
                  const isVid = file.type.startsWith('video/');
                  const ordered = files.length > 1;
                  return (
                    <div key={i} className={`relative group ${dragIdx === i ? 'opacity-40' : ''}`}
                      draggable={ordered}
                      onDragStart={e => { e.stopPropagation(); setDragIdx(i); }}
                      onDragOver={e => { if (ordered) { e.preventDefault(); e.stopPropagation(); } }}
                      onDrop={e => { if (ordered && dragIdx !== null) { e.preventDefault(); e.stopPropagation(); moveFile(dragIdx, i); setDragIdx(null); } }}
                      onDragEnd={() => setDragIdx(null)}>
                      {isVid ? (
                        <video src={previews[i]} muted preload="metadata" className="w-full aspect-[3/4] object-cover rounded-lg bg-gray-700" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={previews[i]} alt="" className={`w-full aspect-[3/4] object-cover rounded-lg ${ordered ? 'cursor-grab active:cursor-grabbing' : ''}`} />
                      )}
                      {/* Order badge for collections */}
                      {ordered && !status && (
                        <span className="absolute top-1 left-1 w-4 h-4 bg-brand-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{i + 1}</span>
                      )}
                      {/* Remove */}
                      {!status && (
                        <button onClick={ev => { ev.stopPropagation(); removeFile(i); }}
                          className="absolute top-1 right-1 w-4 h-4 bg-black/70 hover:bg-red-700 text-white text-[9px] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                      )}
                      {/* Per-file status overlay */}
                      {status && (
                        <div className={`absolute inset-0 rounded-lg flex items-center justify-center ${
                          status === 'uploading' ? 'bg-black/40' :
                          status === 'done' ? 'bg-green-900/40' :
                          status === 'error' ? 'bg-red-900/50' : ''
                        }`}>
                          {status === 'uploading' && <span className="text-lg animate-spin">↻</span>}
                          {status === 'done' && <span className="text-xl text-green-400">✓</span>}
                          {status === 'error' && <span className="text-xl text-red-400">✕</span>}
                        </div>
                      )}
                      {isVid && !status && (
                        <span className="absolute bottom-1 right-1 text-[8px] bg-black/70 text-white px-1 rounded">VID</span>
                      )}
                    </div>
                  );
                })}
                {/* Add-more tile */}
                <button onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
                  className="aspect-[3/4] rounded-lg border-2 border-dashed border-gray-700 hover:border-brand-500 flex flex-col items-center justify-center text-gray-600 hover:text-brand-400 transition-colors">
                  <span className="text-xl">+</span><span className="text-[9px]">Thêm ảnh</span>
                </button>
              </div>
            ) : (
              <>
                <p className="text-2xl mb-2">🎨</p>
                <p className="text-sm text-gray-400">Kéo thả ảnh/video vào đây để tạo template</p>
                <p className="text-xs text-gray-600 mt-1">1 ảnh = template đơn · nhiều ảnh = collection (kéo để sắp thứ tự)</p>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden"
            onChange={e => handleFiles(e.target.files)} />

          {/* Collection toggle (when >1 file) */}
          {files.length > 1 && (
            <label className="flex items-center gap-2 cursor-pointer bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2">
              <input type="checkbox" checked={asCollection} onChange={e => setAsCollection(e.target.checked)} className="accent-brand-500" />
              <span className="text-xs text-gray-300">📚 Gộp {files.length} ảnh thành <b>1 collection</b> (carousel có thứ tự)</span>
              <span className="text-[10px] text-gray-600 ml-auto">{asCollection ? '→ 1 template' : `→ ${files.length} template riêng`}</span>
            </label>
          )}

          {/* Name (single file OR collection) */}
          {(files.length <= 1 || asCollection) && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Template Name</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Flash Sale Banner — Bold"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
            </div>
          )}

          {/* Category + Format */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Format</label>
              <select value={format} onChange={e => setFormat(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                {FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
          </div>

          {/* Aspect ratio */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Aspect Ratio</label>
            <div className="flex gap-2">
              {ASPECT_RATIOS.map(ar => (
                <button key={ar} onClick={() => setAspectRatio(ar)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    aspectRatio === ar ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}>
                  {ar}
                </button>
              ))}
            </div>
          </div>

          {/* Purpose */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Purpose</label>
            <input value={purpose} onChange={e => setPurpose(e.target.value)}
              placeholder="e.g. flash sale, new product launch, testimonial, seasonal"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Style Tags <span className="text-gray-600">(comma-separated)</span></label>
            <input value={tags} onChange={e => setTags(e.target.value)}
              placeholder="minimal, bold text, warm tones, organic, premium"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes <span className="text-gray-600">(optional)</span></label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Any notes about this template style..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 resize-none" />
          </div>

          {/* Error */}
          {error && <p className="text-red-400 text-xs">{error}</p>}

          {/* Progress */}
          {uploading && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-gray-500">
                <span>{doneCount}/{files.length} done</span>
                <span>{progress}%</span>
              </div>
              <div className="bg-gray-800 rounded-full h-2 overflow-hidden">
                <div className="bg-brand-500 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={upload}
              disabled={uploading || files.length === 0}
              className="flex-1 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              {uploading ? `Đang tạo…` : (asCollection && files.length > 1) ? `Tạo template collection (${files.length} ảnh)` : `Tạo ${files.length || ''} template${files.length > 1 ? ' riêng' : ''}`}
            </button>
            <button onClick={onClose} disabled={uploading}
              className="px-4 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm transition-colors">
              Cancel
            </button>
          </div>
          {uploading && (
            <p className="text-xs text-gray-500 text-center">
              Uploading all files simultaneously — Gemini analyzing images in parallel...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Generate carousel post from template ───────────────────
function GenerateFromTemplate({ tpl, slideCount }: { tpl: Template; slideCount: number }) {
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [productId, setProductId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [result, setResult] = useState<{ images?: string[]; count?: number } | null>(null);

  useEffect(() => {
    fetch(`/api/products?brand=${tpl.brand_id}`).then(r => r.json()).then(d => setProducts(d.products ?? [])).catch(() => {});
  }, [tpl.brand_id]);

  async function generate() {
    setBusy(true); setMsg('⟳ Đang gửi yêu cầu…'); setResult(null);
    try {
      const r = await fetch(`/api/content-templates/${tpl.id}/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId: tpl.brand_id, productId: productId || undefined }),
      });
      const d = await r.json() as { ok?: boolean; jobId?: string; error?: string };
      if (!d.ok || !d.jobId) { setMsg('✗ ' + (d.error ?? 'Lỗi tạo post')); setBusy(false); return; }
      // Carousel chạy NỀN → poll Job Queue tới khi xong (tránh timeout với nhiều slide).
      const jobId = d.jobId;
      for (let i = 0; i < 90; i++) {
        await new Promise(res => setTimeout(res, 3000));
        const jr = await fetch('/api/jobs?limit=120').then(x => x.json()).catch(() => null);
        const job = (jr?.jobs ?? []).find((j: { id: string }) => j.id === jobId) as { status: string; progress: number; error?: string; result_json?: string } | undefined;
        if (!job) { setMsg('⟳ Đang tạo…'); continue; }
        if (job.status === 'running' || job.status === 'pending') { setMsg(`⟳ Đang sinh ảnh… ${job.progress || 0}%`); continue; }
        if (job.status === 'failed') { setMsg('✗ ' + (job.error ?? 'Lỗi tạo ảnh')); break; }
        if (job.status === 'done') {
          let res: { count?: number; url?: string; images?: string[] } = {};
          try { res = JSON.parse(job.result_json || '{}'); } catch { /* */ }
          setResult({ images: res.images ?? (res.url ? [res.url] : []), count: res.count });
          setMsg(`✓ Đã tạo post carousel ${res.count ?? ''} ảnh — vào Review & Queue để duyệt/đăng.`);
          break;
        }
      }
    } catch (e) { setMsg('✗ ' + String(e)); }
    setBusy(false);
  }

  return (
    <div className="border-t border-gray-800 pt-4">
      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">🎬 Tạo post từ template ({slideCount} ảnh)</p>
      <p className="text-[11px] text-gray-500 mb-2">Chọn sản phẩm → AI sinh {slideCount} ảnh theo đúng thứ tự + bố cục template, gộp thành 1 post carousel (caption tự viết bám cấu trúc).</p>
      <div className="flex gap-2">
        <select value={productId} onChange={e => setProductId(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-xs text-white">
          <option value="">— Chọn sản phẩm —</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={generate} disabled={busy}
          className="px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-semibold whitespace-nowrap">
          {busy ? `⟳ Đang sinh ${slideCount} ảnh…` : `✨ Tạo ${slideCount} ảnh → 1 post`}
        </button>
      </div>
      {msg && <p className={`text-xs mt-2 ${msg.startsWith('✓') ? 'text-emerald-400' : msg.startsWith('✗') ? 'text-red-400' : 'text-gray-400'}`}>{msg}</p>}
      {result?.images?.length ? (
        <div className="flex gap-1.5 mt-2 overflow-x-auto">
          {result.images.map((u, i) => (
            <div key={i} className="relative flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${u}${u.includes('?') ? '&' : '?'}w=300`} alt="" className="w-16 h-20 object-cover rounded-lg border border-gray-700" />
              {result.images!.length > 1 && <span className="absolute top-0.5 left-0.5 text-[8px] bg-black/70 text-white px-1 rounded-full">{i + 1}</span>}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ─── Analysis Section ───────────────────────────────────────
function AnalysisSection({ analysis, onReAnalyze }: { analysis: TemplateAnalysis | null; onReAnalyze: () => void }) {
  const [reanalyzing, setReanalyzing] = useState(false);

  async function handleReAnalyze() {
    setReanalyzing(true);
    await onReAnalyze();
    setReanalyzing(false);
  }

  return (
    <div className="border-t border-gray-800 pt-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">🤖 AI phân tích cấu trúc template</p>
        <button onClick={handleReAnalyze} disabled={reanalyzing}
          className="text-[10px] text-white px-2.5 py-1 rounded bg-brand-600 hover:bg-brand-500 transition-colors disabled:opacity-50 font-semibold">
          {reanalyzing ? '⟳ Đang phân tích…' : '🤖 AI Analyze'}
        </button>
      </div>

      {!analysis ? (
        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 mb-2">Chưa phân tích — bấm AI Analyze để Gemini đọc số ảnh, step, nội dung từng ảnh + rút khung sườn tái dùng.</p>
          <button onClick={handleReAnalyze} disabled={reanalyzing}
            className="text-xs text-brand-400 hover:text-brand-300 disabled:opacity-50 font-semibold">
            {reanalyzing ? 'Đang phân tích…' : '🤖 Chạy AI Analyze'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Collection: structure + skeleton + per-slide steps */}
          {(() => {
            const a = analysis as unknown as { slide_count?: number; structure?: string; skeleton?: string; slides?: Array<{ index: number; role: string; content: string; text_on_image?: string }> };
            if (!a.skeleton && !a.slides) return null;
            return (
              <div className="space-y-2">
                {a.structure && (
                  <div className="bg-brand-900/20 border border-brand-700/30 rounded-lg p-3">
                    <p className="text-[10px] text-brand-400 uppercase tracking-widest mb-1">Cấu trúc ({a.slide_count ?? a.slides?.length} ảnh)</p>
                    <p className="text-xs text-gray-200">{a.structure}</p>
                  </div>
                )}
                {a.slides && a.slides.length > 0 && (
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Từng ảnh / step</p>
                    <div className="space-y-1.5">
                      {a.slides.map((s, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="w-4 h-4 bg-brand-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">{s.index ?? i + 1}</span>
                          <div className="min-w-0">
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-300 font-medium">{s.role}</span>
                            <p className="text-[11px] text-gray-300 mt-0.5">{s.content}{s.text_on_image ? ` · chữ: "${s.text_on_image}"` : ''}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {a.skeleton && (
                  <div className="bg-emerald-900/15 border border-emerald-700/30 rounded-lg p-3">
                    <p className="text-[10px] text-emerald-400 uppercase tracking-widest mb-1">🦴 Khung sườn tái dùng</p>
                    <p className="text-[11px] text-gray-200 whitespace-pre-wrap">{a.skeleton}</p>
                    <p className="text-[9px] text-gray-500 mt-1.5">Khi tạo post & chọn template này, hệ thống dùng khung sườn + brand + sản phẩm mới để dựng post cấu trúc tương đương.</p>
                  </div>
                )}
              </div>
            );
          })()}
          {/* Layout */}
          {analysis.layout && (
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Layout</p>
              <p className="text-xs text-white font-medium capitalize">{analysis.layout.type}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{analysis.layout.description}</p>
              {(analysis.layout.columns > 1 || analysis.layout.rows > 1) && (
                <p className="text-[10px] text-gray-500 mt-0.5">{analysis.layout.columns}col x {analysis.layout.rows}row</p>
              )}
            </div>
          )}

          {/* Zones */}
          {analysis.zones && analysis.zones.length > 0 && (
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Content Zones</p>
              <div className="space-y-1.5">
                {analysis.zones.map((z, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 mt-0.5 ${
                      z.type === 'text' ? 'bg-blue-900/30 text-blue-400' :
                      z.type === 'image' ? 'bg-green-900/30 text-green-400' :
                      z.type === 'product' ? 'bg-yellow-900/30 text-yellow-400' :
                      z.type === 'logo' ? 'bg-purple-900/30 text-purple-400' :
                      'bg-gray-700 text-gray-400'
                    }`}>{z.type}</span>
                    <div className="min-w-0">
                      <p className="text-[11px] text-white">{z.zone_id} <span className="text-gray-500">— {z.position}, {z.size}</span></p>
                      <p className="text-[10px] text-gray-500 truncate">{z.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Typography */}
          {analysis.typography && (
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Typography</p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-gray-500">Headline: </span>
                  <span className="text-white">{analysis.typography.headline_style}</span>
                </div>
                <div>
                  <span className="text-gray-500">Body: </span>
                  <span className="text-white">{analysis.typography.body_style}</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">{analysis.typography.text_hierarchy}</p>
              {analysis.typography.estimated_word_count && (
                <p className="text-[10px] text-gray-600 mt-0.5">
                  ~{analysis.typography.estimated_word_count.headline} words headline, ~{analysis.typography.estimated_word_count.body} words body
                </p>
              )}
            </div>
          )}

          {/* Colors */}
          {analysis.colors && (
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1.5">Colors</p>
              <div className="flex items-center gap-1.5 mb-1.5">
                {analysis.colors.palette?.map((hex, i) => (
                  <span key={i} className="w-5 h-5 rounded-full border border-gray-700" style={{ backgroundColor: hex }} title={hex} />
                ))}
              </div>
              <p className="text-[11px] text-gray-400">
                Mood: <span className="text-white capitalize">{analysis.colors.mood}</span>
                {' '}| Contrast: <span className="text-white capitalize">{analysis.colors.contrast}</span>
              </p>
            </div>
          )}

          {/* Product Placement */}
          {analysis.product_placement?.has_product && (
            <div className="bg-yellow-900/10 border border-yellow-900/20 rounded-lg p-3">
              <p className="text-[10px] text-yellow-500 uppercase tracking-widest mb-1">Product Zone</p>
              <p className="text-[11px] text-white">
                {analysis.product_placement.position} — {analysis.product_placement.size}
              </p>
              <p className="text-[10px] text-gray-400">Style: {analysis.product_placement.style}</p>
            </div>
          )}

          {/* Best For */}
          {analysis.best_for && analysis.best_for.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1.5">Best For</p>
              <div className="flex flex-wrap gap-1">
                {analysis.best_for.map((b, i) => (
                  <span key={i} className="text-[10px] bg-brand-900/20 text-brand-400 px-2 py-0.5 rounded-full">{b}</span>
                ))}
              </div>
            </div>
          )}

          {/* Content Direction */}
          {analysis.content_direction && (
            <div className="bg-brand-900/10 border border-brand-900/20 rounded-lg p-3">
              <p className="text-[10px] text-brand-400 uppercase tracking-widest mb-1">Content Direction</p>
              <p className="text-[11px] text-gray-300 leading-relaxed">{analysis.content_direction}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

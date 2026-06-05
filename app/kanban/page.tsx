'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Plus, X, Image, Loader2, Trash2, Upload } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface KanbanCard {
  id: string;
  title: string;
  description: string;
  goal: string;
  type: string;
  priority: string;
  status: string;
  fileHint: string;
  images: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────
const COLUMNS = [
  { key: 'todo',       label: 'Cần làm',            color: '#be185d', bg: '#fff1f2', dotColor: '#f43f5e' },
  { key: 'starting',  label: '⚡ Bắt đầu xử lý',   color: '#b45309', bg: '#fef9c3', dotColor: '#eab308' },
  { key: 'inprogress', label: 'Claude đang fix...',  color: '#0369a1', bg: '#dbeafe', dotColor: '#3b82f6' },
  { key: 'done',       label: 'Đã xử lý xong',       color: '#15803d', bg: '#dcfce7', dotColor: '#22c55e' },
  { key: 'approved',   label: 'Duyệt ✓',             color: '#7c3aed', bg: '#f3e8ff', dotColor: '#a855f7' },
] as const;

const TYPE_OPTIONS = [
  { value: 'bug',     label: '🐛 Bug — lỗi cần sửa' },
  { value: 'task',    label: '✅ Task — việc cần làm' },
  { value: 'feature', label: '✨ Feature — tính năng mới' },
];

const PRIORITY_OPTIONS = [
  { value: 'critical', label: '🔴 Critical — chặn production' },
  { value: 'high',     label: '🟠 High — ảnh hưởng chính' },
  { value: 'medium',   label: '🟡 Medium — bình thường' },
  { value: 'low',      label: '🟢 Low — khi rảnh' },
];

const PRIORITY_BADGE: Record<string, { color: string; bg: string; icon: string }> = {
  critical: { color: '#b91c1c', bg: '#fee2e2', icon: '🔴' },
  high:     { color: '#c2410c', bg: '#ffedd5', icon: '🟠' },
  medium:   { color: '#b45309', bg: '#fef3c7', icon: '🟡' },
  low:      { color: '#15803d', bg: '#dcfce7', icon: '🟢' },
};

const TYPE_BADGE: Record<string, { color: string; bg: string }> = {
  bug:     { color: '#dc2626', bg: '#fee2e2' },
  task:    { color: '#0369a1', bg: '#dbeafe' },
  feature: { color: '#7c3aed', bg: '#f3e8ff' },
};

const FILE_HINTS = [
  { label: 'Brand DNA',        value: 'components/BrandDnaView.tsx' },
  { label: 'Products',         value: 'components/ProductsView.tsx' },
  { label: 'Content Workshop', value: 'components/ContentWorkshopView.tsx' },
  { label: 'Image Studio',     value: 'components/ImageStudioView.tsx' },
  { label: 'Image Library',    value: 'components/ImageLibraryView.tsx' },
  { label: 'Content Queue',    value: 'components/ContentQueueView.tsx' },
  { label: 'Publisher',        value: 'components/PublisherView.tsx' },
  { label: 'Blog Factory',     value: 'components/BlogFactoryView.tsx' },
  { label: 'Analytics',        value: 'components/AnalyticsView.tsx' },
  { label: 'Schedule',         value: 'components/ScheduleView.tsx' },
];

// ─── Quick Add ────────────────────────────────────────────────────────────────
function QuickAdd({ colKey, onAdded }: { colKey: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/kanban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, status: colKey, type: 'task', priority: 'medium' }),
      });
      setTitle(''); setOpen(false); onAdded();
    } finally { setSaving(false); }
  }

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-slate-600 hover:bg-white/60 transition mt-1">
      <Plus size={14} /> Thêm card
    </button>
  );

  return (
    <div className="mt-2 space-y-2">
      <textarea value={title} onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } if (e.key === 'Escape') setOpen(false); }}
        placeholder="Tiêu đề card... (Enter để lưu)" rows={2} autoFocus
        className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-rose-400 resize-none bg-white shadow-sm"
      />
      <div className="flex gap-2">
        <button onClick={submit} disabled={!title.trim() || saving}
          className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition"
          style={{ background: '#f43f5e' }}>
          {saving ? '...' : 'Thêm card'}
        </button>
        <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-white/60 rounded-lg">
          <X size={14} className="text-slate-400" />
        </button>
      </div>
    </div>
  );
}

// ─── Card Modal ───────────────────────────────────────────────────────────────
function CardModal({ card, onClose, onSaved }: { card: KanbanCard; onClose: () => void; onSaved: (c: KanbanCard) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? '');
  const [goal, setGoal] = useState(card.goal ?? '');
  const [type, setType] = useState(card.type);
  const [priority, setPriority] = useState(card.priority);
  const [fileHint, setFileHint] = useState(card.fileHint ?? '');
  const [fileHintCustom, setFileHintCustom] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localImages, setLocalImages] = useState(card.images ?? []);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const mark = () => setDirty(true);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/kanban/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, goal, type, priority, fileHint: fileHint || undefined }),
      });
      if (res.ok) { const updated = await res.json(); onSaved(updated); setDirty(false); }
    } finally { setSaving(false); }
  }

  async function uploadImages(files: FileList | null) {
    if (!files) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`/api/kanban/${card.id}/image`, { method: 'POST', body: fd });
        if (res.ok) { const updated = await res.json(); setLocalImages(updated.images ?? []); }
      }
    } finally { setUploading(false); }
  }

  const pb = PRIORITY_BADGE[priority] || PRIORITY_BADGE.medium;
  const tb = TYPE_BADGE[type] || TYPE_BADGE.task;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b">
          <input value={title} onChange={e => { setTitle(e.target.value); mark(); }}
            className="text-xl font-bold text-slate-800 flex-1 focus:outline-none border-b-2 border-transparent focus:border-rose-400 pb-0.5 mr-4"
          />
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg flex-shrink-0">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Type + Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Loại</label>
              <select value={type} onChange={e => { setType(e.target.value); mark(); }}
                className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-rose-400 bg-white">
                {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Ưu tiên</label>
              <select value={priority} onChange={e => { setPriority(e.target.value); mark(); }}
                className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-rose-400 bg-white">
                {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* File hint */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">File / Function liên quan</label>
              <button onClick={() => setFileHintCustom(m => !m)} className="text-xs text-rose-500 hover:underline">
                {fileHintCustom ? 'Chọn từ list' : 'Nhập tay'}
              </button>
            </div>
            {!fileHintCustom ? (
              <select value={fileHint} onChange={e => { setFileHint(e.target.value); mark(); }}
                className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-rose-400 bg-white">
                <option value="">— Không chọn —</option>
                {FILE_HINTS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
              </select>
            ) : (
              <input value={fileHint} onChange={e => { setFileHint(e.target.value); mark(); }}
                placeholder="e.g. components/PublisherView.tsx"
                className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-rose-400 font-mono"
              />
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Mô tả lỗi / yêu cầu</label>
            <textarea value={description} onChange={e => { setDescription(e.target.value); mark(); }}
              rows={4} placeholder="Lỗi xảy ra ở đâu? Các bước tái hiện?"
              className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-rose-400 resize-none"
            />
          </div>

          {/* Goal */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">
              Mục tiêu <span className="text-slate-400 normal-case font-normal">— output ra sao mới đúng</span>
            </label>
            <textarea value={goal} onChange={e => { setGoal(e.target.value); mark(); }}
              rows={3} placeholder="Kết quả mong đợi: nút X redirect sang Y, không mở modal Z..."
              className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-400 resize-none"
            />
          </div>

          {/* Screenshots */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">
              Screenshots ({localImages.length})
            </label>
            {localImages.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {localImages.map((img, i) => (
                  <a key={i} href={`/api/kanban/${card.id}/image/${img}`} target="_blank" rel="noreferrer"
                    className="block w-24 h-24 rounded-xl border-2 border-slate-200 overflow-hidden hover:border-rose-400 transition">
                    <img src={`/api/kanban/${card.id}/image/${img}`} alt="" className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            )}
            <div onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); uploadImages(e.dataTransfer.files); }}
              className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center cursor-pointer hover:border-rose-400 transition">
              {uploading ? (
                <div className="flex items-center justify-center gap-2 text-rose-500">
                  <Loader2 size={16} className="animate-spin" /> Đang upload...
                </div>
              ) : (
                <>
                  <Upload size={18} className="mx-auto mb-2 text-slate-400" />
                  <p className="text-sm text-slate-400">Kéo nhiều ảnh vào đây hoặc click</p>
                  <p className="text-xs text-slate-300 mt-1">PNG, JPG, WebP</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => { uploadImages(e.target.files); e.target.value = ''; }} />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex items-center justify-between bg-slate-50">
          <p className="text-xs text-slate-400">Tạo: {new Date(card.createdAt).toLocaleDateString('vi-VN')}</p>
          <button onClick={save} disabled={!dirty || saving}
            className="px-5 py-2 rounded-xl font-bold text-white text-sm disabled:opacity-40 transition"
            style={{ background: '#f43f5e' }}>
            {saving ? 'Đang lưu...' : dirty ? 'Lưu thay đổi' : 'Đã lưu ✓'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function Card({ card, onEdit, onDelete, onMove }: {
  card: KanbanCard; onEdit: () => void; onDelete: () => void; onMove: (s: string) => void;
}) {
  const pb = PRIORITY_BADGE[card.priority] || PRIORITY_BADGE.medium;
  const tb = TYPE_BADGE[card.type] || TYPE_BADGE.task;
  const typeLabel = TYPE_OPTIONS.find(t => t.value === card.type)?.label.split(' ')[1] ?? card.type;
  const colIdx = COLUMNS.findIndex(c => c.key === card.status);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3.5 hover:shadow-md transition-shadow cursor-pointer group"
      onClick={onEdit}>
      <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
        <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: tb.bg, color: tb.color }}>{typeLabel}</span>
        <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: pb.bg, color: pb.color }}>
          {pb.icon} {PRIORITY_OPTIONS.find(p => p.value === card.priority)?.label.split('—')[0].split(' ').slice(1).join(' ')}
        </span>
      </div>

      <p className="text-sm font-semibold text-slate-800 leading-snug mb-2">{card.title}</p>

      {card.goal && (
        <p className="text-xs text-purple-600 bg-purple-50 rounded-lg px-2 py-1.5 mb-2 line-clamp-2 italic">🎯 {card.goal}</p>
      )}
      {card.description && !card.goal && (
        <p className="text-xs text-slate-400 line-clamp-2 mb-2">{card.description}</p>
      )}

      {card.fileHint && (
        <p className="text-xs text-rose-500 font-mono truncate mb-2">📄 {card.fileHint.split('/').slice(-2).join('/')}</p>
      )}

      {(card.status === 'inprogress' || card.status === 'starting') && (card as any).fixLog && (
        <div className="text-xs bg-slate-800 text-green-300 font-mono rounded-lg px-2 py-1.5 mb-2 line-clamp-3 whitespace-pre-wrap">
          {(card as any).fixLog.slice(-300)}
        </div>
      )}
      {card.status === 'starting' && !(card as any).fixLog && (
        <p className="text-xs text-yellow-600 animate-pulse mb-2">⏳ Đang gọi Claude CLI...</p>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-slate-100" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          {card.images.length > 0 && (
            <span className="text-xs text-slate-400 flex items-center gap-1"><Image size={11} /> {card.images.length}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {colIdx > 0 && (
            <button onClick={() => onMove(COLUMNS[colIdx - 1].key)}
              className="text-xs px-1.5 py-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">←</button>
          )}
          {colIdx < COLUMNS.length - 1 && (
            <button onClick={() => onMove(COLUMNS[colIdx + 1].key)}
              className="text-xs px-1.5 py-0.5 rounded hover:bg-rose-50 text-rose-400 hover:text-rose-600 font-bold transition">→</button>
          )}
          <button onClick={onDelete}
            className="ml-1 p-1 rounded hover:bg-red-50 text-slate-200 hover:text-red-400 transition opacity-0 group-hover:opacity-100">
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function KanbanPage() {
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [editCard, setEditCard] = useState<KanbanCard | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/kanban');
      if (res.ok) setCards(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  async function deleteCard(id: string) {
    if (!confirm(`Xóa card này?`)) return;
    await fetch(`/api/kanban/${id}`, { method: 'DELETE' });
    setCards(prev => prev.filter(c => c.id !== id));
    setEditCard(null);
  }

  async function moveCard(id: string, status: string) {
    const res = await fetch(`/api/kanban/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) { const updated = await res.json(); setCards(prev => prev.map(c => c.id === updated.id ? updated : c)); }
  }

  const byCol = (key: string) => cards.filter(c => c.status === key);
  const pending = cards.filter(c => c.status !== 'approved').length;

  return (
    <div className="min-h-screen" style={{ background: '#fdf2f4' }}>
      {editCard && (
        <CardModal
          card={editCard}
          onClose={() => { setEditCard(null); load(); }}
          onSaved={updated => { setCards(prev => prev.map(c => c.id === updated.id ? updated : c)); }}
        />
      )}

      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between" style={{ background: '#f43f5e' }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs text-rose-200 hover:text-white transition-colors">← Studio</Link>
          <div className="w-px h-4 bg-rose-300/50" />
          <h1 className="text-lg font-bold text-white">Kanban — Task Tracker</h1>
          <span className="text-sm text-rose-100">{pending} chưa duyệt</span>
        </div>
        <a href="/api/kanban/claude-brief" target="_blank" rel="noreferrer"
          className="text-xs text-rose-100 hover:text-white border border-rose-300/50 px-3 py-1.5 rounded-lg hover:bg-rose-600/30 transition">
          Claude Brief ↗
        </a>
      </div>

      {/* Board */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 size={20} className="animate-spin mr-2" /> Đang tải...
        </div>
      ) : (
        <div className="p-4 flex gap-3 items-start overflow-x-auto min-h-[calc(100vh-60px)]">
          {COLUMNS.map(col => {
            const colCards = byCol(col.key);
            return (
              <div key={col.key} className="flex-shrink-0 w-72 rounded-xl overflow-hidden" style={{ background: col.bg }}>
                <div className="flex items-center justify-between px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: col.dotColor }} />
                    <span className="text-sm font-bold" style={{ color: col.color }}>{col.label}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/60 font-bold" style={{ color: col.color }}>
                      {colCards.length}
                    </span>
                  </div>
                </div>
                <div className="px-2 pb-2 space-y-2">
                  {colCards.map(card => (
                    <Card key={card.id} card={card}
                      onEdit={() => setEditCard(card)}
                      onDelete={() => deleteCard(card.id)}
                      onMove={status => moveCard(card.id, status)}
                    />
                  ))}
                  <QuickAdd colKey={col.key} onAdded={load} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

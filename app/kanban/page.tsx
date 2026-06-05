'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import Link from 'next/link';

type CardType = 'bug' | 'task' | 'feature';
type Priority = 'critical' | 'high' | 'medium' | 'low';
type Status = 'todo' | 'inprogress' | 'done' | 'approved';

interface KanbanCard {
  id: string;
  title: string;
  description: string;
  goal: string;
  type: CardType;
  priority: Priority;
  status: Status;
  fileHint: string;
  images: string[];
  createdAt: string;
  updatedAt: string;
}

const COLUMNS: { id: Status; label: string; color: string; dot: string }[] = [
  { id: 'todo',       label: 'Cần làm',           color: '#f43f5e', dot: '#f43f5e' },
  { id: 'inprogress', label: 'Đang xử lý',        color: '#f97316', dot: '#f97316' },
  { id: 'done',       label: 'Đã xử lý xong',     color: '#10b981', dot: '#10b981' },
  { id: 'approved',   label: 'Duyệt ✓',           color: '#8b5cf6', dot: '#8b5cf6' },
];

const STATUS_ORDER: Status[] = ['todo', 'inprogress', 'done', 'approved'];

const PRIORITY_EMOJI: Record<Priority, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢',
};

const TYPE_COLORS: Record<CardType, string> = {
  bug: '#ef4444',
  task: '#f43f5e',
  feature: '#10b981',
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

export default function KanbanPage() {
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalCard, setModalCard] = useState<KanbanCard | null>(null);
  const [modalDraft, setModalDraft] = useState<Partial<KanbanCard>>({});
  const [saving, setSaving] = useState(false);
  const [addingCol, setAddingCol] = useState<Status | null>(null);
  const [addText, setAddText] = useState('');
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/kanban');
      if (res.ok) setCards(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openModal = (card: KanbanCard) => {
    setModalCard(card);
    setModalDraft({ ...card });
  };

  const closeModal = () => {
    setModalCard(null);
    setModalDraft({});
  };

  const saveModal = async () => {
    if (!modalCard) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/kanban/${modalCard.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modalDraft),
      });
      if (res.ok) {
        const updated = await res.json();
        setCards(prev => prev.map(c => c.id === updated.id ? updated : c));
        closeModal();
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteCard = async (id: string) => {
    if (!confirm('Xóa card này?')) return;
    await fetch(`/api/kanban/${id}`, { method: 'DELETE' });
    setCards(prev => prev.filter(c => c.id !== id));
    closeModal();
  };

  const moveCard = async (id: string, direction: -1 | 1) => {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    const idx = STATUS_ORDER.indexOf(card.status);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= STATUS_ORDER.length) return;
    const newStatus = STATUS_ORDER[newIdx];
    const res = await fetch(`/api/kanban/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      const updated = await res.json();
      setCards(prev => prev.map(c => c.id === updated.id ? updated : c));
    }
  };

  const quickAdd = async (status: Status) => {
    const title = addText.trim();
    if (!title) { setAddingCol(null); return; }
    const res = await fetch('/api/kanban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, status }),
    });
    if (res.ok) {
      const card = await res.json();
      setCards(prev => [card, ...prev]);
    }
    setAddText('');
    setAddingCol(null);
  };

  const uploadImage = async (cardId: string, files: FileList | File[]) => {
    setUploadingFor(cardId);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`/api/kanban/${cardId}/image`, { method: 'POST', body: fd });
        if (res.ok) {
          const updated = await res.json();
          setCards(prev => prev.map(c => c.id === updated.id ? updated : c));
          if (modalCard?.id === cardId) {
            setModalDraft(prev => ({ ...prev, images: updated.images }));
          }
        }
      }
    } finally {
      setUploadingFor(null);
    }
  };

  const colCards = (status: Status) => cards.filter(c => c.status === status);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs text-gray-500 hover:text-white transition-colors">← Studio</Link>
          <div className="w-px h-4 bg-gray-700" />
          <div>
            <h1 className="text-lg font-bold text-white">Kanban Board</h1>
            <p className="text-xs text-gray-600">Task tracker · LoveinTea</p>
          </div>
        </div>
        <a
          href="/api/kanban/claude-brief"
          target="_blank"
          rel="noreferrer"
          className="text-xs px-3 py-1.5 rounded-md border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors bg-gray-800/50"
        >
          Claude Brief ↗
        </a>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-500">Loading...</div>
        ) : (
          <div className="flex gap-4 min-w-max pb-4">
            {COLUMNS.map(col => {
              const colItems = colCards(col.id);
              return (
                <div key={col.id} className="flex flex-col rounded-xl border border-gray-800 bg-gray-900/50" style={{ width: 280 }}>
                  {/* Column header */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: col.dot }} />
                    <span className="text-sm font-semibold flex-1 text-white">{col.label}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-gray-800 text-gray-500">
                      {colItems.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                    {colItems.map(card => (
                      <div
                        key={card.id}
                        className="rounded-lg border border-gray-700 cursor-pointer transition-all hover:shadow-lg hover:border-gray-600 bg-gray-800/60"
                        onClick={() => openModal(card)}
                      >
                        <div className="p-3">
                          <div className="flex items-center gap-1.5 flex-wrap mb-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase" style={{ backgroundColor: TYPE_COLORS[card.type] + '22', color: TYPE_COLORS[card.type] }}>
                              {card.type}
                            </span>
                            <span className="text-xs">{PRIORITY_EMOJI[card.priority]}</span>
                          </div>
                          <p className="text-sm font-medium leading-snug mb-2 text-white">{card.title}</p>
                          {card.fileHint && (
                            <p className="text-[10px] font-mono truncate mb-2 text-gray-500">{card.fileHint}</p>
                          )}
                          {card.images.length > 0 && (
                            <p className="text-[10px] text-gray-500">📎 {card.images.length} screenshot{card.images.length > 1 ? 's' : ''}</p>
                          )}
                        </div>
                        <div className="flex items-center border-t border-gray-700 px-2 py-1.5"
                          onClick={e => e.stopPropagation()}>
                          <button
                            className="p-1 rounded text-xs text-gray-500 disabled:opacity-30 hover:text-white"
                            disabled={STATUS_ORDER.indexOf(card.status) === 0}
                            onClick={() => moveCard(card.id, -1)}
                            title="Move left"
                          >←</button>
                          <div className="flex-1" />
                          <button
                            className="p-1 rounded text-xs text-gray-500 disabled:opacity-30 hover:text-white"
                            disabled={STATUS_ORDER.indexOf(card.status) === STATUS_ORDER.length - 1}
                            onClick={() => moveCard(card.id, 1)}
                            title="Move right"
                          >→</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Quick add */}
                  <div className="p-2 border-t border-gray-800">
                    {addingCol === col.id ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          autoFocus
                          value={addText}
                          onChange={e => setAddText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); quickAdd(col.id); }
                            if (e.key === 'Escape') { setAddingCol(null); setAddText(''); }
                          }}
                          placeholder="Tiêu đề card... (Enter để lưu)"
                          rows={2}
                          className="w-full text-sm rounded-md p-2 resize-none outline-none border border-gray-700 bg-gray-800 text-white placeholder-gray-600"
                        />
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => quickAdd(col.id)}
                            className="flex-1 text-xs py-1 rounded-md font-medium text-white"
                            style={{ backgroundColor: col.color }}
                          >Thêm</button>
                          <button
                            onClick={() => { setAddingCol(null); setAddText(''); }}
                            className="px-2 text-xs py-1 rounded-md bg-gray-800 border border-gray-700 text-gray-400"
                          >Hủy</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingCol(col.id)}
                        className="w-full text-xs py-1.5 rounded-md text-left px-2 text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
                      >
                        + Thêm card
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="w-full max-w-lg rounded-xl border border-gray-700 bg-gray-900 overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 flex-shrink-0">
              <h2 className="text-sm font-semibold text-white">Edit Card</h2>
              <button onClick={closeModal} className="text-lg leading-none text-gray-500 hover:text-white">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              <div>
                <label className="text-xs font-medium mb-1 block text-gray-400">Tiêu đề</label>
                <input
                  value={modalDraft.title || ''}
                  onChange={e => setModalDraft(p => ({ ...p, title: e.target.value }))}
                  className="w-full text-sm rounded-md px-3 py-2 border border-gray-700 bg-gray-800 text-white outline-none focus:border-pink-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1 block text-gray-400">Loại</label>
                  <select
                    value={modalDraft.type || 'task'}
                    onChange={e => setModalDraft(p => ({ ...p, type: e.target.value as CardType }))}
                    className="w-full text-sm rounded-md px-3 py-2 border border-gray-700 bg-gray-800 text-white outline-none"
                  >
                    <option value="bug">Bug</option>
                    <option value="task">Task</option>
                    <option value="feature">Feature</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block text-gray-400">Ưu tiên</label>
                  <select
                    value={modalDraft.priority || 'medium'}
                    onChange={e => setModalDraft(p => ({ ...p, priority: e.target.value as Priority }))}
                    className="w-full text-sm rounded-md px-3 py-2 border border-gray-700 bg-gray-800 text-white outline-none"
                  >
                    <option value="critical">🔴 Critical</option>
                    <option value="high">🟠 High</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="low">🟢 Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block text-gray-400">File / Function</label>
                <select
                  value={modalDraft.fileHint || ''}
                  onChange={e => setModalDraft(p => ({ ...p, fileHint: e.target.value }))}
                  className="w-full text-sm rounded-md px-3 py-2 border border-gray-700 bg-gray-800 text-white outline-none"
                >
                  <option value="">— Chọn file —</option>
                  {FILE_HINTS.map(f => (
                    <option key={f.value} value={f.value}>{f.label} → {f.value}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block text-gray-400">Mô tả</label>
                <textarea
                  value={modalDraft.description || ''}
                  onChange={e => setModalDraft(p => ({ ...p, description: e.target.value }))}
                  rows={4}
                  className="w-full text-sm rounded-md px-3 py-2 border border-gray-700 bg-gray-800 text-white outline-none resize-none placeholder-gray-600"
                  placeholder="Mô tả vấn đề / yêu cầu..."
                />
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block text-gray-400">Output mong đợi</label>
                <textarea
                  value={modalDraft.goal || ''}
                  onChange={e => setModalDraft(p => ({ ...p, goal: e.target.value }))}
                  rows={3}
                  className="w-full text-sm rounded-md px-3 py-2 border border-gray-700 bg-gray-800 text-white outline-none resize-none placeholder-gray-600"
                  placeholder="Kết quả mong muốn sau khi fix..."
                />
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block text-gray-400">Screenshots</label>
                <div
                  className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors"
                  style={{
                    borderColor: dragOver ? '#f43f5e' : '#374151',
                    backgroundColor: dragOver ? 'rgba(244,63,94,0.05)' : 'rgba(31,41,55,0.5)',
                  }}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => {
                    e.preventDefault();
                    setDragOver(false);
                    if (e.dataTransfer.files.length) uploadImage(modalCard.id, e.dataTransfer.files);
                  }}
                  onClick={() => fileRef.current?.click()}
                >
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={e => e.target.files && uploadImage(modalCard.id, e.target.files)} />
                  {uploadingFor === modalCard.id ? (
                    <p className="text-xs text-gray-500">Uploading...</p>
                  ) : (
                    <p className="text-xs text-gray-500">Drag & drop hoặc click để upload</p>
                  )}
                </div>
                {(modalDraft.images || []).length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {(modalDraft.images || []).map(img => (
                      <img
                        key={img}
                        src={`/api/kanban/${modalCard.id}/image/${img}`}
                        alt={img}
                        className="rounded-md object-cover w-full h-20 border border-gray-700"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-700 flex-shrink-0">
              <button
                onClick={() => deleteCard(modalCard.id)}
                className="text-xs px-3 py-1.5 rounded-md text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
              >
                Xóa card
              </button>
              <div className="flex gap-2">
                <button onClick={closeModal} className="text-xs px-3 py-1.5 rounded-md border border-gray-700 text-gray-400">
                  Hủy
                </button>
                <button
                  onClick={saveModal}
                  disabled={saving}
                  className="text-xs px-4 py-1.5 rounded-md font-medium text-white disabled:opacity-60"
                  style={{ backgroundColor: '#f43f5e' }}
                >
                  {saving ? 'Saving...' : 'Lưu'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

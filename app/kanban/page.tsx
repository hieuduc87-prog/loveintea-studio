'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type CardType = 'bug' | 'task' | 'feature';
type Priority = 'critical' | 'high' | 'medium' | 'low';
type Status = 'todo' | 'auto_fix' | 'fixing' | 'fixed' | 'fix_failed' | 'done' | 'approved';

interface FixResult {
  summary: string;
  branch: string | null;
  changedFiles: string[];
  costUsd: number | null;
  durationMs: number | null;
  fixedAt: string | null;
}

interface KanbanCard {
  id: string;
  title: string;
  description: string;
  goal: string;
  type: CardType;
  priority: Priority;
  status: Status;
  fileHint: string;
  errorLog: string;
  fixResult: FixResult | null;
  images: string[];
  createdAt: string;
  updatedAt: string;
}

const COLUMNS: { id: Status; label: string; color: string }[] = [
  { id: 'todo',       label: 'Cần làm',       color: '#f59e0b' },
  { id: 'auto_fix',   label: '🤖 Auto Fix',   color: '#8b5cf6' },
  { id: 'fixing',     label: '⚙️ Đang fix',   color: '#ef4444' },
  { id: 'fixed',      label: '✅ Đã fix',     color: '#10b981' },
  { id: 'fix_failed', label: '❌ Fix lỗi',    color: '#ef4444' },
  { id: 'done',       label: 'Đã xong',       color: '#3b82f6' },
  { id: 'approved',   label: 'Duyệt ✓',       color: '#6b7280' },
];

const PRIORITY_EMOJI: Record<Priority, string> = {
  critical: '🔴', high: '🟠', medium: '🟡', low: '🟢',
};

const TYPE_COLORS: Record<CardType, string> = {
  bug: '#ef4444', task: '#f59e0b', feature: '#10b981',
};

export default function KanbanPage() {
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalCard, setModalCard] = useState<KanbanCard | null>(null);
  const [modalDraft, setModalDraft] = useState<Partial<KanbanCard>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [addingCol, setAddingCol] = useState<Status | null>(null);
  const [addText, setAddText] = useState('');
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [imgDragOver, setImgDragOver] = useState(false);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dropTargetCol, setDropTargetCol] = useState<Status | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/kanban');
      if (res.ok) setCards(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, [load]);

  const openModal = (card: KanbanCard) => { setModalCard(card); setModalDraft({ ...card }); setDirty(false); };
  const closeModal = () => {
    if (dirty && !confirm('Có thay đổi chưa lưu. Thoát?')) return;
    setModalCard(null); setModalDraft({}); setDirty(false);
  };

  const saveModal = async () => {
    if (!modalCard) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/kanban/${modalCard.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modalDraft),
      });
      if (res.ok) {
        const updated = await res.json();
        setCards(prev => prev.map(c => c.id === updated.id ? updated : c));
        setDirty(false); setModalCard(null); setModalDraft({});
      }
    } finally { setSaving(false); }
  };

  const deleteCard = async (id: string) => {
    if (!confirm('Xóa card này?')) return;
    await fetch(`/api/kanban/${id}`, { method: 'DELETE' });
    setCards(prev => prev.filter(c => c.id !== id));
    closeModal();
  };

  const moveCardTo = async (id: string, newStatus: Status) => {
    const card = cards.find(c => c.id === id);
    if (!card || card.status === newStatus) return;
    setCards(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
    const res = await fetch(`/api/kanban/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      const updated = await res.json();
      setCards(prev => prev.map(c => c.id === updated.id ? updated : c));
    } else {
      setCards(prev => prev.map(c => c.id === id ? { ...c, status: card.status } : c));
    }
  };

  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', cardId);
    setDraggingCardId(cardId);
  };
  const handleDragEnd = () => { setDraggingCardId(null); setDropTargetCol(null); };
  const handleColumnDragOver = (e: React.DragEvent, colId: Status) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTargetCol(colId);
  };
  const handleColumnDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDropTargetCol(null);
  };
  const handleColumnDrop = (e: React.DragEvent, colId: Status) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('text/plain');
    if (cardId) moveCardTo(cardId, colId);
    setDraggingCardId(null); setDropTargetCol(null);
  };

  const quickAdd = async (status: Status) => {
    const title = addText.trim();
    if (!title) { setAddingCol(null); return; }
    const res = await fetch('/api/kanban', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, status }),
    });
    if (res.ok) { const card = await res.json(); setCards(prev => [card, ...prev]); }
    setAddText(''); setAddingCol(null);
  };

  const uploadImage = async (cardId: string, files: FileList | File[]) => {
    setUploadingFor(cardId);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData(); fd.append('file', file);
        const res = await fetch(`/api/kanban/${cardId}/image`, { method: 'POST', body: fd });
        if (res.ok) {
          const updated = await res.json();
          setCards(prev => prev.map(c => c.id === updated.id ? updated : c));
          if (modalCard?.id === cardId) setModalDraft(prev => ({ ...prev, images: updated.images }));
        }
      }
    } finally { setUploadingFor(null); }
  };

  const colCards = (status: Status) => cards.filter(c => c.status === status);
  const fmtDur = (ms: number) => ms < 60000 ? `${Math.round(ms/1000)}s` : `${Math.round(ms/60000)}m`;

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-2)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-1)' }}>
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-1)' }}>Kanban Board</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Kéo card vào 🤖 Auto Fix để Claude tự sửa</p>
        </div>
        <a href="/api/kanban/claude-brief" target="_blank" rel="noreferrer"
          className="text-xs px-3 py-1.5 rounded-md border"
          style={{ borderColor: 'var(--border)', color: 'var(--text-2)', backgroundColor: 'var(--bg-2)' }}>
          Claude Brief ↗
        </a>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64" style={{ color: 'var(--text-3)' }}>Loading...</div>
        ) : (
          <div className="flex gap-3 min-w-max pb-4">
            {COLUMNS.map(col => {
              const items = colCards(col.id);
              const isDrop = dropTargetCol === col.id && draggingCardId;
              return (
                <div key={col.id}
                  className="flex flex-col rounded-xl border transition-all duration-150"
                  style={{
                    width: 260,
                    backgroundColor: isDrop ? 'var(--bg-2)' : 'var(--bg-1)',
                    borderColor: isDrop ? col.color : 'var(--border)',
                    boxShadow: isDrop ? `0 0 0 1px ${col.color}40` : 'none',
                  }}
                  onDragOver={e => handleColumnDragOver(e, col.id)}
                  onDragLeave={handleColumnDragLeave}
                  onDrop={e => handleColumnDrop(e, col.id)}
                >
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                    <span className="text-xs font-semibold flex-1" style={{ color: 'var(--text-1)' }}>{col.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono" style={{ backgroundColor: 'var(--bg-2)', color: 'var(--text-3)' }}>{items.length}</span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2 space-y-2" style={{ maxHeight: 'calc(100vh - 180px)' }}>
                    {items.map(card => (
                      <div key={card.id} draggable
                        onDragStart={e => handleDragStart(e, card.id)} onDragEnd={handleDragEnd}
                        className="rounded-lg border cursor-grab hover:shadow-md active:cursor-grabbing"
                        style={{ backgroundColor: 'var(--bg-2)', borderColor: 'var(--border)', opacity: draggingCardId === card.id ? 0.4 : 1 }}
                        onClick={() => openModal(card)}
                      >
                        <div className="p-2.5">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase" style={{ backgroundColor: TYPE_COLORS[card.type]+'22', color: TYPE_COLORS[card.type] }}>{card.type}</span>
                            <span className="text-[10px]">{PRIORITY_EMOJI[card.priority]}</span>
                          </div>
                          <p className="text-xs font-medium leading-snug mb-1" style={{ color: 'var(--text-1)' }}>{card.title}</p>
                          {card.fileHint && <p className="text-[10px] font-mono truncate mb-1" style={{ color: 'var(--text-3)' }}>{card.fileHint}</p>}
                          {card.images?.length > 0 && <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>📎 {card.images.length} ảnh</p>}
                          {card.fixResult && (
                            <div className="mt-1.5 pt-1.5 border-t flex items-center gap-1.5 flex-wrap" style={{ borderColor: 'var(--border)' }}>
                              {card.fixResult.branch && <span className="text-[9px] px-1 py-0.5 rounded font-mono" style={{ backgroundColor: '#10b98122', color: '#10b981' }}>{card.fixResult.branch}</span>}
                              {card.fixResult.changedFiles?.length > 0 && <span className="text-[9px]" style={{ color: 'var(--text-3)' }}>{card.fixResult.changedFiles.length} file</span>}
                              {card.fixResult.costUsd != null && <span className="text-[9px]" style={{ color: 'var(--text-3)' }}>${card.fixResult.costUsd.toFixed(3)}</span>}
                              {card.fixResult.durationMs != null && <span className="text-[9px]" style={{ color: 'var(--text-3)' }}>{fmtDur(card.fixResult.durationMs)}</span>}
                            </div>
                          )}
                          {card.status === 'fixing' && (
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#ef4444', borderTopColor: 'transparent' }} />
                              <span className="text-[10px]" style={{ color: '#ef4444' }}>Claude đang fix...</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {(col.id === 'todo' || col.id === 'auto_fix') && (
                    <div className="p-2 border-t" style={{ borderColor: 'var(--border)' }}>
                      {addingCol === col.id ? (
                        <div className="flex flex-col gap-2">
                          <textarea autoFocus value={addText} onChange={e => setAddText(e.target.value)}
                            onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); quickAdd(col.id); } if (e.key==='Escape') { setAddingCol(null); setAddText(''); } }}
                            placeholder="Tiêu đề... (Enter để lưu)" rows={2}
                            className="w-full text-xs rounded-md p-2 resize-none outline-none border"
                            style={{ backgroundColor: 'var(--bg-2)', borderColor: 'var(--border)', color: 'var(--text-1)' }} />
                          <div className="flex gap-1.5">
                            <button onClick={() => quickAdd(col.id)} className="flex-1 text-xs py-1 rounded-md font-medium" style={{ backgroundColor: col.color, color: '#fff' }}>Thêm</button>
                            <button onClick={() => { setAddingCol(null); setAddText(''); }} className="px-2 text-xs py-1 rounded-md" style={{ backgroundColor: 'var(--bg-2)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>Hủy</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setAddingCol(col.id)} className="w-full text-xs py-1.5 rounded-md text-left px-2" style={{ color: 'var(--text-3)' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-2)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                          + Thêm card
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="w-full max-w-lg rounded-xl border overflow-hidden flex flex-col" style={{ backgroundColor: 'var(--bg-1)', borderColor: 'var(--border)', maxHeight: '90vh' }}>
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Edit Card</h2>
                {modalDraft.status === 'fixing' && <span className="text-[10px] px-2 py-0.5 rounded-full animate-pulse" style={{ backgroundColor: '#ef444422', color: '#ef4444' }}>⚙️ Đang fix</span>}
              </div>
              <button onClick={closeModal} className="text-lg hover:opacity-70" style={{ color: 'var(--text-3)' }}>✕</button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-2)' }}>Tiêu đề</label>
                <input value={modalDraft.title || ''} onChange={e => { setModalDraft(p => ({ ...p, title: e.target.value })); setDirty(true); }}
                  className="w-full text-sm rounded-md px-3 py-2 border outline-none" style={{ backgroundColor: 'var(--bg-2)', borderColor: 'var(--border)', color: 'var(--text-1)' }} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-2)' }}>Loại</label>
                  <select value={modalDraft.type || 'task'} onChange={e => { setModalDraft(p => ({ ...p, type: e.target.value as CardType })); setDirty(true); }}
                    className="w-full text-xs rounded-md px-2 py-2 border outline-none" style={{ backgroundColor: 'var(--bg-2)', borderColor: 'var(--border)', color: 'var(--text-1)' }}>
                    <option value="bug">Bug</option><option value="task">Task</option><option value="feature">Feature</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-2)' }}>Ưu tiên</label>
                  <select value={modalDraft.priority || 'medium'} onChange={e => { setModalDraft(p => ({ ...p, priority: e.target.value as Priority })); setDirty(true); }}
                    className="w-full text-xs rounded-md px-2 py-2 border outline-none" style={{ backgroundColor: 'var(--bg-2)', borderColor: 'var(--border)', color: 'var(--text-1)' }}>
                    <option value="critical">🔴 Critical</option><option value="high">🟠 High</option><option value="medium">🟡 Medium</option><option value="low">🟢 Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-2)' }}>File / Function <span className="font-normal" style={{ color: 'var(--text-3)' }}>(gợi ý cho Claude)</span></label>
                <input value={modalDraft.fileHint || ''} onChange={e => { setModalDraft(p => ({ ...p, fileHint: e.target.value })); setDirty(true); }}
                  className="w-full text-xs font-mono rounded-md px-3 py-2 border outline-none" style={{ backgroundColor: 'var(--bg-2)', borderColor: 'var(--border)', color: 'var(--text-1)' }}
                  placeholder="src/app/page.tsx hoặc function handleSubmit" />
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-2)' }}>Log lỗi / Chi tiết <span className="font-normal" style={{ color: 'var(--text-3)' }}>(paste log, stacktrace...)</span></label>
                <textarea value={modalDraft.errorLog || ''} onChange={e => { setModalDraft(p => ({ ...p, errorLog: e.target.value })); setDirty(true); }}
                  rows={5} className="w-full text-xs font-mono rounded-md px-3 py-2 border outline-none resize-none"
                  style={{ backgroundColor: 'var(--bg-2)', borderColor: 'var(--border)', color: 'var(--text-1)' }}
                  placeholder="Paste log, stacktrace, hoặc mô tả chi tiết..." />
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-2)' }}>Mô tả thêm</label>
                <textarea value={modalDraft.description || ''} onChange={e => { setModalDraft(p => ({ ...p, description: e.target.value })); setDirty(true); }}
                  rows={3} className="w-full text-xs rounded-md px-3 py-2 border outline-none resize-none"
                  style={{ backgroundColor: 'var(--bg-2)', borderColor: 'var(--border)', color: 'var(--text-1)' }} placeholder="Mô tả vấn đề / yêu cầu..." />
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-2)' }}>Output mong đợi</label>
                <textarea value={modalDraft.goal || ''} onChange={e => { setModalDraft(p => ({ ...p, goal: e.target.value })); setDirty(true); }}
                  rows={2} className="w-full text-xs rounded-md px-3 py-2 border outline-none resize-none"
                  style={{ backgroundColor: 'var(--bg-2)', borderColor: 'var(--border)', color: 'var(--text-1)' }} placeholder="Kết quả mong muốn..." />
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-2)' }}>Screenshots</label>
                <div className="border-2 border-dashed rounded-lg p-3 text-center cursor-pointer"
                  style={{ borderColor: imgDragOver ? '#f59e0b' : 'var(--border)', backgroundColor: imgDragOver ? 'rgba(245,158,11,0.05)' : 'var(--bg-2)' }}
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); setImgDragOver(true); }}
                  onDragLeave={() => setImgDragOver(false)}
                  onDrop={e => { e.preventDefault(); e.stopPropagation(); setImgDragOver(false); if (e.dataTransfer.files.length) uploadImage(modalCard.id, e.dataTransfer.files); }}
                  onClick={() => fileRef.current?.click()}>
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => e.target.files && uploadImage(modalCard.id, e.target.files)} />
                  <p className="text-xs" style={{ color: 'var(--text-3)' }}>{uploadingFor === modalCard.id ? 'Uploading...' : 'Drag & drop hoặc click'}</p>
                </div>
                {(modalDraft.images || []).length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {(modalDraft.images || []).map(img => (
                      <img key={img} src={`/api/kanban/${modalCard.id}/image/${img}`} alt="" className="rounded-md object-cover w-full h-20" style={{ border: '1px solid var(--border)' }} />
                    ))}
                  </div>
                )}
              </div>

              {modalDraft.fixResult && (
                <div className="rounded-lg border p-3" style={{ borderColor: '#10b98144', backgroundColor: '#10b98108' }}>
                  <label className="text-xs font-semibold mb-2 block" style={{ color: '#10b981' }}>🤖 Kết quả Auto Fix</label>
                  {modalDraft.fixResult.branch && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ backgroundColor: '#10b98122', color: '#10b981' }}>{modalDraft.fixResult.branch}</span>
                      {modalDraft.fixResult.costUsd != null && <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>Cost: ${modalDraft.fixResult.costUsd.toFixed(3)}</span>}
                      {modalDraft.fixResult.durationMs != null && <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{fmtDur(modalDraft.fixResult.durationMs)}</span>}
                    </div>
                  )}
                  {modalDraft.fixResult.changedFiles?.length > 0 && (
                    <div className="mb-2">
                      <span className="text-[10px] font-medium" style={{ color: 'var(--text-2)' }}>Files:</span>
                      {modalDraft.fixResult.changedFiles.map((f: string) => <p key={f} className="text-[10px] font-mono" style={{ color: 'var(--text-3)' }}>• {f}</p>)}
                    </div>
                  )}
                  {modalDraft.fixResult.summary && (
                    <div className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-2)' }}>
                      {modalDraft.fixResult.summary.slice(0, 1000)}{modalDraft.fixResult.summary.length > 1000 ? '...' : ''}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => deleteCard(modalCard.id)} className="text-xs px-3 py-1.5 rounded-md" style={{ color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)' }}>Xóa</button>
              <div className="flex gap-2">
                <button onClick={closeModal} className="text-xs px-3 py-1.5 rounded-md border" style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}>Hủy</button>
                <button onClick={saveModal} disabled={saving} className="text-xs px-4 py-1.5 rounded-md font-medium disabled:opacity-60"
                  style={{ backgroundColor: dirty ? '#f59e0b' : '#374151', color: '#fff' }}>
                  {saving ? 'Saving...' : dirty ? 'Lưu thay đổi' : 'Đã lưu ✓'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

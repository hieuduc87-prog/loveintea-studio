'use client';

/**
 * Plan & Calendar — unified planning workspace.
 * Left: plan list (upload .xlsx, select, delete). Right: Calendar grid OR Plan table.
 * Features: drift warnings, approve tick/all, Run-all / Run-step (caption + optional
 * image + schedule), insert by clicking a day or claiming a draft, published posts locked.
 */

import { useRef, useState, useEffect, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────
interface Plan {
  id: string; title: string; created_at: string;
  item_count: number; post_count: number; scheduled_count: number; published_count: number;
}
interface PlanItem {
  id: string; date: string; day_of_week: string; wave: string; surface: string;
  purpose: string; pillar: string; product_id: string | null; usp_code: string;
  hook: string; copy_direction: string; visual_direction: string;
}
interface Post {
  id: string; sku_id: string; caption: string; status: string; platforms: string;
  scheduled_at?: string; published_at?: string; plan_id?: string; plan_item_id?: string;
  review_status?: string; image_url?: string;
}
interface PlanDetail { plan: Plan; items: PlanItem[]; posts: Post[]; stats: { total: number; draft: number; scheduled: number; published: number } }
interface Product { id: string; name: string; color?: string }

const MONTH_IDX: Record<string, number> = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
const STATUS_BORDER: Record<string, string> = { published:'border-l-green-500', scheduled:'border-l-yellow-500', draft:'border-l-gray-600', failed:'border-l-red-500' };
const STATUS_BADGE: Record<string, string> = { published:'bg-green-900/40 text-green-400', scheduled:'bg-yellow-900/40 text-yellow-400', draft:'bg-gray-800 text-gray-400', failed:'bg-red-900/40 text-red-400' };

function parsePlanDate(s: string, year: number): Date | null {
  const m = (s || '').trim().match(/^(\w{3})\s+(\d{1,2})$/);
  if (m && MONTH_IDX[m[1]] !== undefined) return new Date(year, MONTH_IDX[m[1]], parseInt(m[2]), 9, 0, 0);
  const d = new Date(s); return isNaN(d.getTime()) ? null : d;
}
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const firstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

export function PlanCalendarView({ brandId }: { brandId?: string } = {}) {
  const bid = brandId || 'loveintea';
  const fileRef = useRef<HTMLInputElement>(null);
  const now = new Date();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<'calendar' | 'table'>('calendar');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');

  // run options
  const [withImage, setWithImage] = useState(true);
  const [autoSchedule, setAutoSchedule] = useState(true);
  const [useTemplate, setUseTemplate] = useState(true);
  const [running, setRunning] = useState(false);
  const [runProgress, setRunProgress] = useState('');

  // selection (table)
  const [sel, setSel] = useState<Set<string>>(new Set());

  // calendar drag + compose
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const [composeDay, setComposeDay] = useState<Date | null>(null);
  const [composeProduct, setComposeProduct] = useState('');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [postTags, setPostTags] = useState<Array<{ dimension: string; value: string; label?: string; source?: string }>>([]);
  const [newTagDim, setNewTagDim] = useState('segment');
  const [newTagVal, setNewTagVal] = useState('');
  const [capDraft, setCapDraft] = useState('');
  const [savingCap, setSavingCap] = useState(false);

  useEffect(() => {
    if (!selectedPost) { setPostTags([]); setCapDraft(''); return; }
    setCapDraft(selectedPost.caption || '');
    fetch(`/api/posts/${selectedPost.id}/tags`).then(r => r.json()).then(d => setPostTags(d.tags ?? [])).catch(() => setPostTags([]));
  }, [selectedPost]);

  async function saveCaption() {
    if (!selectedPost) return;
    setSavingCap(true);
    try {
      const r = await fetch(`/api/posts/${selectedPost.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: capDraft }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); setMsg(`⚠ Lưu caption lỗi: ${e.error || r.status}`); return; }
      setAllPosts(prev => prev.map(p => p.id === selectedPost.id ? { ...p, caption: capDraft } : p));
      setSelectedPost(prev => prev ? { ...prev, caption: capDraft } : prev);
      setMsg('✓ Đã lưu caption');
    } catch { setMsg('⚠ Lưu caption thất bại'); }
    finally { setSavingCap(false); }
  }

  async function saveTags(next: Array<{ dimension: string; value: string; label?: string }>) {
    if (!selectedPost) return;
    // keep auto tags, replace manual set
    const manual = next.filter(t => true).map(t => ({ dimension: t.dimension, value: t.value, label: t.label }));
    const r = await fetch(`/api/posts/${selectedPost.id}/tags`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tags: manual }),
    });
    const d = await r.json() as { tags?: typeof postTags };
    setPostTags(d.tags ?? []);
  }
  function addTag() {
    if (!newTagVal.trim()) return;
    const manualNow = postTags.filter(t => t.source === 'manual').map(t => ({ dimension: t.dimension, value: t.value, label: t.label }));
    saveTags([...manualNow, { dimension: newTagDim, value: newTagVal.trim() }]);
    setNewTagVal('');
  }
  function removeTag(dim: string, val: string) {
    const manualNow = postTags.filter(t => t.source === 'manual' && !(t.dimension === dim && t.value === val))
      .map(t => ({ dimension: t.dimension, value: t.value, label: t.label }));
    saveTags(manualNow);
  }

  const DIM_LABEL: Record<string, string> = { segment: 'Segment', insight: 'Insight', behavior: 'Hành vi', usp: 'USP', rtb: 'RTB', narrative: 'Narrative', context: 'Context', product: 'Sản phẩm', template: 'Template', format: 'Format', pillar: 'Pillar', purpose: 'Mục đích', custom: 'Khác' };
  const DIM_COLOR: Record<string, string> = { segment: 'bg-sky-900/40 text-sky-300', insight: 'bg-amber-900/40 text-amber-300', behavior: 'bg-purple-900/40 text-purple-300', usp: 'bg-emerald-900/40 text-emerald-300', product: 'bg-brand-900/40 text-brand-300', template: 'bg-pink-900/40 text-pink-300', format: 'bg-gray-800 text-gray-300' };

  // ── Loaders ──
  const loadPlans = useCallback(async () => {
    const r = await fetch(`/api/plans?brand=${bid}`);
    const d = await r.json() as { plans: Plan[] };
    setPlans(d.plans ?? []);
    return d.plans ?? [];
  }, [bid]);

  const loadDetail = useCallback(async (planId: string) => {
    if (!planId) { setDetail(null); return; }
    const r = await fetch(`/api/plans/${planId}`);
    setDetail(await r.json() as PlanDetail);
  }, []);

  const loadPosts = useCallback(async () => {
    const r = await fetch(`/api/posts?brand=${bid}`);
    setAllPosts(((await r.json()).posts ?? []) as Post[]);
  }, [bid]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [ps] = await Promise.all([loadPlans(), loadPosts()]);
    const prodR = await fetch(`/api/products?brand=${bid}`).catch(() => null);
    if (prodR?.ok) setProducts(((await prodR.json()).products ?? []) as Product[]);
    setSelectedPlanId(prev => prev || (ps[0]?.id ?? ''));
    setLoading(false);
  }, [loadPlans, loadPosts, bid]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { loadDetail(selectedPlanId); }, [selectedPlanId, loadDetail]);

  async function refresh() { await Promise.all([loadPlans(), loadPosts(), loadDetail(selectedPlanId)]); }

  // ── Upload plan ──
  async function handleUpload(file: File) {
    if (!file.name.match(/\.xlsx?$/i)) { setMsg('✗ Chỉ nhận file .xlsx'); return; }
    setUploading(true); setMsg('');
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch('/api/import-plan', { method: 'POST', body: fd });
      const d = await r.json() as { ok?: boolean; planId?: string; error?: string };
      if (d.error) setMsg('✗ ' + d.error);
      else { await loadPlans(); if (d.planId) setSelectedPlanId(d.planId); setMsg('✓ Đã nhập plan'); }
    } catch (e) { setMsg('✗ ' + String(e)); }
    setUploading(false);
  }
  async function deletePlan(id: string) {
    if (!confirm('Xóa plan này? (post đã tạo sẽ được gỡ liên kết, không bị xóa)')) return;
    await fetch(`/api/plans/${id}`, { method: 'DELETE' });
    if (selectedPlanId === id) setSelectedPlanId('');
    await refresh();
  }

  // ── Drift computation ──
  const itemPost = useCallback((itemId: string) => detail?.posts.find(p => p.plan_item_id === itemId), [detail]);
  const drift = (() => {
    if (!detail) return { overdue: [] as PlanItem[], mismatch: [] as PlanItem[], unapproved: [] as Post[] };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const overdue: PlanItem[] = [], mismatch: PlanItem[] = [];
    for (const it of detail.items) {
      const post = itemPost(it.id);
      const planned = parsePlanDate(it.date, year);
      if (!post) { if (planned && planned < today) overdue.push(it); continue; }
      if (post.status !== 'published' && planned && post.scheduled_at) {
        const sched = new Date(post.scheduled_at);
        if (!sameDay(sched, planned)) mismatch.push(it);
      }
    }
    const unapproved = detail.posts.filter(p => p.status !== 'published' && p.review_status !== 'approved');
    return { overdue, mismatch, unapproved };
  })();

  // ── Run generation (chạy NỀN — gửi 1 lần, poll Job Queue tới khi xong; tránh Cloudflare 524 với carousel/ảnh) ──
  async function runItems(itemIds: string[]) {
    if (!selectedPlanId || !itemIds.length) return;
    setRunning(true); setMsg(''); setRunProgress('0%');
    try {
      const r = await fetch(`/api/plans/${selectedPlanId}/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds, withImage, schedule: autoSchedule, useTemplate }),
      });
      const d = await r.json() as { ok?: boolean; jobId?: string; error?: string };
      if (!d.ok || !d.jobId) { setMsg('✗ ' + (d.error ?? 'Lỗi tạo bài')); setRunning(false); setRunProgress(''); return; }
      // poll job tới done/failed (carousel nhiều ảnh có thể vài phút)
      for (let i = 0; i < 200; i++) {
        await new Promise(res => setTimeout(res, 3000));
        const jr = await fetch('/api/jobs?limit=120').then(x => x.json()).catch(() => null);
        const job = (jr?.jobs ?? []).find((j: { id: string }) => j.id === d.jobId) as { status: string; progress: number; result_json?: string; error?: string } | undefined;
        if (!job) { setRunProgress('…'); continue; }
        setRunProgress(`${job.progress || 0}%`);
        await loadDetail(selectedPlanId);
        if (job.status === 'failed') { setMsg('✗ ' + (job.error ?? 'Lỗi tạo bài')); break; }
        if (job.status === 'done') {
          let res: { created?: number; skipped?: number; errors?: number } = {};
          try { res = JSON.parse(job.result_json || '{}'); } catch { /* */ }
          setMsg(`✓ Tạo ${res.created ?? 0} bài${res.skipped ? `, bỏ qua ${res.skipped}` : ''}${res.errors ? `, ${res.errors} lỗi` : ''}`);
          break;
        }
      }
    } catch (e) { setMsg('✗ ' + String(e)); }
    await loadPosts(); await loadDetail(selectedPlanId);
    setRunning(false); setRunProgress('');
    setSel(new Set());
  }
  const ungeneratedItems = () => (detail?.items ?? []).filter(it => !itemPost(it.id)).map(it => it.id);

  // ── Approve ──
  async function bulkAction(ids: string[], action: string, extra: Record<string, unknown> = {}) {
    if (!ids.length) return;
    const r = await fetch('/api/posts/bulk', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, action, ...extra }),
    });
    const d = await r.json() as { changed?: number; locked?: string[] };
    if (d.locked?.length) setMsg(`⚠ ${d.locked.length} bài đã đăng — bị khóa, không đổi`);
    await refresh();
    return d;
  }
  const approveAll = () => bulkAction(detail?.posts.filter(p => p.review_status !== 'approved').map(p => p.id) ?? [], 'approve');

  // ── Calendar: drop / compose ──
  async function dropOnDay(d: Date) {
    if (!dragId) return;
    const post = allPosts.find(p => p.id === dragId);
    if (post?.status === 'published') { setMsg('⚠ Bài đã đăng — không đổi lịch'); setDragId(null); return; }
    await fetch(`/api/posts/${dragId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduled_at: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0, 0).toISOString(), status: 'scheduled' }),
    });
    setDragId(null); setDropKey(null);
    await loadPosts();
  }
  async function createOnDay() {
    if (!composeDay) return;
    await fetch('/api/posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandId: bid, skuId: composeProduct, planId: selectedPlanId || undefined,
        platforms: 'facebook,instagram', status: 'scheduled',
        scheduledAt: new Date(composeDay.getFullYear(), composeDay.getMonth(), composeDay.getDate(), 9, 0, 0).toISOString(),
      }),
    });
    // POST route ignores scheduledAt/status — patch right after to set them
    const list = await fetch(`/api/posts?brand=${bid}`).then(r => r.json()) as { posts: Post[] };
    const newest = list.posts.find(p => p.sku_id === composeProduct && !p.scheduled_at && p.status === 'draft');
    if (newest) {
      await fetch(`/api/posts/${newest.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_at: new Date(composeDay.getFullYear(), composeDay.getMonth(), composeDay.getDate(), 9, 0, 0).toISOString(), status: 'scheduled' }),
      });
    }
    setComposeDay(null); setComposeProduct('');
    await loadPosts();
    setMsg('✓ Đã thêm bài vào lịch (sang Review & Queue để soạn nội dung)');
  }

  // ── Calendar grid data ──
  const dim = daysInMonth(year, month);
  const fdow = firstDayOfMonth(year, month);
  const today = new Date();
  const calPosts = allPosts.filter(p => (selectedPlanId ? p.plan_id === selectedPlanId || !p.plan_id : true));
  const dayPosts: Record<number, Post[]> = {};
  for (const p of calPosts) {
    const ds = p.scheduled_at ?? p.published_at; if (!ds) continue;
    const d = new Date(ds);
    if (d.getFullYear() === year && d.getMonth() === month) (dayPosts[d.getDate() as number] ||= []).push(p);
  }
  const dayItems: Record<number, PlanItem[]> = {};
  for (const it of detail?.items ?? []) {
    const d = parsePlanDate(it.date, year); if (!d || d.getMonth() !== month || d.getFullYear() !== year) continue;
    (dayItems[d.getDate() as number] ||= []).push(it);
  }
  const unscheduled = calPosts.filter(p => p.status === 'draft' && !p.scheduled_at);
  const monthLabel = new Date(year, month).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
  const prevMonth = () => month === 0 ? (setYear(y => y - 1), setMonth(11)) : setMonth(m => m - 1);
  const nextMonth = () => month === 11 ? (setYear(y => y + 1), setMonth(0)) : setMonth(m => m + 1);

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
        <h2 className="text-lg font-semibold text-white mr-1">Plan & Lịch</h2>
        <select value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white max-w-[220px]">
          <option value="">— Tất cả bài (không lọc plan) —</option>
          {plans.map(p => <option key={p.id} value={p.id}>{p.title} ({p.post_count}/{p.item_count})</option>)}
        </select>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs disabled:opacity-50">
          {uploading ? '⟳ Đang nhập…' : '📥 Upload .xlsx'}
        </button>
        {selectedPlanId && (
          <button onClick={() => deletePlan(selectedPlanId)} className="px-2 py-1.5 rounded-lg bg-gray-800 hover:bg-red-900/40 text-gray-500 hover:text-red-300 text-xs">Xóa plan</button>
        )}

        <div className="ml-auto flex items-center gap-1 bg-gray-800 rounded-lg p-0.5">
          {(['calendar', 'table'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${view === v ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              {v === 'calendar' ? '🗓️ Lịch' : '📋 Bảng plan'}
            </button>
          ))}
        </div>
        {view === 'calendar' && (
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 text-white">‹</button>
            <span className="text-xs text-gray-300 w-28 text-center capitalize">{monthLabel}</span>
            <button onClick={nextMonth} className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 text-white">›</button>
            <button onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }} className="px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-[10px]">Hôm nay</button>
          </div>
        )}
        <button onClick={refresh} className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs">↻</button>
      </div>

      {msg && <p className={`text-xs flex-shrink-0 ${msg.startsWith('✓') ? 'text-emerald-400' : msg.startsWith('⚠') ? 'text-amber-400' : 'text-red-400'}`}>{msg}</p>}

      {/* Drift + run bar (when a plan is selected) */}
      {selectedPlanId && detail && (
        <div className="flex items-center gap-2 flex-wrap bg-gray-900/60 border border-gray-800 rounded-xl px-3 py-2 flex-shrink-0">
          {/* Drift warnings */}
          {drift.overdue.length === 0 && drift.mismatch.length === 0 && drift.unapproved.length === 0 ? (
            <span className="text-[11px] text-emerald-400">✓ Plan khớp lịch, không lệch</span>
          ) : (
            <div className="flex items-center gap-2 flex-wrap text-[11px]">
              {drift.overdue.length > 0 && <span className="px-2 py-0.5 rounded-full bg-red-900/40 text-red-300">⚠ {drift.overdue.length} item quá hạn chưa tạo</span>}
              {drift.mismatch.length > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-300">↹ {drift.mismatch.length} bài lệch ngày plan</span>}
              {drift.unapproved.length > 0 && <span className="px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">⏳ {drift.unapproved.length} bài chờ duyệt</span>}
            </div>
          )}
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1 text-[11px] text-gray-400"><input type="checkbox" checked={withImage} onChange={e => setWithImage(e.target.checked)} className="accent-brand-500" /> tạo ảnh</label>
            <label className="flex items-center gap-1 text-[11px] text-gray-400"><input type="checkbox" checked={autoSchedule} onChange={e => setAutoSchedule(e.target.checked)} className="accent-brand-500" /> lên lịch theo plan</label>
            <label className="flex items-center gap-1 text-[11px] text-gray-400" title="Tự chọn template theo cơ chế rotate + ưu tiên template win cao"><input type="checkbox" checked={useTemplate} onChange={e => setUseTemplate(e.target.checked)} className="accent-brand-500" /> dùng template (rotate)</label>
            <button onClick={() => runItems(ungeneratedItems())} disabled={running || ungeneratedItems().length === 0}
              className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-xs font-bold">
              {running ? `⟳ Đang chạy ${runProgress}` : `▶ Run All (${ungeneratedItems().length})`}
            </button>
            <button onClick={approveAll} disabled={running || drift.unapproved.length === 0}
              className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-200 text-xs font-semibold">✓ Duyệt tất cả</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">Đang tải…</div>
      ) : view === 'calendar' ? (
        /* ════ CALENDAR ════ */
        <div className="flex gap-3 flex-1 min-h-0">
          <div className="flex-1 overflow-auto">
            <div className="grid grid-cols-7 mb-1">
              {['CN','T2','T3','T4','T5','T6','T7'].map(d => <div key={d} className="text-center text-[10px] font-semibold text-gray-600 py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: fdow }).map((_, i) => <div key={`e${i}`} className="min-h-[92px]" />)}
              {Array.from({ length: dim }, (_, i) => i + 1).map(day => {
                const dDate = new Date(year, month, day);
                const dps = dayPosts[day] ?? []; const dis = dayItems[day] ?? [];
                const isToday = sameDay(today, dDate);
                const isDrop = dropKey === `${year}-${month}-${day}`;
                return (
                  <div key={day}
                    onDragOver={e => { e.preventDefault(); setDropKey(`${year}-${month}-${day}`); }}
                    onDragLeave={() => setDropKey(null)}
                    onDrop={e => { e.preventDefault(); dropOnDay(dDate); }}
                    onClick={() => { setComposeDay(dDate); setSelectedPost(null); }}
                    className={`min-h-[92px] rounded-lg border p-1 cursor-pointer transition-colors ${
                      isToday ? 'border-brand-500 bg-brand-600/10' : isDrop ? 'border-yellow-500 bg-yellow-900/20' : 'border-gray-800 bg-gray-900/30 hover:border-gray-700'}`}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-[10px] font-semibold ${isToday ? 'text-brand-400' : 'text-gray-500'}`}>{day}</span>
                      {(dps.length + dis.length) > 0 && <span className="text-[8px] text-gray-600 bg-gray-800 rounded px-1">{dps.length + dis.length}</span>}
                    </div>
                    <div className="space-y-0.5">
                      {dis.filter(it => !itemPost(it.id)).slice(0, 2).map(it => (
                        <div key={it.id} className="border-l-2 border-l-brand-500/50 pl-1 py-0.5 rounded-sm bg-brand-950/30">
                          <p className="text-[8px] text-brand-300/70 truncate">○ {it.surface?.split('·')[0]?.trim()}</p>
                          <p className="text-[8px] text-gray-600 truncate">{it.hook?.slice(0, 26)}</p>
                        </div>
                      ))}
                      {dps.slice(0, 3).map(p => {
                        const locked = p.status === 'published';
                        return (
                          <div key={p.id} draggable={!locked}
                            onDragStart={() => !locked && setDragId(p.id)} onDragEnd={() => { setDragId(null); setDropKey(null); }}
                            onClick={e => { e.stopPropagation(); setSelectedPost(p); setComposeDay(null); }}
                            className={`border-l-2 pl-1 py-0.5 rounded-sm text-left bg-gray-900 hover:bg-gray-800 ${STATUS_BORDER[p.status] ?? 'border-l-gray-600'} ${locked ? 'cursor-default opacity-90' : 'cursor-grab active:cursor-grabbing'}`}>
                            <div className="flex items-center gap-0.5">
                              {locked && <span className="text-[8px]">🔒</span>}
                              {p.review_status === 'approved' && <span className="text-[8px] text-emerald-400">✓</span>}
                              <span className="text-[8px] text-gray-300 truncate">{(p.caption || p.sku_id || 'bài').slice(0, 22)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-60 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
            {composeDay ? (
              <div className="bg-gray-900 border border-brand-600/30 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-brand-400 uppercase">+ Thêm bài {composeDay.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</span>
                  <button onClick={() => setComposeDay(null)} className="text-gray-500 hover:text-white text-sm">✕</button>
                </div>
                <select value={composeProduct} onChange={e => setComposeProduct(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white">
                  <option value="">— Chọn sản phẩm —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button onClick={createOnDay} className="w-full py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold">Tạo & xếp lịch</button>
                <p className="text-[10px] text-gray-600">Tạo bài nháp đã xếp lịch — soạn caption/ảnh ở Review & Queue hoặc Content Workshop.</p>
              </div>
            ) : selectedPost ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[selectedPost.status]}`}>{selectedPost.status}</span>
                  <button onClick={() => setSelectedPost(null)} className="text-gray-500 hover:text-white text-sm">✕</button>
                </div>
                {selectedPost.image_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={selectedPost.image_url} alt="" className="w-full rounded-lg" />}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[9px] font-bold text-gray-500 uppercase">Caption</p>
                    {capDraft !== (selectedPost.caption || '') && (
                      <button onClick={saveCaption} disabled={savingCap}
                        className="text-[10px] px-2 py-0.5 rounded bg-brand-600 hover:bg-brand-500 text-white font-bold disabled:opacity-50">
                        {savingCap ? 'Đang lưu…' : '💾 Lưu'}
                      </button>
                    )}
                  </div>
                  <textarea value={capDraft} onChange={e => setCapDraft(e.target.value)}
                    rows={5} placeholder="(chưa có caption — gõ để soạn)"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-200 resize-y focus:border-brand-500 focus:outline-none" />
                </div>
                {selectedPost.scheduled_at && <p className="text-[10px] text-gray-500">🗓 {new Date(selectedPost.scheduled_at).toLocaleString('vi-VN')}</p>}
                {/* Multi-tags (auto + manual) — for win-rate aggregation */}
                <div className="border-t border-gray-800 pt-2">
                  <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Tags (segment / insight / hành vi…)</p>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {postTags.length === 0 && <span className="text-[10px] text-gray-600">chưa có tag</span>}
                    {postTags.map((t, i) => (
                      <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-1 ${DIM_COLOR[t.dimension] ?? 'bg-gray-800 text-gray-400'}`}>
                        <span className="opacity-70">{DIM_LABEL[t.dimension] ?? t.dimension}:</span>{(t.label || t.value).slice(0, 24)}
                        {t.source === 'manual' && <button onClick={() => removeTag(t.dimension, t.value)} className="hover:text-red-300">✕</button>}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <select value={newTagDim} onChange={e => setNewTagDim(e.target.value)} className="bg-gray-800 border border-gray-700 rounded px-1 py-1 text-[10px] text-white">
                      {['segment','insight','behavior','usp','format','pillar','custom'].map(d => <option key={d} value={d}>{DIM_LABEL[d]}</option>)}
                    </select>
                    <input value={newTagVal} onChange={e => setNewTagVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} placeholder="giá trị tag" className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded px-1.5 py-1 text-[10px] text-white" />
                    <button onClick={addTag} className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-[10px] text-gray-200">+</button>
                  </div>
                </div>
                {selectedPost.status === 'published'
                  ? <p className="text-[10px] text-green-500">🔒 Đã đăng — khóa lịch</p>
                  : <p className="text-[10px] text-gray-600">Kéo thả trên lịch để đổi ngày</p>}
                {selectedPost.status !== 'published' && (
                  <button onClick={() => bulkAction([selectedPost.id], selectedPost.review_status === 'approved' ? 'reject' : 'approve')}
                    className="w-full py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-200">
                    {selectedPost.review_status === 'approved' ? '↩ Bỏ duyệt' : '✓ Duyệt bài'}
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
                <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">Nháp chưa xếp lịch ({unscheduled.length})</p>
                {unscheduled.length === 0 ? <p className="text-xs text-gray-600">Tất cả đã xếp ✓</p> : (
                  <div className="space-y-1">
                    {unscheduled.slice(0, 12).map(p => (
                      <div key={p.id} draggable onDragStart={() => setDragId(p.id)} onDragEnd={() => { setDragId(null); setDropKey(null); }}
                        className="flex items-center gap-1.5 p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 cursor-grab">
                        <span className="text-[8px]">⠿</span>
                        <span className="text-[11px] text-gray-300 truncate">{(p.caption || p.sku_id || 'bài nháp').slice(0, 24)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-gray-600 mt-2">Kéo vào ngày để xếp lịch, hoặc bấm 1 ngày trống để thêm bài mới.</p>
              </div>
            )}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-1">
              <p className="text-[10px] font-bold text-gray-500 uppercase">Chú thích</p>
              {[['bg-brand-500/60','○ Plan item (chưa tạo bài)'],['bg-gray-600','Nháp'],['bg-yellow-500','Đã lên lịch'],['bg-green-500','Đã đăng 🔒']].map(([c,l]) => (
                <div key={l} className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${c}`} /><span className="text-[10px] text-gray-500">{l}</span></div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ════ TABLE ════ */
        <div className="flex-1 overflow-auto">
          {!detail ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">Chọn 1 plan để quản lý từng bài, hoặc upload .xlsx.</div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <button onClick={() => setSel(s => s.size === detail.items.length ? new Set() : new Set(detail.items.map(i => i.id)))}
                  className="px-2.5 py-1 rounded-lg bg-gray-800 text-gray-300 text-[11px]">{sel.size === detail.items.length ? '☐ Bỏ chọn' : '☑ Chọn tất cả'}</button>
                {sel.size > 0 && (
                  <>
                    <span className="text-[11px] text-gray-500">{sel.size} chọn</span>
                    <button onClick={() => runItems([...sel].filter(id => !itemPost(id)))} disabled={running}
                      className="px-2.5 py-1 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[11px] font-semibold">▶ Run đã chọn</button>
                    <button onClick={() => bulkAction([...sel].map(id => itemPost(id)?.id).filter(Boolean) as string[], 'approve')}
                      className="px-2.5 py-1 rounded-lg bg-gray-800 text-gray-200 text-[11px]">✓ Duyệt đã chọn</button>
                  </>
                )}
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800 bg-gray-800/30">
                    <th className="w-8 px-2 py-2"></th>
                    <th className="text-left px-3 py-2 font-medium w-20">Ngày</th>
                    <th className="text-left px-3 py-2 font-medium w-20">Format</th>
                    <th className="text-left px-3 py-2 font-medium">Hook / Hướng</th>
                    <th className="text-left px-3 py-2 font-medium w-24">Trạng thái</th>
                    <th className="text-left px-3 py-2 font-medium w-28">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {detail.items.map(it => {
                    const post = itemPost(it.id);
                    const planned = parsePlanDate(it.date, year);
                    const isOverdue = !post && planned && planned < new Date();
                    const mismatch = post && post.status !== 'published' && planned && post.scheduled_at && !sameDay(new Date(post.scheduled_at), planned);
                    return (
                      <tr key={it.id} className="hover:bg-gray-800/30">
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={sel.has(it.id)} className="accent-brand-500"
                            onChange={e => setSel(s => { const n = new Set(s); e.target.checked ? n.add(it.id) : n.delete(it.id); return n; })} />
                        </td>
                        <td className="px-3 py-2 text-gray-400 whitespace-nowrap">
                          {it.date}
                          {isOverdue && <span className="block text-[9px] text-red-400">quá hạn</span>}
                          {mismatch && <span className="block text-[9px] text-amber-400">lệch ngày</span>}
                        </td>
                        <td className="px-3 py-2"><span className="text-[10px] bg-gray-800 text-gray-400 rounded px-1.5 py-0.5">{it.surface?.split('·')[0]?.trim() || '—'}</span></td>
                        <td className="px-3 py-2 max-w-[360px]">
                          <p className="text-gray-300 truncate">{it.hook || '—'}</p>
                          {it.copy_direction && <p className="text-[10px] text-gray-600 truncate">{it.copy_direction}</p>}
                        </td>
                        <td className="px-3 py-2">
                          {post ? (
                            <span className="inline-flex items-center gap-1">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[post.status]}`}>{post.status}</span>
                              {post.status === 'published' && <span title="khóa">🔒</span>}
                              {post.review_status === 'approved' && <span className="text-emerald-400 text-[10px]">✓</span>}
                            </span>
                          ) : <span className="text-[10px] text-gray-600">chưa tạo</span>}
                        </td>
                        <td className="px-3 py-2">
                          {!post ? (
                            <button onClick={() => runItems([it.id])} disabled={running}
                              className="px-2 py-1 rounded bg-brand-600 hover:bg-brand-500 text-white text-[10px] font-semibold">▶ Run</button>
                          ) : post.status !== 'published' ? (
                            <button onClick={() => bulkAction([post.id], post.review_status === 'approved' ? 'reject' : 'approve')}
                              className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 text-[10px]">
                              {post.review_status === 'approved' ? '↩ Bỏ duyệt' : '✓ Duyệt'}
                            </button>
                          ) : <span className="text-[10px] text-gray-600">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}

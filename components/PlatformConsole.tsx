'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';

interface Store {
  id: string; name: string; slug: string; logo_url: string | null;
  domain: string | null; created_at: string | null;
  products: number; posts: number; members: number; fb_connected: boolean;
}
interface Member {
  id: string; email: string; name: string | null; role: string;
  is_approved: number; member_role: string; last_login: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  root_admin: 'Root Admin', admin: 'Admin', editor: 'Editor (khách)', viewer: 'Viewer',
};

export function PlatformConsole() {
  const { data: session, status } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = role === 'admin' || role === 'root_admin';

  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // create store form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState('');

  // invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');

  const loadStores = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/stores');
      const d = await r.json() as { stores?: Store[] };
      setStores(d.stores || []);
    } finally { setLoading(false); }
  }, []);

  const loadMembers = useCallback(async (brand: string) => {
    setMembersLoading(true);
    try {
      const r = await fetch(`/api/admin/stores/${brand}/members`);
      const d = await r.json() as { members?: Member[] };
      setMembers(d.members || []);
    } finally { setMembersLoading(false); }
  }, []);

  useEffect(() => { loadStores(); }, [loadStores]);
  useEffect(() => { if (selected) loadMembers(selected); }, [selected, loadMembers]);

  async function createStore() {
    setCreating(true); setCreateErr('');
    try {
      const r = await fetch('/api/admin/stores', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, slug: newSlug || undefined }),
      });
      const d = await r.json();
      if (!r.ok) { setCreateErr(d.error || 'Lỗi'); return; }
      setNewName(''); setNewSlug(''); setShowCreate(false);
      await loadStores();
      setSelected(d.id);
    } finally { setCreating(false); }
  }

  async function invite() {
    if (!selected || !inviteEmail.trim()) return;
    setInviting(true); setInviteMsg('');
    try {
      const r = await fetch(`/api/admin/stores/${selected}/members`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const d = await r.json();
      if (!r.ok) { setInviteMsg('❌ ' + (d.error || 'Lỗi')); return; }
      setInviteMsg(d.created ? '✅ Đã tạo & gán khách mới' : '✅ Đã gán vào store');
      setInviteEmail('');
      await loadMembers(selected); await loadStores();
    } finally { setInviting(false); }
  }

  async function removeMember(userId: string) {
    if (!selected) return;
    await fetch(`/api/admin/stores/${selected}/members?userId=${userId}`, { method: 'DELETE' });
    await loadMembers(selected); await loadStores();
  }

  if (status === 'loading') {
    return <div className="min-h-screen bg-gray-950 text-gray-500 flex items-center justify-center text-sm">Đang tải…</div>;
  }
  if (!isAdmin) {
    return <div className="min-h-screen bg-gray-950 text-gray-400 flex items-center justify-center text-sm">Chỉ super-admin nền tảng mới truy cập được trang này.</div>;
  }

  const sel = stores.find(s => s.id === selected);
  const totalCustomers = stores.reduce((a, s) => a + s.members, 0);
  const fbCount = stores.filter(s => s.fb_connected).length;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Top bar */}
      <header className="border-b border-gray-800 bg-gray-900/60 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">🛰 BigAI MKT <span className="text-gray-500 font-normal">· Platform Console</span></h1>
          <p className="text-xs text-gray-500 mt-0.5">Quản trị nền tảng dịch vụ — LoveinTea, Bazan, Rootin… là các store dùng dịch vụ.</p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/" className="text-sm text-gray-300 hover:text-white border border-gray-700 rounded-lg px-3 py-1.5">← Về app</a>
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-sm text-gray-400 hover:text-white">Đăng xuất</button>
        </div>
      </header>

      {/* Health strip */}
      <div className="px-6 pt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Store (tenant)', value: stores.length },
          { label: 'Khách hàng (thành viên)', value: totalCustomers },
          { label: 'Store đã nối Facebook', value: `${fbCount}/${stores.length}` },
          { label: 'Bạn đang là', value: ROLE_LABEL[role || ''] || role },
        ].map((c, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6">
        {/* Stores list */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Stores</h2>
            <button onClick={() => setShowCreate(v => !v)} className="text-sm bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded-lg">
              {showCreate ? 'Đóng' : '+ Tạo store'}
            </button>
          </div>

          {showCreate && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 space-y-2">
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Tên store (vd: Bazan)"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
              <input value={newSlug} onChange={e => setNewSlug(e.target.value)} placeholder="Slug (tùy chọn, vd: bazan)"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
              {createErr && <p className="text-xs text-red-400">{createErr}</p>}
              <button onClick={createStore} disabled={creating || !newName.trim()}
                className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm py-2 rounded-lg">
                {creating ? 'Đang tạo…' : 'Tạo store'}
              </button>
            </div>
          )}

          {loading ? <p className="text-gray-500 text-sm">Đang tải…</p> : (
            <div className="space-y-2">
              {stores.map(s => (
                <button key={s.id} onClick={() => setSelected(s.id)}
                  className={`w-full text-left bg-gray-900 border rounded-xl px-4 py-3 transition-colors ${selected === s.id ? 'border-brand-500' : 'border-gray-800 hover:border-gray-700'}`}>
                  <div className="flex items-center justify-between">
                    <div className="font-medium flex items-center gap-2">
                      {s.logo_url ? <img src={s.logo_url} alt="" className="w-5 h-5 rounded object-contain" /> : <span className="w-5 h-5 rounded bg-gray-700 flex items-center justify-center text-[10px]">{s.name[0]}</span>}
                      {s.name}
                      <span className="text-xs text-gray-600">/{s.slug}</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.fb_connected ? 'bg-green-900/50 text-green-300' : 'bg-gray-800 text-gray-500'}`}>
                      {s.fb_connected ? 'FB ✓' : 'chưa nối FB'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 flex gap-3">
                    <span>{s.products} sản phẩm</span><span>{s.posts} bài</span><span>{s.members} khách</span>
                  </div>
                </button>
              ))}
              {!stores.length && <p className="text-gray-600 text-sm">Chưa có store nào.</p>}
            </div>
          )}
        </section>

        {/* Store detail */}
        <section>
          {!sel ? (
            <div className="text-gray-600 text-sm border border-dashed border-gray-800 rounded-xl p-8 text-center">
              Chọn một store để quản lý khách hàng & kênh.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg">{sel.name} <span className="text-gray-600 text-sm font-normal">/{sel.slug}</span></h2>
                <div className="flex gap-2">
                  <a href="/" className="text-xs border border-gray-700 rounded-lg px-3 py-1.5 hover:bg-gray-800">Mở app ↗</a>
                </div>
              </div>

              {/* FB status */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Kênh Facebook / Instagram</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {sel.fb_connected ? 'Đã nối — đăng bài dùng token riêng của store.' : 'Chưa nối. Store chưa nối sẽ KHÔNG đăng được (không rơi về page khác).'}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-lg ${sel.fb_connected ? 'bg-green-900/50 text-green-300' : 'bg-yellow-900/40 text-yellow-300'}`}>
                    {sel.fb_connected ? 'Connected' : 'Not connected'}
                  </span>
                </div>
                <p className="text-[11px] text-gray-600 mt-2">Nối kênh trong app (tab Publisher → FB Setup) khi đăng nhập với quyền của store, hoặc dán System User token của khách.</p>
              </div>

              {/* Members */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-sm font-medium mb-3">Khách hàng của store</div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email khách (Google)"
                    className="flex-1 min-w-[180px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm" />
                  <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm">
                    <option value="editor">Editor (tạo bài)</option>
                    <option value="viewer">Viewer (chỉ xem)</option>
                  </select>
                  <button onClick={invite} disabled={inviting || !inviteEmail.trim()}
                    className="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-lg">
                    {inviting ? '…' : 'Mời'}
                  </button>
                </div>
                {inviteMsg && <p className="text-xs mb-2 text-gray-400">{inviteMsg}</p>}

                {membersLoading ? <p className="text-gray-500 text-sm">Đang tải…</p> : (
                  <div className="space-y-1">
                    {members.map(m => (
                      <div key={m.id} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-sm truncate">{m.email}</div>
                          <div className="text-[11px] text-gray-500">
                            {ROLE_LABEL[m.role] || m.role}
                            {m.is_approved === 1 ? '' : m.is_approved === 0 ? ' · chờ duyệt' : ' · bị khoá'}
                            {m.last_login ? ` · đăng nhập ${new Date(m.last_login).toLocaleDateString('vi')}` : ' · chưa đăng nhập'}
                          </div>
                        </div>
                        <button onClick={() => removeMember(m.id)} className="text-xs text-red-400 hover:text-red-300 shrink-0">Gỡ</button>
                      </div>
                    ))}
                    {!members.length && <p className="text-gray-600 text-sm">Chưa có khách nào. Mời bằng email Google ở trên.</p>}
                  </div>
                )}
                <p className="text-[11px] text-gray-600 mt-3">Khách đăng nhập bằng Google đúng email này sẽ vào thẳng store, chỉ thấy dữ liệu store mình.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

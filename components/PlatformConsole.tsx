'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { UserManagementView } from './UserManagementView';
import { AdminDashboardView } from './AdminDashboardView';

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

  const [section, setSection] = useState<'overview' | 'stores' | 'users'>('overview');
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // create store form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newOwnerEmail, setNewOwnerEmail] = useState('');
  const [newPlan, setNewPlan] = useState<'trial-30d' | 'pro' | 'enterprise'>('trial-30d');
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState('');
  const [welcomePanel, setWelcomePanel] = useState<null | { url: string; ownerEmail: string; tempPassword: string | null; welcomeMessage: string; planNote: string; expiresAt: string | null }>(null);
  const [welcomeCopied, setWelcomeCopied] = useState(false);

  // invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');
  const [tempPw, setTempPw] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

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
      // Wizard 60s: gộp createStore + inviteToStore + set brand_quotas + welcomeMessage
      const r = await fetch('/api/admin/onboard', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          slug: newSlug.trim() || undefined,
          ownerEmail: newOwnerEmail.trim(),
          plan: newPlan,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setCreateErr(d.error || 'Lỗi'); return; }
      // Hiện panel welcome cho founder copy gửi khách qua Zalo/Messenger
      setWelcomePanel({
        url: d.store.url,
        ownerEmail: d.owner.email,
        tempPassword: d.owner.tempPassword,
        welcomeMessage: d.welcomeMessage,
        planNote: d.plan.note,
        expiresAt: d.plan.expires_at,
      });
      setWelcomeCopied(false);
      setNewName(''); setNewSlug(''); setNewOwnerEmail(''); setNewPlan('trial-30d'); setShowCreate(false);
      await loadStores();
      setSelected(d.store.id);
    } finally { setCreating(false); }
  }

  function copyWelcomeMessage() {
    if (!welcomePanel) return;
    navigator.clipboard.writeText(welcomePanel.welcomeMessage);
    setWelcomeCopied(true);
    setTimeout(() => setWelcomeCopied(false), 2500);
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
      // Hiện welcome panel FULL đủ tin (URL+email+tempPass+options Google) — giống wizard onboard
      if (d.welcomeMessage) {
        setWelcomePanel({
          url: d.storeUrl || `https://${stores.find(s => s.id === selected)?.slug || selected}.easycreativehub.com`,
          ownerEmail: inviteEmail.trim(),
          tempPassword: d.tempPassword ?? null,
          welcomeMessage: d.welcomeMessage,
          planNote: 'invite',
          expiresAt: null,
        });
        setWelcomeCopied(false);
      }
      setInviteEmail('');
      await loadMembers(selected); await loadStores();
    } finally { setInviting(false); }
  }

  async function resetMk(m: Member) {
    if (!selected) return;
    if (!confirm(`Reset mật khẩu cho ${m.email}? Mật khẩu cũ hết hiệu lực ngay.`)) return;
    const r = await fetch(`/api/admin/stores/${selected}/members`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset', userId: m.id }),
    });
    const d = await r.json();
    if (!r.ok) { alert(d.error || 'Lỗi'); return; }
    // Reset password → hiện welcome panel full (giống invite/onboard) để founder copy Zalo gửi
    if (d.welcomeMessage) {
      setWelcomePanel({
        url: d.storeUrl || `https://${stores.find(s => s.id === selected)?.slug || selected}.easycreativehub.com`,
        ownerEmail: m.email,
        tempPassword: d.tempPassword ?? null,
        welcomeMessage: d.welcomeMessage,
        planNote: 'reset',
        expiresAt: null,
      });
      setWelcomeCopied(false);
    } else {
      // Fallback nếu route cũ (chưa deploy welcomeMessage): giữ hiển thị đơn giản
      setTempPw({ email: m.email, password: d.tempPassword });
      setCopied(false);
    }
  }

  function copyTempPw() {
    if (!tempPw) return;
    navigator.clipboard.writeText(`Đăng nhập: https://app.easycreativehub.com\nEmail: ${tempPw.email}\nMật khẩu tạm: ${tempPw.password}\n(Sẽ được yêu cầu đổi mật khẩu khi đăng nhập)`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

      {/* Section toggle */}
      <div className="px-6 pt-5 flex gap-2">
        {([['overview', '📊 Overview'], ['stores', '🏪 Stores'], ['users', '👥 Tất cả người dùng']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setSection(id)}
            className={`text-sm px-3 py-1.5 rounded-lg border ${section === id ? 'bg-brand-600/20 border-brand-500 text-white' : 'border-gray-800 text-gray-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {section === 'overview' && <AdminDashboardView />}

      {section === 'stores' && (
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
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 space-y-3">
              <div className="text-xs text-brand-300 font-semibold">🚀 Wizard onboard shop mới — 60 giây</div>
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">TÊN SHOP</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="vd: Cà phê Bảo Anh"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">SLUG (URL) — tùy chọn</label>
                <input value={newSlug} onChange={e => setNewSlug(e.target.value)} placeholder="vd: ca-phe-bao-anh (auto-gen nếu để trống)"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
                {newSlug && <p className="text-[10px] text-gray-600 mt-1">→ https://{newSlug}.easycreativehub.com</p>}
              </div>
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">EMAIL CHỦ SHOP</label>
                <input type="email" value={newOwnerEmail} onChange={e => setNewOwnerEmail(e.target.value)} placeholder="vd: baoanh@shop.vn"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
                <p className="text-[10px] text-gray-600 mt-1">→ Hệ thống tạo user admin + password tạm cho email này</p>
              </div>
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">GÓI</label>
                <select value={newPlan} onChange={e => setNewPlan(e.target.value as 'trial-30d' | 'pro' | 'enterprise')}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
                  <option value="trial-30d">🎁 Trial 30 ngày — 30 ảnh · 3 video · 25 content · trần $10</option>
                  <option value="pro">💼 Pro — 200 ảnh · 20 video · 500 content · trần $80</option>
                  <option value="enterprise">🏢 Enterprise — không giới hạn · trần $500</option>
                </select>
              </div>
              {createErr && <p className="text-xs text-red-400">{createErr}</p>}
              <button onClick={createStore} disabled={creating || !newName.trim() || !newOwnerEmail.trim()}
                className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm py-2 rounded-lg font-semibold">
                {creating ? '⏳ Đang tạo shop + user + gói…' : '🚀 Tạo shop + gửi welcome'}
              </button>
            </div>
          )}

          {/* Welcome message panel — hiện sau khi onboard xong, founder copy gửi khách */}
          {welcomePanel && (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setWelcomePanel(null)}>
              <div className="bg-gray-900 border border-brand-500 rounded-2xl p-6 max-w-2xl w-full space-y-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">🎉 Shop mới đã tạo xong!</h3>
                  <button onClick={() => setWelcomePanel(null)} className="text-gray-500 hover:text-white text-sm">✕ Đóng</button>
                </div>
                <div className="text-xs text-gray-400 space-y-1">
                  <div>🔗 URL: <a href={welcomePanel.url} target="_blank" rel="noreferrer" className="text-brand-300 hover:underline">{welcomePanel.url}</a></div>
                  <div>📧 Email chủ: <code className="bg-gray-800 px-1.5 py-0.5 rounded">{welcomePanel.ownerEmail}</code></div>
                  {welcomePanel.tempPassword && <div>🔑 Password tạm: <code className="bg-gray-800 px-1.5 py-0.5 rounded text-yellow-300">{welcomePanel.tempPassword}</code></div>}
                  <div>📦 Gói: <span className="text-white">{welcomePanel.planNote}</span>{welcomePanel.expiresAt && <span className="text-gray-500"> (hết hạn {welcomePanel.expiresAt})</span>}</div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500 mb-1">TIN NHẮN WELCOME (paste vào Zalo/Messenger gửi khách):</div>
                  <textarea readOnly value={welcomePanel.welcomeMessage}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-gray-300 font-mono h-56 resize-none" />
                </div>
                <button onClick={copyWelcomeMessage}
                  className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${welcomeCopied ? 'bg-green-600 text-white' : 'bg-brand-600 hover:bg-brand-500 text-white'}`}>
                  {welcomeCopied ? '✅ Đã copy — mở Zalo/Messenger paste gửi khách' : '📋 Copy toàn bộ tin nhắn'}
                </button>
                <div className="text-[10px] text-gray-600 border-t border-gray-800 pt-3">
                  💡 <b>Bước tiếp theo cho khách</b>: (1) đăng nhập bằng email + password tạm ở trên → (2) đổi mật khẩu → (3) làm wizard 5 bước setup shop (Brand DNA + Logo + Sản phẩm + FB/IG). Đóng cửa sổ này để tạo shop tiếp theo hoặc chọn shop vừa tạo bên phải để invite thêm thành viên.
                </div>
              </div>
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

                {tempPw && (
                  <div className="bg-yellow-900/25 border border-yellow-700/50 rounded-lg p-3 mb-3 flex items-start gap-2 flex-wrap">
                    <div className="flex-1 min-w-[180px]">
                      <p className="text-xs text-yellow-200 font-medium">🔑 Mật khẩu tạm cho {tempPw.email}</p>
                      <p className="font-mono text-base text-white tracking-wider select-all">{tempPw.password}</p>
                      <p className="text-[11px] text-yellow-500/80 mt-0.5">Chỉ hiện 1 lần — copy gửi cho khách. Họ có thể đăng nhập Google hoặc email + mật khẩu này (bắt đổi khi vào).</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={copyTempPw} className="text-xs bg-yellow-700/60 hover:bg-yellow-600/60 text-white px-3 py-1.5 rounded-lg">{copied ? '✓ Đã copy' : 'Copy'}</button>
                      <button onClick={() => setTempPw(null)} className="text-xs text-yellow-500/70 hover:text-yellow-300 px-2 py-1.5">Đóng</button>
                    </div>
                  </div>
                )}

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
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => resetMk(m)} className="text-xs text-gray-400 hover:text-white" title="Cấp mật khẩu tạm mới">🔑 Reset MK</button>
                          <button onClick={() => removeMember(m.id)} className="text-xs text-red-400 hover:text-red-300">Gỡ</button>
                        </div>
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
      )}

      {section === 'users' && (
        <div className="px-2 md:px-6 py-4">
          <UserManagementView />
        </div>
      )}
    </div>
  );
}

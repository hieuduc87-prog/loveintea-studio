'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface UserRecord {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  is_approved: number; // 1=approved, 0=pending, -1=blocked
  created_at: string;
  last_login: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  root_admin: 'Root Admin',
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
};

const ROLE_BADGE_CLASSES: Record<string, string> = {
  root_admin: 'bg-purple-900/60 text-purple-300 border border-purple-700/50',
  admin: 'bg-blue-900/60 text-blue-300 border border-blue-700/50',
  editor: 'bg-green-900/60 text-green-300 border border-green-700/50',
  viewer: 'bg-gray-800 text-gray-400 border border-gray-700',
};

const ASSIGNABLE_ROLES = ['viewer', 'editor', 'admin', 'root_admin'];

function Avatar({ user }: { user: UserRecord }) {
  if (user.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.image}
        alt={user.name ?? user.email}
        className="w-8 h-8 rounded-full object-cover"
        referrerPolicy="no-referrer"
      />
    );
  }
  const letter = (user.name ?? user.email ?? '?')[0].toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 text-xs font-bold flex-shrink-0">
      {letter}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE_CLASSES[role] ?? ROLE_BADGE_CLASSES.viewer}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function UserManagementView() {
  const { data: session } = useSession();
  const sessionRole = (session?.user as any)?.role as string | undefined;
  const sessionId = (session?.user as any)?.id as string | undefined;

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  // Brand assignment (phân quyền theo store)
  const [stores, setStores] = useState<Array<{ id: string; name: string }>>([]);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userBrands, setUserBrands] = useState<string[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [brandsSaving, setBrandsSaving] = useState(false);

  // Temp password vừa sinh (hiện 1 lần, kèm copy)
  const [tempPw, setTempPw] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Invite form state
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  // Blocked section collapsed
  const [blockedOpen, setBlockedOpen] = useState(false);

  // Action loading state: userId -> true
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Forbidden');
      const data = await res.json();
      setUsers(data.users ?? []);
      setPendingCount(Number(res.headers.get('X-Pending-Count') ?? 0));
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetch('/api/admin/stores')
      .then(r => r.ok ? r.json() : { stores: [] })
      .then((d: { stores?: Array<{ id: string; name: string }> }) => setStores(d.stores || []))
      .catch(() => setStores([]));
  }, [fetchUsers]);

  async function toggleBrandEditor(user: UserRecord) {
    if (expandedUser === user.id) { setExpandedUser(null); return; }
    setExpandedUser(user.id);
    setBrandsLoading(true);
    try {
      const r = await fetch(`/api/admin/users/${user.id}/brands`);
      const d = await r.json() as { brandIds?: string[] };
      setUserBrands(d.brandIds || []);
    } catch {
      setUserBrands([]);
    } finally {
      setBrandsLoading(false);
    }
  }

  async function saveBrands(userId: string) {
    setBrandsSaving(true);
    try {
      const r = await fetch(`/api/admin/users/${userId}/brands`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandIds: userBrands }),
      });
      if (!r.ok) { const d = await r.json(); alert(d.error ?? 'Lỗi'); return; }
      setExpandedUser(null);
    } finally {
      setBrandsSaving(false);
    }
  }

  async function resetPassword(user: UserRecord) {
    if (!confirm(`Reset mật khẩu cho ${user.email}? Mật khẩu cũ sẽ hết hiệu lực ngay.`)) return;
    setActionLoading(prev => ({ ...prev, [user.id]: true }));
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset_password: true }),
      });
      const d = await res.json();
      if (!res.ok) { alert(d.error ?? 'Lỗi'); return; }
      setTempPw({ email: user.email, password: d.tempPassword });
      setCopied(false);
    } finally {
      setActionLoading(prev => ({ ...prev, [user.id]: false }));
    }
  }

  function copyTempPw() {
    if (!tempPw) return;
    navigator.clipboard.writeText(`Đăng nhập: ${tempPw.email}\nMật khẩu tạm: ${tempPw.password}\n(Sẽ được yêu cầu đổi mật khẩu khi đăng nhập)`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Access denied for non-admin
  if (sessionRole !== 'root_admin' && sessionRole !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 text-sm">Access denied. Admin only.</p>
      </div>
    );
  }

  const canManageUser = (target: UserRecord) => {
    if (sessionRole === 'root_admin') return true;
    // admin can only manage viewers/editors
    return target.role !== 'root_admin' && target.role !== 'admin';
  };

  const canAssignRole = (role: string) => {
    if (sessionRole === 'root_admin') return true;
    return role !== 'root_admin' && role !== 'admin';
  };

  async function doAction(userId: string, body: Record<string, unknown>) {
    setActionLoading(prev => ({ ...prev, [userId]: true }));
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error ?? 'Error');
      } else {
        await fetchUsers();
      }
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: false }));
    }
  }

  async function doDelete(userId: string) {
    if (!confirm('Block user? They will be logged out immediately.')) return;
    setActionLoading(prev => ({ ...prev, [userId]: true }));
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error ?? 'Error');
      } else {
        await fetchUsers();
      }
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: false }));
    }
  }

  async function handleApprove(user: UserRecord, asRole?: string) {
    await doAction(user.id, { is_approved: 1, role: asRole ?? user.role });
  }

  async function handleBlock(user: UserRecord) {
    await doDelete(user.id);
  }

  async function handleUnblock(user: UserRecord) {
    await doAction(user.id, { is_approved: 1 });
  }

  async function handleRoleChange(user: UserRecord, newRole: string) {
    await doAction(user.id, { role: newRole });
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');
    if (!inviteEmail.trim()) { setInviteError('Email is required'); return; }
    setInviting(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole, action: 'invite' }),
      });
      const data = await res.json();
      if (!res.ok) { setInviteError(data.error ?? 'Error'); return; }
      setInviteSuccess(`Đã mời ${inviteEmail.trim()} (${ROLE_LABELS[inviteRole] ?? inviteRole})`);
      if (data.tempPassword) { setTempPw({ email: inviteEmail.trim(), password: data.tempPassword }); setCopied(false); }
      setInviteEmail('');
      await fetchUsers();
      setTimeout(() => setInviteSuccess(''), 3000);
    } finally {
      setInviting(false);
    }
  }

  const pendingUsers = users.filter(u => u.is_approved === 0);
  const activeUsers = users.filter(u => u.is_approved === 1);
  const blockedUsers = users.filter(u => u.is_approved === -1);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">Team & Access</h2>
          {pendingCount > 0 && (
            <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-600/40 text-xs px-2 py-0.5 rounded-full font-medium">
              {pendingCount} pending approval
            </span>
          )}
        </div>
        <button
          onClick={() => setShowInviteForm(v => !v)}
          className="text-sm bg-brand-600 hover:bg-brand-500 text-white px-4 py-1.5 rounded-lg transition-colors"
        >
          {showInviteForm ? 'Cancel' : 'Invite User'}
        </button>
      </div>

      {/* Temp password — hiện 1 lần, copy đưa cho user */}
      {tempPw && (
        <div className="bg-yellow-900/25 border border-yellow-700/50 rounded-xl p-4 flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <p className="text-sm text-yellow-200 font-medium">🔑 Mật khẩu tạm cho {tempPw.email}</p>
            <p className="font-mono text-lg text-white tracking-wider mt-1 select-all">{tempPw.password}</p>
            <p className="text-xs text-yellow-500/80 mt-1">Chỉ hiện 1 lần — copy gửi cho user. Họ đăng nhập bằng email + mật khẩu này (hoặc Google) và sẽ phải đổi mật khẩu.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={copyTempPw} className="text-xs bg-yellow-700/60 hover:bg-yellow-600/60 text-white px-3 py-1.5 rounded-lg">
              {copied ? '✓ Đã copy' : 'Copy'}
            </button>
            <button onClick={() => setTempPw(null)} className="text-xs text-yellow-500/70 hover:text-yellow-300 px-2 py-1.5">Đóng</button>
          </div>
        </div>
      )}

      {/* Invite form */}
      {showInviteForm && (
        <form onSubmit={handleInvite} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <div className="flex gap-3 flex-wrap">
            <input
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              className="flex-1 min-w-[200px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500"
            >
              {ASSIGNABLE_ROLES.filter(r => canAssignRole(r)).map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={inviting}
              className="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
            >
              {inviting ? 'Inviting...' : 'Invite'}
            </button>
          </div>
          {inviteError && <p className="text-red-400 text-xs">{inviteError}</p>}
          {inviteSuccess && <p className="text-green-400 text-xs">{inviteSuccess}</p>}
          <p className="text-gray-500 text-xs">
            User sẽ tự động vào sau khi đăng nhập với email này qua Google
          </p>
        </form>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-gray-800/60 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {!loading && (
        <>
          {/* Pending approval section */}
          {pendingUsers.length > 0 && (
            <div className="rounded-xl border border-yellow-700/40 overflow-hidden">
              <div className="bg-yellow-900/20 px-4 py-2.5 flex items-center gap-2">
                <span className="text-yellow-400 text-sm font-medium">Chờ duyệt ({pendingUsers.length})</span>
              </div>
              <div className="divide-y divide-gray-800">
                {pendingUsers.map(user => (
                  <div key={user.id} className="px-4 py-3 flex items-center gap-3 flex-wrap bg-gray-900/60">
                    <Avatar user={user} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{user.email}</p>
                      <p className="text-xs text-gray-500">Registered {formatDate(user.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400">Approve as</span>
                        <select
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none"
                          defaultValue="editor"
                          onChange={e => {
                            // Track selection per-user via data attribute trick — handled on button click
                            const el = e.currentTarget;
                            el.dataset.selected = e.target.value;
                          }}
                          id={`approve-role-${user.id}`}
                        >
                          {ASSIGNABLE_ROLES.filter(r => canAssignRole(r)).map(r => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        disabled={actionLoading[user.id]}
                        onClick={() => {
                          const sel = document.getElementById(`approve-role-${user.id}`) as HTMLSelectElement | null;
                          handleApprove(user, sel?.value ?? 'editor');
                        }}
                        className="text-xs bg-green-700/80 hover:bg-green-600 disabled:opacity-50 text-white px-3 py-1 rounded-lg transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        disabled={actionLoading[user.id]}
                        onClick={() => handleBlock(user)}
                        className="text-xs bg-gray-800 hover:bg-red-900/60 disabled:opacity-50 text-gray-400 hover:text-red-300 px-3 py-1 rounded-lg transition-colors border border-gray-700"
                      >
                        Block
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active users table */}
          <div className="rounded-xl border border-gray-800 overflow-hidden">
            <div className="bg-gray-900/60 px-4 py-2.5">
              <span className="text-gray-400 text-sm font-medium">Active Users ({activeUsers.length})</span>
            </div>
            {activeUsers.length === 0 && (
              <div className="px-4 py-6 text-center text-gray-600 text-sm">No active users</div>
            )}
            <div className="divide-y divide-gray-800">
              {activeUsers.map(user => {
                const isCurrentUser = user.id === sessionId;
                const manageable = canManageUser(user) && !isCurrentUser;
                const isRootAdmin = user.role === 'root_admin';
                const isAdminLevel = user.role === 'root_admin' || user.role === 'admin';
                return (
                  <div key={user.id}>
                  <div className="px-4 py-3 flex items-center gap-3 flex-wrap hover:bg-gray-900/30 transition-colors">
                    <Avatar user={user} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm text-white truncate">{user.name ?? user.email}</p>
                        {isCurrentUser && (
                          <span className="text-xs text-gray-500">(bạn)</span>
                        )}
                        {isRootAdmin && !manageable && (
                          <span className="text-gray-600 text-xs">🔒</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <RoleBadge role={user.role} />
                      <span className="text-xs text-gray-600 hidden sm:block">
                        {user.last_login ? `Active ${formatDate(user.last_login)}` : 'Never logged in'}
                      </span>
                      {isAdminLevel && (
                        <span className="text-[11px] text-gray-500 hidden md:block">mọi brand</span>
                      )}
                      {manageable && (
                        <div className="flex items-center gap-2">
                          <select
                            value={user.role}
                            disabled={actionLoading[user.id]}
                            onChange={e => handleRoleChange(user, e.target.value)}
                            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none disabled:opacity-50"
                          >
                            {ASSIGNABLE_ROLES.filter(r => canAssignRole(r)).map(r => (
                              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                          </select>
                          {!isAdminLevel && (
                            <button
                              disabled={actionLoading[user.id]}
                              onClick={() => toggleBrandEditor(user)}
                              className={`text-xs px-2.5 py-1 rounded-lg transition-colors border ${expandedUser === user.id ? 'bg-brand-600/30 border-brand-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}
                            >
                              🏪 Brand
                            </button>
                          )}
                          <button
                            disabled={actionLoading[user.id]}
                            onClick={() => resetPassword(user)}
                            className="text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-400 hover:text-white px-2.5 py-1 rounded-lg transition-colors border border-gray-700"
                            title="Cấp mật khẩu tạm mới"
                          >
                            🔑 Reset MK
                          </button>
                          <button
                            disabled={actionLoading[user.id]}
                            onClick={() => handleBlock(user)}
                            className="text-xs bg-gray-800 hover:bg-red-900/60 disabled:opacity-50 text-gray-500 hover:text-red-300 px-2.5 py-1 rounded-lg transition-colors border border-gray-700"
                          >
                            Block
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Panel phân quyền brand */}
                  {expandedUser === user.id && (
                    <div className="px-4 pb-3 bg-gray-900/40">
                      <div className="border border-gray-800 rounded-lg p-3">
                        <p className="text-xs text-gray-400 mb-2">Store mà <span className="text-white">{user.email}</span> được truy cập (không chọn gì = không vào được store nào):</p>
                        {brandsLoading ? <p className="text-xs text-gray-500">Đang tải…</p> : (
                          <div className="flex flex-wrap gap-2">
                            {stores.map(s => {
                              const on = userBrands.includes(s.id);
                              return (
                                <button key={s.id}
                                  onClick={() => setUserBrands(prev => on ? prev.filter(b => b !== s.id) : [...prev, s.id])}
                                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${on ? 'bg-brand-600/30 border-brand-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300'}`}
                                >
                                  {on ? '✓ ' : ''}{s.name}
                                </button>
                              );
                            })}
                            {!stores.length && <p className="text-xs text-gray-600">Chưa có store nào.</p>}
                          </div>
                        )}
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => saveBrands(user.id)} disabled={brandsSaving || brandsLoading}
                            className="text-xs bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg">
                            {brandsSaving ? 'Đang lưu…' : 'Lưu phân quyền'}
                          </button>
                          <button onClick={() => setExpandedUser(null)} className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1.5">Hủy</button>
                        </div>
                      </div>
                    </div>
                  )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Blocked users section */}
          {blockedUsers.length > 0 && (
            <div className="rounded-xl border border-gray-800 overflow-hidden">
              <button
                onClick={() => setBlockedOpen(v => !v)}
                className="w-full bg-gray-900/60 px-4 py-2.5 flex items-center justify-between text-left"
              >
                <span className="text-gray-500 text-sm font-medium">
                  Blocked Users ({blockedUsers.length})
                </span>
                <span className="text-gray-600 text-xs">{blockedOpen ? 'Hide' : 'Show'}</span>
              </button>
              {blockedOpen && (
                <div className="divide-y divide-gray-800">
                  {blockedUsers.map(user => (
                    <div key={user.id} className="px-4 py-3 flex items-center gap-3 flex-wrap bg-gray-950/40">
                      <Avatar user={user} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-400 truncate">{user.email}</p>
                        <p className="text-xs text-gray-600">Blocked</p>
                      </div>
                      {canManageUser(user) && (
                        <button
                          disabled={actionLoading[user.id]}
                          onClick={() => handleUnblock(user)}
                          className="text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-400 hover:text-white px-3 py-1 rounded-lg transition-colors border border-gray-700"
                        >
                          Unblock
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Auto-approval note */}
          <p className="text-xs text-gray-600 text-center pb-2">
            Người dùng mới đăng nhập bằng Google sẽ ở trạng thái chờ duyệt cho đến khi admin approve,
            hoặc bạn có thể invite trước bằng email.
          </p>
        </>
      )}
    </div>
  );
}

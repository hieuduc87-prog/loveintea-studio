'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  is_approved: number;
  created_at: string;
  last_login: string | null;
}

const ROLE_LABELS: Record<string, { label: string; cls: string }> = {
  admin:  { label: 'Admin',  cls: 'bg-purple-900/50 text-purple-300 border-purple-700' },
  editor: { label: 'Editor', cls: 'bg-blue-900/50 text-blue-300 border-blue-700' },
  viewer: { label: 'Viewer', cls: 'bg-gray-800 text-gray-400 border-gray-600' },
};

const STATUS_MAP: Record<number, { label: string; cls: string }> = {
  1:  { label: 'Approved', cls: 'bg-green-900/50 text-green-300 border-green-700' },
  0:  { label: 'Pending',  cls: 'bg-yellow-900/50 text-yellow-300 border-yellow-700' },
  [-1]: { label: 'Blocked', cls: 'bg-red-900/50 text-red-300 border-red-700' },
};

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviting, setInviting] = useState(false);
  const [msg, setMsg] = useState('');

  const isAdmin = (session?.user as any)?.role === 'admin';

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Forbidden');
      const data = await res.json();
      setUsers(data.users);
    } catch {
      setMsg('Không thể tải danh sách user.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (!isAdmin) { router.replace('/'); return; }
    loadUsers();
  }, [status, isAdmin, loadUsers, router]);

  async function patchUser(id: string, patch: Partial<{ role: string; is_approved: number }>) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const { user } = await res.json();
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...user } : u));
    }
  }

  async function blockUser(id: string) {
    if (!confirm('Khóa tài khoản này?')) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_approved: -1 } : u));
    }
  }

  async function unblockUser(id: string) {
    await patchUser(id, { is_approved: 1 });
  }

  async function inviteUser() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole, is_approved: 1 }),
      });
      if (res.ok) {
        setMsg(`Đã mời ${inviteEmail}`);
        setInviteEmail('');
        loadUsers();
      } else {
        const err = await res.json();
        setMsg(err.error ?? 'Lỗi khi mời user.');
      }
    } finally {
      setInviting(false);
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  }

  if (status === 'loading') {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500">Đang tải...</div>;
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/90 backdrop-blur px-6 h-12 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-sm">← Back</button>
        <span className="text-gray-600">|</span>
        <h1 className="text-sm font-semibold text-white">User Management</h1>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-6">

        {/* Invite Section */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-200">Mời thành viên mới</h2>
          <div className="flex gap-3 flex-wrap">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="email@example.com"
              className="flex-1 min-w-[220px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
              onKeyDown={e => e.key === 'Enter' && inviteUser()}
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
            <button
              onClick={inviteUser}
              disabled={inviting || !inviteEmail.trim()}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            >
              {inviting ? 'Đang mời...' : 'Mời'}
            </button>
          </div>
          {msg && <p className="text-sm text-green-400">{msg}</p>}
        </div>

        {/* Users Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-200">Danh sách thành viên ({users.length})</h2>
            <button onClick={loadUsers} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Làm mới
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-600 text-sm">Đang tải...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-gray-600 text-sm">Chưa có user nào.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left">
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {users.map(user => {
                    const roleInfo = ROLE_LABELS[user.role] ?? ROLE_LABELS.viewer;
                    const statusInfo = STATUS_MAP[user.is_approved] ?? STATUS_MAP[0];
                    const isSelf = (session?.user as any)?.id === user.id;

                    return (
                      <tr key={user.id} className="hover:bg-gray-800/30 transition-colors">
                        {/* User cell */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-gray-700 overflow-hidden flex-shrink-0">
                              {user.image ? (
                                <img src={user.image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-bold">
                                  {(user.name ?? user.email)[0].toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-white text-xs font-medium">
                                {user.name ?? '—'} {isSelf && <span className="text-gray-500">(you)</span>}
                              </div>
                              <div className="text-gray-500 text-xs">{user.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="px-4 py-3">
                          <select
                            value={user.role}
                            onChange={e => patchUser(user.id, { role: e.target.value })}
                            disabled={isSelf}
                            className={`text-xs font-medium border rounded px-2 py-1 bg-transparent cursor-pointer disabled:cursor-default ${roleInfo.cls}`}
                          >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center text-xs font-medium border rounded-full px-2 py-0.5 ${statusInfo.cls}`}>
                            {statusInfo.label}
                          </span>
                        </td>

                        {/* Last login */}
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {formatDate(user.last_login)}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {user.is_approved === 0 && (
                              <button
                                onClick={() => patchUser(user.id, { is_approved: 1 })}
                                className="text-xs bg-green-900/40 hover:bg-green-900/70 text-green-400 border border-green-800 rounded px-2.5 py-1 transition-colors"
                              >
                                Approve
                              </button>
                            )}
                            {user.is_approved === -1 && !isSelf && (
                              <button
                                onClick={() => unblockUser(user.id)}
                                className="text-xs bg-blue-900/40 hover:bg-blue-900/70 text-blue-400 border border-blue-800 rounded px-2.5 py-1 transition-colors"
                              >
                                Unblock
                              </button>
                            )}
                            {user.is_approved !== -1 && !isSelf && (
                              <button
                                onClick={() => blockUser(user.id)}
                                className="text-xs bg-red-900/30 hover:bg-red-900/60 text-red-400 border border-red-900 rounded px-2.5 py-1 transition-colors"
                              >
                                Block
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

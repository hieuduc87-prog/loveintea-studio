'use client';

import { useState, useEffect, useCallback } from 'react';

interface Member {
  id: string; email: string; name: string | null; role: string;
  is_approved: number; member_role: string; last_login: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  root_admin: 'Root Admin', admin: 'Admin', editor: 'Editor', viewer: 'Viewer',
};

/**
 * Per-brand user management (Team tab). Each project has its OWN independent set
 * of users — this lists only members of the active brand. Global user admin
 * (approve new signups, block, assign across stores) lives in the Platform console.
 */
export function BrandMembersView({ brandId, brandName }: { brandId: string; brandName?: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/stores/${brandId}/members`);
      const d = await r.json() as { members?: Member[]; error?: string };
      setMembers(d.members || []);
    } finally { setLoading(false); }
  }, [brandId]);

  useEffect(() => { load(); }, [load]);

  async function invite() {
    if (!email.trim()) return;
    setBusy(true); setMsg('');
    try {
      const r = await fetch(`/api/admin/stores/${brandId}/members`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg('❌ ' + (d.error || 'Lỗi')); return; }
      setMsg(d.created ? '✅ Đã tạo & thêm người dùng mới vào store' : '✅ Đã thêm vào store');
      setEmail('');
      await load();
    } finally { setBusy(false); }
  }

  async function remove(userId: string, memberEmail: string) {
    if (!confirm(`Gỡ ${memberEmail} khỏi store này? (Tài khoản không bị xoá, chỉ mất quyền truy cập store)`)) return;
    await fetch(`/api/admin/stores/${brandId}/members?userId=${userId}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Người dùng — {brandName || brandId}</h1>
        <p className="text-sm text-gray-400 mt-1">
          Mỗi dự án có hệ thống người dùng <b>độc lập</b>. Đây chỉ là người dùng của store này.
          Duyệt đăng ký mới / khoá tài khoản / gán nhiều store → làm ở <a href="/platform" className="text-brand-400 hover:underline">🛰 Platform Console</a>.
        </p>
      </div>

      {/* Invite */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="text-sm font-medium text-white mb-3">Thêm người dùng vào store</div>
        <div className="flex flex-wrap gap-2">
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email Google của người dùng"
            className="flex-1 min-w-[200px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500" />
          <select value={role} onChange={e => setRole(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white">
            <option value="editor">Editor (tạo nội dung)</option>
            <option value="viewer">Viewer (chỉ xem)</option>
          </select>
          <button onClick={invite} disabled={busy || !email.trim()}
            className="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-lg">
            {busy ? '…' : 'Thêm'}
          </button>
        </div>
        {msg && <p className="text-xs mt-2 text-gray-400">{msg}</p>}
        <p className="text-[11px] text-gray-600 mt-2">Người dùng đăng nhập Google đúng email này sẽ vào thẳng store, chỉ thấy dữ liệu store này.</p>
      </div>

      {/* Members */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="text-sm font-medium text-white mb-3">Thành viên ({members.length})</div>
        {loading ? <p className="text-gray-500 text-sm">Đang tải…</p> : (
          <div className="space-y-1">
            {members.map(m => (
              <div key={m.id} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm text-white truncate">{m.email}</div>
                  <div className="text-[11px] text-gray-500">
                    {ROLE_LABEL[m.role] || m.role}
                    {m.is_approved === 1 ? '' : m.is_approved === 0 ? ' · chờ duyệt' : ' · bị khoá'}
                    {m.last_login ? ` · đăng nhập ${new Date(m.last_login).toLocaleDateString('vi')}` : ' · chưa đăng nhập'}
                  </div>
                </div>
                {m.role !== 'root_admin' && m.role !== 'admin' && (
                  <button onClick={() => remove(m.id, m.email)} className="text-xs text-red-400 hover:text-red-300 shrink-0">Gỡ</button>
                )}
              </div>
            ))}
            {!members.length && <p className="text-gray-600 text-sm">Chưa có người dùng nào. Thêm bằng email Google ở trên.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';

export default function ChangePasswordPage() {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    if (pw.length < 8) { setMsg('Mật khẩu tối thiểu 8 ký tự'); return; }
    if (pw !== pw2) { setMsg('Hai mật khẩu không khớp'); return; }
    setBusy(true);
    const r = await fetch('/api/account/password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: pw }),
    });
    setBusy(false);
    const d = await r.json();
    if (!r.ok) { setMsg('❌ ' + (d.error || 'Lỗi')); return; }
    setDone(true);
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-8">
        <h1 className="text-lg font-bold text-white mb-1">Đổi mật khẩu</h1>
        <p className="text-sm text-gray-400 mb-5">Đặt mật khẩu riêng của bạn thay cho mật khẩu tạm.</p>
        {done ? (
          <div className="text-sm text-green-400">
            ✅ Đã đổi mật khẩu. <a href="/" className="text-brand-400 hover:underline">Về trang chính →</a>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-2.5">
            <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Mật khẩu mới (≥8 ký tự)"
              autoComplete="new-password"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500" />
            <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} placeholder="Nhập lại mật khẩu"
              autoComplete="new-password"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500" />
            {msg && <p className="text-xs text-red-400">{msg}</p>}
            <button type="submit" disabled={busy}
              className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl px-5 py-3">
              {busy ? 'Đang lưu…' : 'Đổi mật khẩu'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

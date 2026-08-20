'use client';
/**
 * LeadForm — form nhận báo giá trong /plans/[slug].
 * Fields: email, phone, storeName, note (tuỳ chọn).
 * Submit POST /api/leads → server tạo card kanban 'sales-lead' + trả link Zalo.
 * Success: hiện success state trong 5s rồi reset (không redirect để user có thể copy Zalo).
 */
import { useState } from 'react';

interface Props {
  planSlug: string;
  planName: string;
}

export function LeadForm({ planSlug, planName }: Props) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [storeName, setStoreName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const r = await fetch('/api/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone, storeName, planSlug, note, source: 'plans' }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Lỗi gửi');
      setDone(true);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  if (done) {
    return (
      <div className="bg-green-500/10 border border-green-500 rounded-xl p-5 text-center">
        <div className="text-4xl mb-2">✅</div>
        <div className="font-bold text-white mb-2">Đã nhận yêu cầu báo giá!</div>
        <div className="text-xs text-gray-400 mb-4">Chuyên gia ECH sẽ chat Zalo bạn trong ~30 phút (giờ hành chính). Chat Zalo trước cho nhanh:</div>
        <a href="https://zalo.me/hieuduc87" target="_blank" rel="noreferrer"
          className="inline-block bg-brand-500 hover:bg-brand-400 text-white font-semibold px-4 py-2 rounded-lg text-sm">
          💬 Mở Zalo →
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input type="email" required placeholder="Email của bạn *"
        value={email} onChange={e => setEmail(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500" />
      <input type="tel" required placeholder="Số điện thoại / Zalo *"
        value={phone} onChange={e => setPhone(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500" />
      <input type="text" placeholder="Tên shop / thương hiệu"
        value={storeName} onChange={e => setStoreName(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500" />
      <textarea placeholder="Kể ngắn về shop + mục tiêu tháng tới (tuỳ chọn)"
        value={note} onChange={e => setNote(e.target.value)} rows={3}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 resize-none" />
      {err && <p className="text-xs text-red-400">{err}</p>}
      <button type="submit" disabled={busy || !email || !phone}
        className="w-full bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-white font-bold py-3 rounded-lg text-sm">
        {busy ? 'Đang gửi…' : `📩 Nhận báo giá ${planName}`}
      </button>
      <p className="text-[10px] text-gray-500 text-center">
        Bằng cách gửi, bạn đồng ý ECH liên hệ qua email/Zalo bạn cung cấp. Không spam, không share bên thứ 3.
      </p>
    </form>
  );
}

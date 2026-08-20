'use client';

/**
 * OnboardingWizard — modal 3 bước tự động hiện cho khách khi login LẦN ĐẦU:
 *  (1) Đổi mật khẩu tạm (bắt buộc nếu must_change_password === 1)
 *  (2) Brand DNA cơ bản — tagline + voice (skip được, làm sau ở menu Brand DNA)
 *  (3) Kết nối Facebook (skip được, làm sau ở menu Channels)
 *
 * Sau xong: mark `settings.onboard_done_<userId>` để không hiện lại. Nút "Đóng" ở
 * mọi bước — không ép nếu khách muốn tự khám phá.
 *
 * Founder wizard 60s tạo shop → mời khách qua Zalo/Messenger (welcomeMessage) —
 * khách bấm link login lần đầu → wizard này bật lên tự dẫn dắt.
 */
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface Props {
  activeBrandId: string;
  onDone?: () => void;
}

const LS_KEY = (uid: string) => `ech.onboard.done.${uid}`;

export function OnboardingWizard({ activeBrandId, onDone }: Props) {
  const { data: session } = useSession();
  const user = session?.user as { id?: string; email?: string; must_change_password?: number } | undefined;

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Bước 1: password
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');

  // Bước 2: Brand DNA
  const [tagline, setTagline] = useState('');
  const [voice, setVoice] = useState('');

  const checkShouldOpen = useCallback(async () => {
    if (!user?.id) return;
    if (localStorage.getItem(LS_KEY(user.id))) return; // đã xong 1 lần → không hiện lại
    // Trigger 1: must_change_password
    if (user.must_change_password === 1) { setStep(1); setOpen(true); return; }
    // Trigger 2: brand_dna chưa có tagline (khách được tạo mới → wizard mở từ bước 2)
    if (activeBrandId) {
      try {
        const r = await fetch(`/api/brands/${activeBrandId}`);
        const d = await r.json();
        if (!d.brand?.dna?.tagline) { setStep(2); setOpen(true); }
      } catch { /* ignore */ }
    }
  }, [user, activeBrandId]);

  useEffect(() => { checkShouldOpen(); }, [checkShouldOpen]);

  async function submitPassword() {
    setErr('');
    if (pw.length < 8) return setErr('Mật khẩu tối thiểu 8 ký tự');
    if (pw !== pw2) return setErr('2 mật khẩu không khớp');
    setBusy(true);
    try {
      const r = await fetch('/api/account/password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: pw }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Lỗi');
      setStep(2);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function submitDna() {
    setErr('');
    if (!tagline.trim()) return setStep(3); // skip khi rỗng
    setBusy(true);
    try {
      const r = await fetch(`/api/brands/${activeBrandId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dna: { tagline: tagline.trim(), voice_traits: voice.trim() ? JSON.stringify(voice.split(',').map(v => v.trim()).filter(Boolean)) : undefined } }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Lỗi');
      setStep(3);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  function finish() {
    if (user?.id) localStorage.setItem(LS_KEY(user.id), '1');
    setOpen(false);
    onDone?.();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-brand-500 rounded-2xl p-6 max-w-lg w-full space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-brand-300 font-semibold">🚀 Chào mừng đến Easy Creative Hub</div>
            <h3 className="text-lg font-bold text-white mt-1">
              {step === 1 && 'Bước 1/3 — Đổi mật khẩu'}
              {step === 2 && 'Bước 2/3 — Chất thương hiệu'}
              {step === 3 && 'Bước 3/3 — Kết nối kênh'}
            </h3>
          </div>
          <button onClick={finish} className="text-gray-500 hover:text-white text-sm">✕ Đóng</button>
        </div>

        {/* progress */}
        <div className="flex gap-1">
          {[1, 2, 3].map(n => (
            <div key={n} className={`h-1 flex-1 rounded ${n <= step ? 'bg-brand-500' : 'bg-gray-800'}`} />
          ))}
        </div>

        {/* Bước 1: password */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-300">Vì bạn đăng nhập bằng mật khẩu tạm, hãy đặt mật khẩu mới ngay bây giờ (tối thiểu 8 ký tự).</p>
            <div>
              <label className="text-[11px] text-gray-500 mb-1 block">MẬT KHẨU MỚI</label>
              <input type="password" value={pw} onChange={e => setPw(e.target.value)} autoFocus
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-[11px] text-gray-500 mb-1 block">NHẬP LẠI MẬT KHẨU</label>
              <input type="password" value={pw2} onChange={e => setPw2(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
            </div>
            {err && <p className="text-xs text-red-400">{err}</p>}
            <button onClick={submitPassword} disabled={busy || !pw || !pw2}
              className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm py-2.5 rounded-lg font-semibold">
              {busy ? 'Đang lưu…' : 'Đổi mật khẩu → Tiếp'}
            </button>
          </div>
        )}

        {/* Bước 2: Brand DNA cơ bản */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-300">AI sẽ dựa vào chất thương hiệu để viết đúng giọng cho bạn. Điền 2 câu thôi, chi tiết hơn làm sau ở menu <b>Brand DNA</b>.</p>
            <div>
              <label className="text-[11px] text-gray-500 mb-1 block">TAGLINE (1 câu ngắn mô tả bạn bán gì / cho ai)</label>
              <input value={tagline} onChange={e => setTagline(e.target.value)} placeholder="vd: Trà thảo mộc cho người ngủ ngon"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-[11px] text-gray-500 mb-1 block">GIỌNG NÓI (3-5 tính từ, phẩy ngăn)</label>
              <input value={voice} onChange={e => setVoice(e.target.value)} placeholder="vd: ấm áp, thân thiện, chân thật"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
            </div>
            {err && <p className="text-xs text-red-400">{err}</p>}
            <div className="flex gap-2">
              <button onClick={() => setStep(3)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2.5 rounded-lg">
                Để sau
              </button>
              <button onClick={submitDna} disabled={busy}
                className="flex-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm py-2.5 rounded-lg font-semibold">
                {busy ? 'Đang lưu…' : 'Lưu → Tiếp'}
              </button>
            </div>
          </div>
        )}

        {/* Bước 3: CHIA SẺ QUYỀN FB + IG CHO BUSINESS ECH (cách duy nhất, chuẩn agency, không hết hạn) */}
        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-300">Để ECH đăng bài tự động lên Fanpage + Instagram của bạn, chia sẻ quyền cho Business Portfolio của ECH. Làm 1 lần, dùng mãi (không hết hạn):</p>

            <div className="bg-gray-800 border border-brand-500/50 rounded-lg p-3 space-y-3">
              <div className="bg-brand-500/10 border border-brand-500/30 rounded p-2">
                <div className="text-[11px] text-brand-300 font-semibold mb-1">📌 ID Business Portfolio của ECH — copy để dán:</div>
                <code className="block bg-gray-900 px-3 py-2 rounded text-brand-300 text-sm select-all font-mono">247211154665626</code>
              </div>

              <ol className="list-decimal ml-4 space-y-2 text-xs text-gray-300">
                <li>Mở <a href="https://business.facebook.com" target="_blank" rel="noreferrer" className="text-brand-300 hover:underline font-semibold">business.facebook.com</a> → chọn Business Portfolio của shop bạn <span className="text-gray-500">(chưa có: bấm &quot;Create a business account&quot;, miễn phí 2 phút)</span></li>
                <li><b>Accounts → Pages</b> → chọn Fanpage → tab <b>&quot;Assign Partners&quot;</b> → nhập ID trên → tick quyền: <i>Create content, Manage Page, Send messages, Insights</i> → <b>Save</b></li>
                <li><b>Accounts → Instagram accounts</b> → chọn IG → tab <b>&quot;Assign Partners&quot;</b> → cùng ID → tick <i>Create content, Insights</i> → <b>Save</b></li>
                <li>Xong → nhắn tên Fanpage + tên IG cho admin ECH qua Zalo/Messenger — ECH verify + bật đăng bài trong ~2 phút</li>
              </ol>

              <a href="/help/share-fb-ig" target="_blank" rel="noreferrer"
                className="block bg-brand-500 hover:bg-brand-400 text-white text-xs py-2 rounded text-center font-semibold">
                📖 Xem hướng dẫn CHI TIẾT (có ảnh, FAQ) →
              </a>

              <div className="text-[11px] text-gray-500 border-t border-gray-700 pt-2 space-y-1">
                <div>❓ <b>Chưa có IG Business?</b> App IG → Settings → Account → &quot;Switch to Business&quot; → link Fanpage.</div>
                <div>❓ <b>Fanpage đã có agency khác?</b> Vẫn share song song được, không ảnh hưởng access của họ.</div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={finish} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2.5 rounded-lg">
                Để sau
              </button>
              <button onClick={finish}
                className="flex-1 bg-green-600 hover:bg-green-500 text-white text-sm py-2.5 rounded-lg font-semibold">
                ✅ Xong — bắt đầu dùng
              </button>
            </div>
          </div>
        )}

        <div className="text-[10px] text-gray-600 border-t border-gray-800 pt-3">
          💡 Cần hỗ trợ, xem <b>Hướng dẫn A-Z</b> ở sidebar sau khi xong, hoặc hỏi chatbot ở góc phải dưới.
        </div>
      </div>
    </div>
  );
}

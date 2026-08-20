'use client';
/**
 * PlansExitPopup — hiện popup khi user di chuột ra ngoài viewport top (exit intent).
 * Chỉ trigger 1 lần/session (localStorage). Dismissible.
 * Mục đích: bắt lead cuối cùng trước khi user rời trang /plans.
 */
import { useEffect, useState } from 'react';

const LS_KEY = 'ech.plans.exit-popup.dismissed';

export function PlansExitPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(LS_KEY)) return;

    let triggered = false;
    function onMouseLeave(e: MouseEvent) {
      if (triggered) return;
      // Rời lên phía trên viewport (top bar / close tab / back)
      if (e.clientY < 10) {
        triggered = true;
        setOpen(true);
      }
    }
    // Trên mobile không có mouseleave → dùng scroll depth 70% + idle 30s làm proxy
    let scrollTriggered = false;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    function onScroll() {
      const scrolled = (window.scrollY + window.innerHeight) / document.body.scrollHeight;
      if (scrolled > 0.7 && !scrollTriggered) {
        scrollTriggered = true;
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          if (!triggered) { triggered = true; setOpen(true); }
        }, 30000);
      }
    }

    document.addEventListener('mouseleave', onMouseLeave);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('scroll', onScroll);
      clearTimeout(idleTimer);
    };
  }, []);

  function close() {
    setOpen(false);
    try { localStorage.setItem(LS_KEY, '1'); } catch { /* ignore */ }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4 animate-in fade-in"
      onClick={close}>
      <div className="bg-gray-900 border-2 border-brand-500 rounded-2xl p-6 md:p-8 max-w-md w-full relative"
        onClick={e => e.stopPropagation()}>
        <button onClick={close} className="absolute top-3 right-3 text-gray-500 hover:text-white text-xl">×</button>
        <div className="text-4xl text-center mb-3">🎁</div>
        <h3 className="text-xl md:text-2xl font-bold text-white text-center mb-2">
          Trước khi đi — nhận tư vấn 15 phút miễn phí?
        </h3>
        <p className="text-sm text-gray-400 text-center mb-6">
          Chuyên gia marketing sẽ nghe qua shop bạn, đề xuất gói phù hợp nhất (kể cả không gói nào của ECH nếu shop chưa cần).
          Không sales pressure, không cam kết.
        </p>
        <div className="space-y-3">
          <a href="https://zalo.me/hieuduc87" target="_blank" rel="noreferrer"
            className="block bg-brand-500 hover:bg-brand-400 text-white font-bold py-3 rounded-lg text-center">
            💬 Chat Zalo miễn phí
          </a>
          <a href="/login" onClick={close}
            className="block bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-lg text-center text-sm">
            🎁 Hoặc thử miễn phí 30 ngày trước
          </a>
          <button onClick={close} className="block w-full text-xs text-gray-500 hover:text-white py-1">
            Không, cảm ơn
          </button>
        </div>
      </div>
    </div>
  );
}

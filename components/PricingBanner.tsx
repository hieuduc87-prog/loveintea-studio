'use client';
/**
 * PricingBanner — banner sticky top hiện trong app khi:
 *   - Trial còn ≤7 ngày HOẶC
 *   - Bất kỳ quota (ảnh/video/content) đã dùng ≥80%
 * Dismiss thì ẩn 24h (localStorage). Link tới /plans để nâng gói.
 *
 * Đặt vào AppShell layout đầu — user thấy khi mở dashboard.
 */
import { useEffect, useState } from 'react';

const LS_KEY = 'ech.pricing-banner.dismissed-until';

interface UsagePack { used: number; limit: number; remaining: number; percent: number; }
interface UsageResp {
  plan?: string;
  video?: UsagePack; image?: UsagePack; content?: UsagePack;
  trialExpiresAt?: string; // ISO date nếu có
}

export function PricingBanner() {
  const [visible, setVisible] = useState(false);
  const [msg, setMsg] = useState('');
  const [severity, setSeverity] = useState<'info' | 'warn' | 'danger'>('info');

  useEffect(() => {
    // check dismissed
    try {
      const until = Number(localStorage.getItem(LS_KEY) || '0');
      if (until > Date.now()) return;
    } catch { /* ignore */ }

    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/usage');
        if (!r.ok) return;
        const d = await r.json() as UsageResp;
        if (cancelled) return;

        // Tìm quota %-cao nhất
        const packs = [
          { name: 'ảnh', pack: d.image },
          { name: 'video', pack: d.video },
          { name: 'caption', pack: d.content },
        ].filter(x => x.pack && x.pack.limit > 0);
        if (packs.length === 0) return;

        const worst = packs.reduce((a, b) => ((b.pack!.percent) > (a.pack!.percent) ? b : a));
        const p = worst.pack!.percent;

        if (p >= 100) {
          setSeverity('danger');
          setMsg(`Hết hạn mức ${worst.name} tháng này (${worst.pack!.used}/${worst.pack!.limit}). Nâng gói để tiếp tục tạo.`);
          setVisible(true);
        } else if (p >= 80) {
          setSeverity('warn');
          setMsg(`Đã dùng ${p}% hạn mức ${worst.name} (${worst.pack!.used}/${worst.pack!.limit}). Xem gói nâng cấp.`);
          setVisible(true);
        }
        // TODO: trial expiry banner khi API expose trialExpiresAt
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, []);

  function dismiss() {
    setVisible(false);
    try { localStorage.setItem(LS_KEY, String(Date.now() + 24 * 60 * 60 * 1000)); } catch { /* ignore */ }
  }

  if (!visible) return null;

  const bg = severity === 'danger' ? 'bg-red-500/90' : severity === 'warn' ? 'bg-amber-500/90' : 'bg-brand-500/90';

  return (
    <div className={`${bg} text-white text-sm px-4 py-2.5 flex items-center justify-center gap-3 flex-wrap`}>
      <span className="font-semibold">{severity === 'danger' ? '🚫' : '⚠️'} {msg}</span>
      <a href="/plans" target="_blank" rel="noreferrer"
        className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded font-semibold text-xs">
        Xem gói nâng cấp →
      </a>
      <button onClick={dismiss} className="text-white/70 hover:text-white text-xs ml-2">
        Đóng
      </button>
    </div>
  );
}

'use client';

/**
 * Dashboard — landing view. One glance answers:
 *  1. Hệ thống có khỏe không? (FB token, AI, scheduler)
 *  2. Hôm nay có gì sắp đăng? Có gì failed cần xử lý?
 *  3. Vòng lặp học (Measure → Learn) đang ở đâu?
 */

import { useCallback, useEffect, useState } from 'react';

interface TokenHealth {
  configured: boolean; valid: boolean; expiresAt: string | null;
  daysLeft: number | null; pageName: string; error: string; checkedAt: string;
}
interface Health {
  facebook: { token: TokenHealth | null; igConfigured: boolean };
  scheduler: { alive: boolean; lastTick: string | null };
  ai: { gemini: boolean; openai: boolean; openaiBackup: boolean; textFallbackActive: boolean; textFallbackAt: string | null };
  funnel: { draft: number; scheduled: number; published: number; failed: number; publishedLast7d: number };
  upcoming: Array<{ id: string; caption: string | null; platforms: string | null; scheduled_at: string; image_url: string | null }>;
  failures: Array<{ post_id: string; platform: string; error: string | null; created_at: string; caption: string | null }>;
  intelligence: { metricsRows: number; lastMetricsSync: string | null; scoreboardAngles: number; activeRules: number };
}
interface ScoreEntry { angle: string; channel: string; verdict: string; saves: number; reach: number; sample_size: number }

function StatusDot({ ok, warn }: { ok: boolean; warn?: boolean }) {
  const color = ok ? (warn ? 'bg-amber-400' : 'bg-emerald-400') : 'bg-red-500';
  return <span className={`inline-block w-2 h-2 rounded-full ${color} ${ok && !warn ? '' : 'animate-pulse'}`} />;
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso.includes('Z') || iso.includes('+') ? iso : iso + 'Z');
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function DashboardView({ brandId, onNavigate }: { brandId: string; onNavigate?: (tab: string) => void }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async (live = false) => {
    try {
      const [hr, sr] = await Promise.all([
        fetch(`/api/health${live ? '?live=1' : ''}`),
        fetch(`/api/scoreboard?brandId=${brandId}`),
      ]);
      const h = await hr.json();
      const s = await sr.json();
      setHealth(h);
      setScores((s.entries ?? []) as ScoreEntry[]);
    } catch { /* keep last state */ }
    setLoading(false);
  }, [brandId]);

  useEffect(() => { load(); }, [load]);

  async function recheckToken() {
    setChecking(true);
    await load(true);
    setChecking(false);
  }

  if (loading || !health) {
    return <div className="p-6 text-sm text-gray-500">Đang tải tình trạng hệ thống…</div>;
  }

  const fb = health.facebook.token;
  const fbOk = Boolean(fb?.configured && fb?.valid);
  const fbWarn = fbOk && fb?.daysLeft !== null && fb!.daysLeft! < 14;
  const aiOk = health.ai.gemini && health.ai.openai;
  const aiWarn = health.ai.textFallbackActive;
  const scaleAngles = scores.filter(s => s.verdict === 'SCALE').slice(0, 3);
  const retireAngles = scores.filter(s => s.verdict === 'RETIRE').slice(0, 3);

  const go = (tab: string) => onNavigate?.(tab);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      {/* ── Alert banner: anything broken shows here first ── */}
      {(!fbOk || !health.scheduler.alive || health.funnel.failed > 0 || aiWarn) && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 space-y-1">
          <p className="text-xs font-bold text-red-300 uppercase tracking-wide">⚠ Cần chú ý</p>
          {!fb?.configured && <p className="text-xs text-red-200">Facebook chưa kết nối — vào <button onClick={() => go('publisher')} className="underline font-semibold">Channels</button> để kết nối.</p>}
          {fb?.configured && !fb?.valid && <p className="text-xs text-red-200">FB token hết hạn/không hợp lệ: {fb.error} — vào <button onClick={() => go('publisher')} className="underline font-semibold">Channels</button> kết nối lại.</p>}
          {fbWarn && <p className="text-xs text-amber-200">FB token còn {fb!.daysLeft} ngày — nên gia hạn sớm.</p>}
          {!health.scheduler.alive && <p className="text-xs text-red-200">Scheduler không chạy — post hẹn giờ sẽ KHÔNG tự đăng. Kiểm tra server/container.</p>}
          {health.funnel.failed > 0 && <p className="text-xs text-red-200">{health.funnel.failed} post đăng thất bại — xem <button onClick={() => go('content_queue')} className="underline font-semibold">Review & Queue</button>.</p>}
          {aiWarn && <p className="text-xs text-amber-200">Gemini đang lỗi — hệ thống đang dùng OpenAI backup (từ {fmtTime(health.ai.textFallbackAt)}). Chất lượng không đổi, chi phí cao hơn nhẹ.</p>}
        </div>
      )}

      {/* ── Funnel stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Draft / chờ duyệt', value: health.funnel.draft, tab: 'content_queue', accent: 'text-gray-200' },
          { label: 'Đã hẹn giờ', value: health.funnel.scheduled, tab: 'content_queue', accent: 'text-sky-300' },
          { label: 'Đã đăng (7 ngày)', value: health.funnel.publishedLast7d, tab: 'analytics', accent: 'text-emerald-300' },
          { label: 'Thất bại', value: health.funnel.failed, tab: 'content_queue', accent: health.funnel.failed > 0 ? 'text-red-400' : 'text-gray-500' },
        ].map(c => (
          <button key={c.label} onClick={() => go(c.tab)}
            className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 text-left hover:border-gray-700 transition-colors">
            <p className={`text-2xl font-bold ${c.accent}`}>{c.value}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{c.label}</p>
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* ── System health ── */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wide">Tình trạng hệ thống</h3>
            <button onClick={recheckToken} disabled={checking}
              className="text-[10px] text-gray-500 hover:text-white px-2 py-1 rounded bg-gray-800 disabled:opacity-50">
              {checking ? 'Đang kiểm tra…' : '↻ Kiểm tra lại'}
            </button>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <StatusDot ok={fbOk} warn={fbWarn} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white">Facebook Page {fb?.pageName ? `— ${fb.pageName}` : ''}</p>
                <p className="text-[10px] text-gray-500">
                  {!fb?.configured ? 'Chưa kết nối'
                    : !fb.valid ? `Token lỗi: ${fb.error.slice(0, 60)}`
                    : fb.daysLeft === null ? 'Token never-expiring ✓'
                    : `Token còn ${fb.daysLeft} ngày`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <StatusDot ok={health.facebook.igConfigured} warn={!health.facebook.igConfigured} />
              <div className="flex-1">
                <p className="text-xs text-white">Instagram Business</p>
                <p className="text-[10px] text-gray-500">{health.facebook.igConfigured ? 'Đã liên kết' : 'Chưa liên kết (link qua FB Business Settings rồi Connect lại)'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <StatusDot ok={health.scheduler.alive} />
              <div className="flex-1">
                <p className="text-xs text-white">Scheduler (auto-publish + metrics)</p>
                <p className="text-[10px] text-gray-500">{health.scheduler.alive ? `Đang chạy — tick ${fmtTime(health.scheduler.lastTick)}` : 'KHÔNG chạy'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <StatusDot ok={aiOk} warn={aiWarn} />
              <div className="flex-1">
                <p className="text-xs text-white">AI Engines</p>
                <p className="text-[10px] text-gray-500">
                  Gemini {health.ai.gemini ? '✓' : '✗'} · OpenAI {health.ai.openai ? '✓' : '✗'}
                  {health.ai.openaiBackup ? ' · Backup key ✓' : ''}
                  {aiWarn ? ' — đang chạy trên backup' : ''}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Upcoming scheduled ── */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wide">Sắp đăng</h3>
            <button onClick={() => go('content_queue')} className="text-[10px] text-brand-400 hover:underline">Xem tất cả →</button>
          </div>
          {health.upcoming.length === 0 ? (
            <p className="text-xs text-gray-600 py-4 text-center">Chưa có post nào hẹn giờ.<br />
              <button onClick={() => go('content_workshop')} className="text-brand-400 hover:underline mt-1">Tạo content mới →</button>
            </p>
          ) : (
            <div className="space-y-2">
              {health.upcoming.map(p => (
                <div key={p.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-gray-800/50">
                  {p.image_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={p.image_url} alt="" className="w-9 h-9 rounded-md object-cover flex-shrink-0" />
                    : <div className="w-9 h-9 rounded-md bg-gray-700 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-200 truncate">{p.caption?.slice(0, 70) || '(no caption)'}</p>
                    <p className="text-[10px] text-gray-500">{fmtTime(p.scheduled_at)} · {p.platforms}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* ── Learning loop ── */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wide">Vòng lặp học (Measure → Learn)</h3>
            <button onClick={() => go('scoreboard')} className="text-[10px] text-brand-400 hover:underline">Scoreboard →</button>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="rounded-lg bg-gray-800/50 p-2.5 text-center">
              <p className="text-lg font-bold text-white">{health.intelligence.metricsRows}</p>
              <p className="text-[9px] text-gray-500">metrics rows</p>
            </div>
            <div className="rounded-lg bg-gray-800/50 p-2.5 text-center">
              <p className="text-lg font-bold text-white">{health.intelligence.scoreboardAngles}</p>
              <p className="text-[9px] text-gray-500">angles chấm điểm</p>
            </div>
            <div className="rounded-lg bg-gray-800/50 p-2.5 text-center">
              <p className="text-lg font-bold text-white">{health.intelligence.activeRules}</p>
              <p className="text-[9px] text-gray-500">rules active</p>
            </div>
          </div>
          {scaleAngles.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] font-semibold text-emerald-400 mb-1">📈 SCALE — nhân bản các góc này</p>
              {scaleAngles.map(s => (
                <p key={s.angle + s.channel} className="text-[11px] text-gray-300">• {s.angle} ({s.channel}) — {s.saves} saves / {s.sample_size} bài</p>
              ))}
            </div>
          )}
          {retireAngles.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-red-400 mb-1">📉 RETIRE — ngừng các góc này</p>
              {retireAngles.map(s => (
                <p key={s.angle + s.channel} className="text-[11px] text-gray-400">• {s.angle} ({s.channel})</p>
              ))}
            </div>
          )}
          {scaleAngles.length === 0 && retireAngles.length === 0 && (
            <p className="text-[11px] text-gray-600">Chưa đủ dữ liệu — đăng ≥10 bài và chờ metrics sync (tự động mỗi 6h). Sync gần nhất: {fmtTime(health.intelligence.lastMetricsSync)}</p>
          )}
        </div>

        {/* ── Recent failures + quick actions ── */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
          <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wide mb-3">Lỗi gần đây & thao tác nhanh</h3>
          {health.failures.length > 0 ? (
            <div className="space-y-1.5 mb-4">
              {health.failures.map((f, i) => (
                <div key={i} className="p-2 rounded-lg bg-red-500/5 border border-red-500/20">
                  <p className="text-[11px] text-red-300 truncate">[{f.platform}] {f.error?.slice(0, 80)}</p>
                  <p className="text-[9px] text-gray-600">{fmtTime(f.created_at)} · {f.caption?.slice(0, 40)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-gray-600 mb-4">Không có lỗi đăng bài trong 7 ngày qua ✓</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => go('content_workshop')} className="px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-colors">✍️ Tạo content</button>
            <button onClick={() => go('content_queue')} className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold transition-colors">✅ Duyệt queue</button>
            <button onClick={() => go('calendar')} className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold transition-colors">🗓️ Lịch đăng</button>
            <button onClick={() => go('publisher')} className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold transition-colors">📡 Kênh & token</button>
          </div>
        </div>
      </div>
    </div>
  );
}

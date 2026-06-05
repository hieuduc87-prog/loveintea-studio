'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';

interface PaymentPlan {
  id: string; name: string; type: string; price: number;
  description: string; features: string; is_active: number;
}
interface SubStatus {
  hasSetup: boolean; hasActiveSub: boolean; isActive: boolean;
  subscription: Record<string, unknown> | null;
}
interface OrderData {
  orderId: string; amount: number; planName: string; planType: string;
  qrUrl: string; transferContent: string; expiresAt: string;
  bankInfo: { bankName: string; accountNo: string; accountNoFull: string; accountName: string };
}
interface HistoryItem {
  order_id: string; status: string; amount: number; plan_name: string;
  plan_type: string; created_at: string; paid_at: string | null;
}

function fmtVND(n: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
}

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [secs, setSecs] = useState(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
  useEffect(() => {
    const iv = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return <span className={secs < 120 ? 'text-red-400' : 'text-yellow-400'}>{m}:{s}</span>;
}

export function PaymentView() {
  const { data: session } = useSession();
  const [plans, setPlans]       = useState<PaymentPlan[]>([]);
  const [subStatus, setSubStatus] = useState<SubStatus | null>(null);
  const [history, setHistory]   = useState<HistoryItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [order, setOrder]       = useState<OrderData | null>(null);
  const [creating, setCreating] = useState('');
  const [pollStatus, setPollStatus] = useState<string>('');
  const [copied, setCopied]     = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/payment/plans');
    const d = await r.json() as { plans: PaymentPlan[]; subStatus: SubStatus | null; history: HistoryItem[] };
    setPlans(d.plans ?? []);
    setSubStatus(d.subStatus);
    setHistory(d.history ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll for payment confirmation
  useEffect(() => {
    if (!order) { if (pollRef.current) clearInterval(pollRef.current); return; }
    pollRef.current = setInterval(async () => {
      const r = await fetch(`/api/payment/status?orderId=${order.orderId}`);
      const d = await r.json() as { status: string; expired?: boolean };
      if (d.status === 'paid') {
        setPollStatus('paid');
        clearInterval(pollRef.current!);
        await load(); // refresh sub status
      } else if (d.expired) {
        setPollStatus('expired');
        clearInterval(pollRef.current!);
      }
    }, 5000); // poll every 5s

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [order, load]);

  async function buyPlan(planId: string) {
    setCreating(planId);
    setPollStatus('');
    const r = await fetch('/api/payment/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId }),
    });
    const d = await r.json() as OrderData & { error?: string };
    if (d.error) { alert(d.error); setCreating(''); return; }
    setOrder(d);
    setCreating('');
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    });
  }

  const setupPlan = plans.find(p => p.type === 'setup_once');
  const subPlan   = plans.find(p => p.type === 'subscription_monthly');

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Loading…</div>;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-base font-semibold text-white">Thanh Toán & Gói Dịch Vụ</h2>
        <p className="text-xs text-gray-500 mt-0.5">Bank transfer tự động — không cần thao tác thủ công</p>
      </div>

      {/* Active subscription badge */}
      {subStatus?.hasActiveSub && (
        <div className="flex items-center gap-3 p-4 bg-green-900/20 border border-green-800/50 rounded-xl">
          <span className="text-2xl">✅</span>
          <div>
            <p className="text-sm font-semibold text-white">Studio Pro đang hoạt động</p>
            {subStatus.subscription && (
              <p className="text-xs text-green-400">
                Gia hạn: {new Date(subStatus.subscription.current_period_end as string).toLocaleDateString('vi-VN')}
              </p>
            )}
          </div>
          <button onClick={load} className="ml-auto text-xs text-gray-500 hover:text-white">Làm mới</button>
        </div>
      )}

      {subStatus?.hasSetup && !subStatus.hasActiveSub && (
        <div className="p-4 bg-gray-800 border border-gray-700 rounded-xl">
          <p className="text-sm text-gray-300">✓ Setup đã hoàn tất. Đăng ký Studio Pro để dùng đầy đủ tính năng AI.</p>
        </div>
      )}

      {/* Payment QR modal */}
      {order && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <div>
              <p className="text-sm font-semibold text-white">Thanh toán: {order.planName}</p>
              <p className="text-xs text-gray-500">Hết hạn trong <Countdown expiresAt={order.expiresAt} /></p>
            </div>
            {pollStatus === 'paid' ? (
              <span className="px-3 py-1 bg-green-700 text-white text-xs font-bold rounded-full">✓ Đã thanh toán!</span>
            ) : pollStatus === 'expired' ? (
              <span className="px-3 py-1 bg-red-800 text-white text-xs font-bold rounded-full">Hết hạn</span>
            ) : (
              <span className="px-3 py-1 bg-yellow-800/50 text-yellow-300 text-xs rounded-full animate-pulse">Đang chờ…</span>
            )}
          </div>

          {pollStatus === 'paid' ? (
            <div className="p-8 text-center space-y-3">
              <p className="text-4xl">🎉</p>
              <p className="text-lg font-bold text-white">Thanh toán thành công!</p>
              <p className="text-gray-400 text-sm">Gói dịch vụ đã được kích hoạt.</p>
              <button onClick={() => { setOrder(null); setPollStatus(''); load(); }}
                className="mt-2 px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-xl transition-colors">
                Đóng
              </button>
            </div>
          ) : (
            <div className="p-5 flex flex-col md:flex-row gap-6 items-start">
              {/* QR Code */}
              <div className="flex-shrink-0 text-center">
                {order.qrUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={order.qrUrl} alt="VietQR" className="w-52 h-52 rounded-xl border border-gray-700" />
                ) : (
                  <div className="w-52 h-52 rounded-xl border border-dashed border-gray-700 flex items-center justify-center text-gray-500 text-xs text-center px-4">
                    QR không khả dụng<br />(chưa cấu hình số tài khoản)
                  </div>
                )}
                <p className="text-[10px] text-gray-500 mt-1">Quét bằng app ngân hàng</p>
              </div>

              {/* Transfer info */}
              <div className="flex-1 space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Thông tin chuyển khoản</p>

                {[
                  { label: 'Ngân hàng', value: order.bankInfo.bankName, key: 'bank' },
                  { label: 'Số tài khoản', value: order.bankInfo.accountNoFull || order.bankInfo.accountNo, key: 'acct' },
                  { label: 'Chủ tài khoản', value: order.bankInfo.accountName, key: 'name' },
                  { label: 'Số tiền', value: fmtVND(order.amount), key: 'amt' },
                  { label: 'Nội dung CK ★', value: order.transferContent, key: 'content' },
                ].map(({ label, value, key }) => (
                  <div key={key} className={`flex items-center justify-between p-3 rounded-xl ${
                    key === 'content' ? 'bg-brand-600/15 border border-brand-600/30' : 'bg-gray-800'
                  }`}>
                    <div>
                      <p className="text-[10px] text-gray-500">{label}</p>
                      <p className={`text-sm font-mono font-semibold ${key === 'content' ? 'text-brand-300' : 'text-white'}`}>
                        {value || '—'}
                      </p>
                    </div>
                    {value && (
                      <button onClick={() => copy(value, key)}
                        className="text-[10px] px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors flex-shrink-0 ml-3">
                        {copied === key ? '✓ Đã copy' : 'Copy'}
                      </button>
                    )}
                  </div>
                ))}

                <p className="text-[10px] text-yellow-400 bg-yellow-900/20 border border-yellow-800/30 rounded-lg px-3 py-2">
                  ⚠️ <strong>Quan trọng:</strong> Nội dung chuyển khoản phải đúng chính xác <code className="bg-black/30 px-1 rounded">{order.transferContent}</code> để hệ thống tự xác nhận.
                </p>

                <div className="flex gap-2">
                  <button onClick={() => { setOrder(null); setPollStatus(''); }}
                    className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-xl transition-colors">
                    Huỷ
                  </button>
                  <button onClick={load}
                    className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-xl transition-colors">
                    Kiểm tra lại
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Plans grid */}
      {!order && (
        <div className="grid md:grid-cols-2 gap-4">
          {[setupPlan, subPlan].filter(Boolean).map(plan => {
            if (!plan) return null;
            const features = JSON.parse(plan.features || '[]') as string[];
            const isSetup = plan.type === 'setup_once';
            const isCurrent = isSetup ? subStatus?.hasSetup : subStatus?.hasActiveSub;

            return (
              <div key={plan.id}
                className={`bg-gray-900 border rounded-2xl overflow-hidden flex flex-col ${
                  isSetup ? 'border-gray-800' : 'border-brand-800/50 ring-1 ring-brand-700/30'
                }`}>
                {!isSetup && (
                  <div className="bg-brand-600/20 text-brand-300 text-[10px] font-bold uppercase tracking-widest text-center py-1.5 px-3">
                    ⭐ Phổ biến nhất
                  </div>
                )}
                <div className="p-5 flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold text-white">{plan.name}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {isSetup ? 'Thanh toán 1 lần' : 'Hàng tháng'}
                      </p>
                    </div>
                    {isCurrent && (
                      <span className="text-[10px] bg-green-900/40 text-green-400 border border-green-800/50 px-2 py-0.5 rounded-full">
                        Đang dùng
                      </span>
                    )}
                  </div>

                  <p className="text-2xl font-bold text-white mb-1">{fmtVND(plan.price)}</p>
                  <p className="text-xs text-gray-500 mb-4">{plan.description}</p>

                  <ul className="space-y-1.5">
                    {features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                        <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="px-5 pb-5">
                  <button
                    onClick={() => buyPlan(plan.id)}
                    disabled={!!creating || isCurrent}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                      isCurrent ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                        : isSetup ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-brand-600 hover:bg-brand-700 text-white'
                    }`}
                  >
                    {creating === plan.id ? '⟳ Đang tạo…'
                      : isCurrent ? (isSetup ? '✓ Đã thiết lập' : '✓ Đang hoạt động')
                      : isSetup ? 'Thanh toán Setup'
                      : subStatus?.hasActiveSub ? 'Gia hạn thêm 30 ngày'
                      : 'Đăng ký Studio Pro'
                    }
                  </button>
                  {!isCurrent && (
                    <p className="text-[10px] text-gray-600 text-center mt-2">
                      Chuyển khoản ngân hàng · Xác nhận tự động qua Casso
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Payment history */}
      {history.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <p className="px-4 py-3 border-b border-gray-800 text-xs font-bold text-gray-500 uppercase tracking-widest">Lịch sử thanh toán</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] text-gray-600 uppercase tracking-wider border-b border-gray-800">
                <th className="text-left px-4 py-2 font-medium">Mã đơn</th>
                <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Gói</th>
                <th className="text-right px-3 py-2 font-medium">Số tiền</th>
                <th className="text-center px-3 py-2 font-medium">Trạng thái</th>
                <th className="text-right px-4 py-2 font-medium hidden md:table-cell">Ngày</th>
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.order_id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-[11px] text-gray-400">{h.order_id}</td>
                  <td className="px-3 py-2.5 hidden sm:table-cell text-gray-300">{h.plan_name}</td>
                  <td className="px-3 py-2.5 text-right text-white">{fmtVND(h.amount)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      h.status === 'paid' ? 'bg-green-900/40 text-green-300'
                        : h.status === 'expired' ? 'bg-gray-800 text-gray-500'
                        : 'bg-yellow-900/40 text-yellow-300'
                    }`}>
                      {h.status === 'paid' ? '✓ Đã thanh toán' : h.status === 'expired' ? 'Hết hạn' : 'Chờ'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-500 hidden md:table-cell">
                    {h.paid_at
                      ? new Date(h.paid_at).toLocaleDateString('vi-VN')
                      : new Date(h.created_at).toLocaleDateString('vi-VN')
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Admin: webhook URL hint */}
      {(session?.user as Record<string, unknown>)?.role === 'root_admin' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Admin: Casso Config</p>
          <p className="text-xs text-gray-500">
            Casso Webhook URL: <code className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">
              {typeof window !== 'undefined' ? window.location.origin : 'https://loveintea.wealthpsy.com'}/api/payment/webhook
            </code>
          </p>
          <p className="text-[10px] text-gray-600">
            Env vars cần thiết: BANK_BIN, BANK_ACCOUNT_NO, BANK_ACCOUNT_NAME, CASSO_SECURE_TOKEN
          </p>
        </div>
      )}
    </div>
  );
}

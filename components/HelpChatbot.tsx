'use client';

/**
 * HelpChatbot — nút "?" floating bottom-right + panel chat.
 * Tuyến 1: bot trả tự động (Gemini đọc docs/huong-dan-su-dung-video.md + context view).
 * Tuyến 2: nút "Không giải quyết được — tạo yêu cầu hỗ trợ" → 1-click tạo card kanban
 * (kết hợp vòng kín kanban tự-fix). Giảm nhân sự vận hành: khách tự trợ giúp trước, chỉ
 * escalate khi thật sự cần.
 */
import { useState, useRef, useEffect } from 'react';

interface Props { activeBrandId: string; activeView: string; }
interface Msg { role: 'user' | 'bot'; text: string; }

export function HelpChatbot({ activeBrandId, activeView }: Props) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'bot', text: 'Chào bạn 👋 Mình là trợ lý Easy Creative Hub. Hỏi mình bất cứ điều gì về cách dùng — vd "làm sao gen ảnh sản phẩm", "chèn chữ lên ảnh thế nào", "tại sao FB không đăng được"…' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, open]);

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    setInput('');
    setMsgs(m => [...m, { role: 'user', text: q }]);
    setBusy(true);
    try {
      const r = await fetch('/api/help/ask', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, activeView, brandId: activeBrandId }),
      });
      const d = await r.json();
      setMsgs(m => [...m, { role: 'bot', text: d.answer || d.error || 'Xin lỗi, mình chưa trả lời được câu này.' }]);
    } catch {
      setMsgs(m => [...m, { role: 'bot', text: 'Lỗi mạng — thử lại nhé.' }]);
    } finally { setBusy(false); }
  }

  async function escalate() {
    if (escalated) return;
    // Sinh mô tả từ chat history — last 6 messages
    const conv = msgs.slice(-6).map(m => (m.role === 'user' ? '👤 ' : '🤖 ') + m.text).join('\n');
    const title = 'Yêu cầu hỗ trợ (chatbot escalate): ' + (msgs.filter(m => m.role === 'user').slice(-1)[0]?.text || 'Không có câu hỏi').slice(0, 60);
    try {
      const r = await fetch('/api/kanban', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: `Câu hỏi khách hỏi chatbot nhưng chưa được giải quyết.\n\nĐang ở màn: ${activeView}\n\nHội thoại:\n${conv}`,
          type: 'support', priority: 'medium', severity: 'annoying',
          reproSteps: msgs.filter(m => m.role === 'user').map(m => m.text).join(' → '),
        }),
      });
      if (!r.ok) throw new Error('kanban fail');
      setEscalated(true);
      setMsgs(m => [...m, { role: 'bot', text: '✅ Đã tạo yêu cầu hỗ trợ trên hệ thống. Đội kỹ thuật sẽ xử lý và phản hồi sớm nhất. Bạn có thể tiếp tục làm việc, không cần chờ.' }]);
    } catch {
      setMsgs(m => [...m, { role: 'bot', text: '❌ Không tạo được yêu cầu — bạn liên hệ admin trực tiếp giúp mình.' }]);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 w-13 h-13 bg-brand-600 hover:bg-brand-500 text-white rounded-full shadow-2xl flex items-center justify-center text-2xl transition-transform hover:scale-110 z-50"
        aria-label="Trợ giúp"
        style={{ width: 52, height: 52 }}>
        💬
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 w-[400px] max-w-[calc(100vw-2.5rem)] h-[560px] max-h-[calc(100vh-2.5rem)] bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl flex flex-col z-50">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-lg">💬</span>
          <div>
            <div className="text-sm font-semibold text-white">Trợ lý Easy Creative Hub</div>
            <div className="text-[10px] text-gray-500">Hỏi mình — trả lời tức thì · Không giải quyết được thì escalate</div>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white text-sm">✕</button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
              m.role === 'user' ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-100'
            }`}>{m.text}</div>
          </div>
        ))}
        {busy && <div className="flex justify-start"><div className="bg-gray-800 rounded-2xl px-3 py-2 text-sm text-gray-500">⏳ Đang nghĩ…</div></div>}
        <div ref={bottomRef} />
      </div>

      {/* Escalate button — sau 2 câu hỏi mà bot vẫn chưa giải quyết */}
      {msgs.filter(m => m.role === 'user').length >= 2 && !escalated && (
        <button onClick={escalate}
          className="mx-4 mb-2 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-600/50 text-yellow-300 text-xs py-2 rounded-lg">
          🛎 Không giải quyết được — tạo yêu cầu hỗ trợ (đội kỹ thuật xem)
        </button>
      )}

      <div className="p-3 border-t border-gray-800">
        <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !busy && send()}
            placeholder="Nhập câu hỏi…"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
          <button onClick={send} disabled={busy || !input.trim()}
            className="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm">
            Gửi
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import Image from 'next/image';
import { useRef, useState, useEffect } from 'react';
import { KnowledgeHubView } from './KnowledgeHubView';
import { RulesEngineView } from './RulesEngineView';
import { KnowledgeMindmapView } from './KnowledgeMindmapView';

interface BrandDna {
  tagline: string; archetype: string;
  colors_json: string; voice_traits: string;
  compliance_json: string; hashtags: string;
  target_audience?: string; insight?: string; behavior?: string; brand_rules?: string;
}
interface ProductRow {
  id: string; name: string; display_name: string; theme: string;
  color: string; ingredients: string; image_url: string; use_cases: string;
}
interface BrandRow { id: string; name: string; logo_url: string | null; }

function parse<T>(s: string, fallback: T): T {
  try { return JSON.parse(s); } catch { return fallback; }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">{title}</h2>
      {children}
    </div>
  );
}
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl p-4 ${className}`}>
      {children}
    </div>
  );
}

export function BrandDnaView({ brandId }: { brandId?: string } = {}) {
  const bid = brandId || 'loveintea';

  const [brand, setBrand]     = useState<BrandRow | null>(null);
  const [dna, setDna]         = useState<BrandDna | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);

  const voiceRef = useRef<HTMLInputElement>(null);
  const [voiceContent, setVoiceContent] = useState('');
  const [voiceMsg, setVoiceMsg]         = useState('');
  const [voiceUploading, setVoiceUploading] = useState(false);

  // Editable strategy fields
  const [strategy, setStrategy] = useState({ target_audience: '', insight: '', behavior: '', brand_rules: '' });
  const [stratDirty, setStratDirty] = useState(false);
  const [stratSaving, setStratSaving] = useState(false);
  const [stratMsg, setStratMsg] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/brands/${bid}`).then(r => r.json()),
      fetch('/api/brand-voice').then(r => r.json()),
    ]).then(([bd, bv]) => {
      setBrand(bd.brand || null);
      setDna(bd.dna || null);
      setProducts(bd.products || []);
      setStrategy({
        target_audience: bd.dna?.target_audience || '', insight: bd.dna?.insight || '',
        behavior: bd.dna?.behavior || '', brand_rules: bd.dna?.brand_rules || '',
      });
      setStratDirty(false);
      if (bv.content) setVoiceContent(bv.content);
      setLoading(false);
    });
  }, [bid]);

  async function saveStrategy() {
    setStratSaving(true); setStratMsg('');
    const r = await fetch(`/api/brands/${bid}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dna: strategy }),
    });
    const d = await r.json() as { ok?: boolean; error?: string };
    setStratMsg(d.ok ? '✓ Đã lưu' : '✗ ' + (d.error ?? 'Lỗi'));
    setStratDirty(false); setStratSaving(false);
    setTimeout(() => setStratMsg(''), 2500);
  }

  const [section, setSection] = useState<'dna' | 'knowledge' | 'rules' | 'mindmap'>('dna');
  const [extracting, setExtracting] = useState(false);
  const dnaFileRef = useRef<HTMLInputElement>(null);

  async function extractFromDocs() {
    setExtracting(true); setStratMsg('');
    try {
      const r = await fetch(`/api/brands/${bid}/dna/extract`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await r.json() as { ok?: boolean; fields?: typeof strategy; sources?: string[]; error?: string };
      if (d.ok && d.fields) {
        setStrategy(d.fields); setStratDirty(true);
        setStratMsg(`✓ Đã tổng hợp từ ${d.sources?.length ?? 0} tài liệu — xem lại rồi bấm Lưu`);
      } else setStratMsg('✗ ' + (d.error ?? 'Lỗi'));
    } catch (e) { setStratMsg('✗ ' + String(e)); }
    setExtracting(false);
  }

  async function extractFromFile(file: File) {
    setExtracting(true); setStratMsg('');
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch(`/api/brands/${bid}/dna/extract`, { method: 'POST', body: fd });
      const d = await r.json() as { ok?: boolean; fields?: typeof strategy; error?: string };
      if (d.ok && d.fields) {
        setStrategy(d.fields); setStratDirty(true);
        setStratMsg('✓ Đã trích từ file khách — xem lại rồi Lưu');
      } else setStratMsg('✗ ' + (d.error ?? 'Lỗi'));
    } catch (e) { setStratMsg('✗ ' + String(e)); }
    setExtracting(false);
  }

  async function uploadVoice(file: File) {
    setVoiceUploading(true); setVoiceMsg('');
    const fd = new FormData(); fd.append('file', file);
    const r = await fetch('/api/brand-voice', { method: 'POST', body: fd });
    const d = await r.json() as { ok?: boolean; length?: number; error?: string };
    if (d.ok) {
      setVoiceMsg(`✓ Saved (${d.length?.toLocaleString()} chars)`);
      fetch('/api/brand-voice').then(r2 => r2.json()).then(d2 => setVoiceContent(d2.content || ''));
    } else {
      setVoiceMsg('✗ ' + d.error);
    }
    setVoiceUploading(false);
    setTimeout(() => setVoiceMsg(''), 4000);
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Loading…</div>;
  if (!brand) return <div className="flex items-center justify-center h-64 text-gray-500">Brand not found</div>;

  const colors:    Record<string, string> = parse(dna?.colors_json  || '{}', {});
  const voiceTraits: string[]             = parse(dna?.voice_traits  || '[]', []);
  const compliance: { neverSay?: string[]; alwaysSay?: string[] }
                                          = parse(dna?.compliance_json || '{}', {});
  const hashtags: string[]                = parse(dna?.hashtags || '[]', []);
  const colorEntries                      = Object.entries(colors).slice(0, 6);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Sub-tabs — Brand DNA absorbs Knowledge + Rules */}
      <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-0.5 w-fit mb-4">
        {([['dna', '🌿 DNA & Chiến lược'], ['knowledge', '🧠 Knowledge'], ['rules', '⚙️ Rules'], ['mindmap', '🗺️ Mindmap']] as const).map(([s, label]) => (
          <button key={s} onClick={() => setSection(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${section === s ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {section === 'knowledge' && <KnowledgeHubView brandId={bid} />}
      {section === 'rules' && <RulesEngineView brandId={bid} />}
      {section === 'mindmap' && <KnowledgeMindmapView brandId={bid} />}
      {section !== 'dna' ? null : (<>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 p-5 bg-gradient-to-r from-brand-600/20 to-transparent border border-brand-600/30 rounded-xl">
        <div className="w-14 h-14 rounded-xl bg-brand-600/30 flex items-center justify-center overflow-hidden flex-shrink-0">
          {brand.logo_url ? (
            <Image src={brand.logo_url} alt={brand.name} width={48} height={48} className="object-contain" />
          ) : (
            <span className="text-2xl">🏷️</span>
          )}
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">{brand.name} — Brand DNA</h1>
          <p className="text-gray-400 text-sm">{dna?.tagline || '—'} · {dna?.archetype || '—'}</p>
          {colorEntries.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              {colorEntries.map(([key, hex]) => (
                <span key={key} className="w-5 h-5 rounded-full border border-gray-700 flex-shrink-0"
                  style={{ backgroundColor: hex }} title={`${key}: ${hex}`} />
              ))}
            </div>
          )}
          {hashtags.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {hashtags.map(h => <span key={h} className="text-[10px] text-brand-300">{h}</span>)}
            </div>
          )}
        </div>
      </div>

      {/* Voice Traits */}
      {voiceTraits.length > 0 && (
        <Section title="Voice Traits (NON-NEGOTIABLE)">
          <div className="grid grid-cols-3 gap-3">
            {voiceTraits.map((t, i) => (
              <Card key={i}>
                <p className="text-sm text-white font-medium">{t.split(' — ')[0]}</p>
                <p className="text-xs text-gray-400 mt-1">{t.split(' — ')[1] || ''}</p>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {/* Audience & Strategy — editable, feeds every AI prompt */}
      <Section title="Đối tượng & Chiến lược (đưa vào mọi prompt AI)">
        <Card>
          <div className="flex items-center gap-2 mb-3 flex-wrap bg-brand-900/20 border border-brand-700/30 rounded-lg px-3 py-2">
            <span className="text-[11px] text-gray-300">Đã có tài liệu trong hệ thống? Không cần gõ tay —</span>
            <button onClick={extractFromDocs} disabled={extracting}
              className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-bold">
              {extracting ? '⟳ AI đang đọc…' : '✨ Tổng hợp tất cả tài liệu đã có'}
            </button>
            <input ref={dnaFileRef} type="file" accept=".xlsx,.xls,.csv,.txt,.md,.docx,.json" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) extractFromFile(f); e.target.value = ''; }} />
            <button onClick={() => dnaFileRef.current?.click()} disabled={extracting}
              className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-200 text-xs font-semibold">
              📄 Nhập từ file khách gửi
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {([
              ['target_audience', '🎯 Khách hàng mục tiêu', 'Độ tuổi, giới tính, nghề nghiệp, nhu cầu…'],
              ['insight', '💡 Insight', 'Sự thật ngầm hiểu / nỗi đau / mong muốn sâu của khách'],
              ['behavior', '📲 Hành vi', 'Thói quen lướt mạng, giờ vàng, cách họ tương tác, mua hàng'],
              ['brand_rules', '📏 Rule riêng của brand', 'Quy tắc bắt buộc khi làm content cho brand này'],
            ] as const).map(([key, label, hint]) => (
              <div key={key}>
                <label className="block text-[11px] text-gray-400 mb-1">{label} <span className="text-gray-600">— {hint}</span></label>
                <textarea value={strategy[key]} onChange={e => { setStrategy(s => ({ ...s, [key]: e.target.value })); setStratDirty(true); }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white resize-none h-24 focus:border-brand-500 focus:outline-none" />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button onClick={saveStrategy} disabled={stratSaving || !stratDirty}
              className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-xs font-bold">
              {stratSaving ? '⟳' : stratDirty ? '💾 Lưu chiến lược' : '✓ Đã lưu'}
            </button>
            {stratMsg && <span className={`text-xs ${stratMsg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>{stratMsg}</span>}
          </div>
        </Card>
      </Section>

      {/* Products / SKUs */}
      {products.length > 0 && (
        <Section title={`${products.length} Product${products.length > 1 ? 's' : ''}`}>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map(p => {
              const ingredients = parse<string[]>(p.ingredients, []);
              const useCases    = parse<string[]>(p.use_cases, []);
              return (
                <Card key={p.id} className="flex gap-3">
                  <div className="w-16 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl">📦</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color || '#888' }} />
                      <span className="text-white font-semibold text-sm">{p.name}</span>
                    </div>
                    <p className="text-xs text-gray-400 mb-1">{p.theme}</p>
                    <p className="text-[10px] text-gray-500 leading-relaxed">{ingredients.slice(0, 3).join(' · ')}</p>
                    {useCases.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {useCases.map(u => (
                          <span key={u} className="text-[9px] bg-gray-800 text-gray-400 rounded px-1.5 py-0.5">{u}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </Section>
      )}

      {/* No DNA yet */}
      {!dna && (
        <Card className="text-center py-10">
          <p className="text-4xl mb-3">🌱</p>
          <p className="text-white font-medium">Brand DNA chưa được thiết lập</p>
          <p className="text-gray-500 text-sm mt-1">Liên hệ admin để nhập Brand DNA cho brand này</p>
        </Card>
      )}

      {/* Compliance Gate */}
      {compliance && (compliance.neverSay?.length || compliance.alwaysSay?.length) ? (
        <Section title="Compliance Gate — Hard Rules">
          <div className="grid grid-cols-2 gap-4">
            {compliance.neverSay && compliance.neverSay.length > 0 && (
              <Card>
                <p className="text-xs font-bold text-red-400 mb-2">❌ NEVER say:</p>
                <div className="flex flex-wrap gap-1">
                  {compliance.neverSay.map(w => (
                    <span key={w} className="text-xs bg-red-900/30 text-red-300 rounded px-1.5 py-0.5">{w}</span>
                  ))}
                </div>
              </Card>
            )}
            {compliance.alwaysSay && compliance.alwaysSay.length > 0 && (
              <Card>
                <p className="text-xs font-bold text-green-400 mb-2">✅ ALWAYS use:</p>
                <div className="space-y-1">
                  {compliance.alwaysSay.map(w => (
                    <p key={w} className="text-xs text-gray-300">• {w}</p>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </Section>
      ) : null}

      {/* Brand Voice Upload */}
      <Section title="Brand Voice — Upload Custom File">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400 mb-2">
                Upload .txt, .md, hoặc .docx để override brand voice mặc định khi generate content.
              </p>
              {voiceContent ? (
                <div className="bg-gray-800/50 rounded-lg p-3 max-h-32 overflow-y-auto">
                  <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {voiceContent.slice(0, 600)}{voiceContent.length > 600 ? '…' : ''}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-600 italic">Chưa có brand voice file — đang dùng default</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <input ref={voiceRef} type="file" accept=".txt,.md,.docx" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadVoice(f); e.target.value = ''; }} />
              <button onClick={() => voiceRef.current?.click()} disabled={voiceUploading}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs rounded-lg transition-colors whitespace-nowrap">
                {voiceUploading ? '⟳ Uploading…' : '⬆ Upload Voice File'}
              </button>
              {voiceMsg && <p className={`text-xs ${voiceMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{voiceMsg}</p>}
            </div>
          </div>
        </Card>
      </Section>
      </>)}
    </div>
  );
}

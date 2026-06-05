'use client';

import Image from 'next/image';
import { useRef, useState, useEffect } from 'react';
import { BRAND, SKUS, SEGMENTS, RTBS, USP_ANCHORS, NARRATIVES, CONTEXTS, FORMATS } from '@/lib/brand-dna';

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
  const voiceRef = useRef<HTMLInputElement>(null);
  const [voiceContent, setVoiceContent] = useState('');
  const [voiceMsg, setVoiceMsg] = useState('');
  const [voiceUploading, setVoiceUploading] = useState(false);

  useEffect(() => {
    fetch('/api/brand-voice').then(r => r.json()).then(d => { if (d.content) setVoiceContent(d.content); });
  }, []);

  async function uploadVoice(file: File) {
    setVoiceUploading(true); setVoiceMsg('');
    const fd = new FormData(); fd.append('file', file);
    const r = await fetch('/api/brand-voice', { method: 'POST', body: fd });
    const d = await r.json() as { ok?: boolean; length?: number; error?: string };
    if (d.ok) {
      setVoiceMsg(`✓ Saved (${d.length?.toLocaleString()} chars)`);
      const r2 = await fetch('/api/brand-voice');
      const d2 = await r2.json() as { content: string };
      setVoiceContent(d2.content);
    } else { setVoiceMsg('✗ ' + d.error); }
    setVoiceUploading(false);
    setTimeout(() => setVoiceMsg(''), 4000);
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 p-5 bg-gradient-to-r from-brand-600/20 to-transparent border border-brand-600/30 rounded-xl">
        <div className="w-14 h-14 rounded-xl bg-brand-600/30 flex items-center justify-center overflow-hidden flex-shrink-0">
          <Image src="/brand/logos/logo-green.png" alt="LoveinTea" width={48} height={48} className="object-contain" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">{BRAND.name} — Brand DNA</h1>
          <p className="text-gray-400 text-sm">{BRAND.tagline} · Source of Truth for all content production</p>
          <div className="flex items-center gap-2 mt-2">
            {Object.entries(BRAND.colors).slice(0, 5).map(([key, hex]) => (
              <span key={key} className="w-5 h-5 rounded-full border border-gray-700 flex-shrink-0" style={{ backgroundColor: hex }} title={`${key}: ${hex}`} />
            ))}
          </div>
        </div>
      </div>

      {/* Voice Traits */}
      <Section title="3 Voice Traits (NON-NEGOTIABLE)">
        <div className="grid grid-cols-3 gap-3">
          {BRAND.voiceTraits.map((t, i) => (
            <Card key={i}>
              <p className="text-sm text-white font-medium">{t.split(' — ')[0]}</p>
              <p className="text-xs text-gray-400 mt-1">{t.split(' — ')[1]}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* SKUs */}
      <Section title="6 SKUs — Product Line">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {SKUS.map(sku => (
            <Card key={sku.id} className="flex gap-3">
              <div className="w-16 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800">
                <Image src={sku.image} alt={sku.name} width={64} height={80} className="object-cover w-full h-full" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: sku.color }} />
                  <span className="text-white font-semibold text-sm">{sku.name}</span>
                </div>
                <p className="text-xs text-gray-400 mb-1">{sku.theme}</p>
                <p className="text-[10px] text-gray-500 leading-relaxed">{sku.ingredients.slice(0, 3).join(' · ')}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {sku.useCases.map(u => (
                    <span key={u} className="text-[9px] bg-gray-800 text-gray-400 rounded px-1.5 py-0.5">{u}</span>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* Logos */}
      <Section title="Logo System">
        <div className="flex gap-4 flex-wrap">
          {[
            { src: '/brand/logos/logo-green.png', label: 'Heritage Green', bg: 'bg-white' },
            { src: '/brand/logos/logo-coral.png', label: 'Love Coral', bg: 'bg-white' },
            { src: '/brand/logos/logo-white.png', label: 'Reversed White', bg: 'bg-brand-600' },
            { src: '/brand/logos/logo-black.jpg', label: 'Mono Black', bg: 'bg-white' },
          ].map(logo => (
            <Card key={logo.label} className="flex flex-col items-center gap-2 w-36">
              <div className={`w-24 h-16 rounded-lg ${logo.bg} flex items-center justify-center overflow-hidden`}>
                <Image src={logo.src} alt={logo.label} width={80} height={50} className="object-contain" />
              </div>
              <p className="text-xs text-gray-400">{logo.label}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* O3 Framework */}
      <div className="grid grid-cols-2 gap-6">
        <Section title="Audience Segments">
          <div className="space-y-2">
            {SEGMENTS.map(s => (
              <Card key={s.id} className="flex gap-3 items-start">
                <span className="text-xs font-bold text-brand-300 w-7 flex-shrink-0">{s.id}</span>
                <div>
                  <p className="text-sm text-white">{s.name} <span className="text-gray-500 text-xs">({s.age})</span></p>
                  <p className="text-xs text-gray-400 italic">"{s.tension}"</p>
                </div>
              </Card>
            ))}
          </div>
        </Section>

        <Section title="USP Anchors">
          <div className="space-y-2">
            {USP_ANCHORS.map(u => (
              <Card key={u.id} className="flex gap-3 items-start">
                <span className="text-xs font-bold text-coral-400 w-12 flex-shrink-0">{u.id}</span>
                <div>
                  <p className="text-sm text-white">{u.label}</p>
                  <p className="text-xs text-gray-400 italic">"{u.caption}"</p>
                </div>
              </Card>
            ))}
          </div>
        </Section>

        <Section title="Reasons to Buy (RTB)">
          <div className="space-y-2">
            {RTBS.map(r => (
              <Card key={r.id} className="flex gap-3 items-start">
                <span className="text-[10px] font-bold text-gray-500 w-16 flex-shrink-0">{r.id}</span>
                <p className="text-sm text-white">"{r.label}"</p>
              </Card>
            ))}
          </div>
        </Section>

        <Section title="Narrative Structures">
          <div className="space-y-2">
            {NARRATIVES.map(n => (
              <Card key={n.id} className="flex gap-3 items-start">
                <span className="text-[10px] font-bold text-gray-500 w-16 flex-shrink-0">{n.id}</span>
                <div>
                  <p className="text-sm text-white">{n.label}</p>
                  <p className="text-xs text-gray-400 italic">Hook: "{n.hook}"</p>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      </div>

      {/* Brand Voice Upload */}
      <Section title="Brand Voice — Upload Custom File">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400 mb-2">
                Upload a .txt, .md, or .docx file to override the default brand voice used in content generation.
                The AI will follow this voice guide when writing captions.
              </p>
              {voiceContent ? (
                <div className="bg-gray-800/50 rounded-lg p-3 max-h-32 overflow-y-auto">
                  <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{voiceContent.slice(0, 600)}{voiceContent.length > 600 ? '…' : ''}</p>
                </div>
              ) : (
                <p className="text-xs text-gray-600 italic">No custom brand voice uploaded — using default from brand-dna.ts</p>
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

      {/* Compliance Gate */}
      <Section title="Compliance Gate — Hard Rules">
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <p className="text-xs font-bold text-red-400 mb-2">❌ NEVER say:</p>
            <div className="flex flex-wrap gap-1">
              {BRAND.complianceGate.neverSay.map(w => (
                <span key={w} className="text-xs bg-red-900/30 text-red-300 rounded px-1.5 py-0.5">{w}</span>
              ))}
            </div>
          </Card>
          <Card>
            <p className="text-xs font-bold text-green-400 mb-2">✅ ALWAYS use:</p>
            <div className="space-y-1">
              {BRAND.complianceGate.alwaysSay.map(w => (
                <p key={w} className="text-xs text-gray-300">• {w}</p>
              ))}
            </div>
          </Card>
        </div>
      </Section>
    </div>
  );
}

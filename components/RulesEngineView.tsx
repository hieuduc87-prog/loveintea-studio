'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface Rule {
  id: string;
  version: string;
  rule_text: string;
  evidence: string | null;
  source: 'seed' | 'manual' | 'learn';
  status: 'active' | 'retired';
  scope?: string; // 'brand' (riêng) | 'platform' (nguyên tắc chung toàn hệ)
  created_at: string;
  retired_at: string | null;
}

interface RulesData {
  rules: Rule[];
  activeCount: number;
  maxRules: number;
  canAdd: boolean;
}

function SourceBadge({ source }: { source: Rule['source'] }) {
  const map = {
    seed:   'bg-gray-700 text-gray-300',
    manual: 'bg-blue-900/60 text-blue-300',
    learn:  'bg-purple-900/60 text-purple-300',
  };
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${map[source]}`}>
      {source}
    </span>
  );
}

function VersionBadge({ version }: { version: string }) {
  return (
    <span className="text-[10px] font-mono bg-gray-800 text-gray-400 border border-gray-700 px-1.5 py-0.5 rounded">
      v{version}
    </span>
  );
}

export function RulesEngineView({ brandId }: { brandId: string }) {
  const { data: session } = useSession();
  const isAdmin = Boolean((session?.user as { allBrands?: boolean } | undefined)?.allBrands);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [data, setData]             = useState<RulesData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [showRetired, setShowRetired] = useState(false);

  const [ruleText, setRuleText]     = useState('');
  const [evidence, setEvidence]     = useState('');
  const [adding, setAdding]         = useState(false);
  const [addMsg, setAddMsg]         = useState('');

  const [retiringId, setRetiringId] = useState<string | null>(null);
  const [seeding, setSeeding]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/rules?brandId=${brandId}`);
      const d = await r.json() as RulesData;
      setData(d);
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!ruleText.trim()) return;
    setAdding(true);
    setAddMsg('');
    try {
      const r = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, action: 'add', ruleText: ruleText.trim(), evidence: evidence.trim() || undefined }),
      });
      const d = await r.json() as { ok?: boolean; error?: string };
      if (d.ok) {
        setRuleText('');
        setEvidence('');
        await load();
      } else {
        setAddMsg(d.error || 'Failed to add rule');
        setTimeout(() => setAddMsg(''), 4000);
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleRetire(ruleId: string) {
    setRetiringId(ruleId);
    try {
      await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, action: 'retire', ruleId }),
      });
      await load();
    } finally {
      setRetiringId(null);
    }
  }

  async function handleSeed() {
    setSeeding(true);
    try {
      await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, action: 'seed' }),
      });
      await load();
    } finally {
      setSeeding(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading…</div>;
  }

  const active  = data?.rules.filter(r => r.status === 'active')  ?? [];
  const retired = data?.rules.filter(r => r.status === 'retired') ?? [];
  const count   = data?.activeCount ?? 0;
  const max     = data?.maxRules ?? 30;
  const canAdd  = data?.canAdd ?? true;
  const nearLimit = count > 25;

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-white">Rules Engine</h1>
            <span className="text-[11px] font-mono bg-brand-600/20 text-brand-300 border border-brand-600/30 px-2 py-0.5 rounded">
              versioned
            </span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${nearLimit ? 'bg-amber-900/50 text-amber-300' : 'bg-gray-800 text-gray-400'}`}>
              {count}/{max} active
            </span>
          </div>
          <p className="text-gray-500 text-xs mt-0.5">Governs content generation — all rules are versioned and auditable</p>
        </div>
        <div className="ml-auto flex-shrink-0">
          {count === 0 && (
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
            >
              {seeding ? '⟳ Seeding…' : '⚡ Seed Defaults'}
            </button>
          )}
        </div>
      </div>

      {/* Near-limit warning */}
      {nearLimit && (
        <div className="mb-4 flex items-center gap-2 bg-amber-900/20 border border-amber-700/40 rounded-lg px-4 py-2.5">
          <span className="text-amber-400 text-sm">⚠</span>
          <p className="text-amber-300 text-xs">Approaching {max}-rule limit — retire unused rules before adding more.</p>
        </div>
      )}

      {/* Add rule form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Add Rule</p>
        <textarea
          value={ruleText}
          onChange={e => setRuleText(e.target.value)}
          placeholder="e.g. Never use urgency language like 'limited time' or 'act now'"
          rows={2}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-brand-600 transition-colors"
        />
        <textarea
          value={evidence}
          onChange={e => setEvidence(e.target.value)}
          placeholder="Evidence / reason (optional)"
          rows={1}
          className="w-full mt-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:border-brand-600 transition-colors"
        />
        <div className="flex items-center justify-between mt-3">
          {addMsg ? (
            <p className="text-xs text-red-400">{addMsg}</p>
          ) : (
            <span />
          )}
          <button
            onClick={handleAdd}
            disabled={adding || !ruleText.trim() || !canAdd}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
            title={!canAdd ? `Limit of ${max} rules reached` : ''}
          >
            {adding ? '⟳ Adding…' : '+ Add Rule'}
          </button>
        </div>
      </div>

      {/* Empty state */}
      {active.length === 0 && retired.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-white font-medium">No rules yet.</p>
          <p className="text-gray-500 text-sm mt-1">
            Click <span className="text-brand-400 font-semibold">Seed Defaults</span> to start with 8 foundational rules.
          </p>
        </div>
      )}

      {/* Active rules */}
      {active.length > 0 && (
        <div className="space-y-3 mb-6">
          {active.map((rule, idx) => (
            <div key={rule.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-4 items-start">
              <span className="text-xs font-bold text-gray-600 mt-0.5 w-5 text-right flex-shrink-0">
                {idx + 1}.
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <VersionBadge version={rule.version} />
                  <SourceBadge source={rule.source} />
                  {rule.scope === 'platform' && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300" title="Nguyên tắc chung — áp dụng cho MỌI brand trong hệ thống">🌐 CHUNG</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-white leading-snug">{rule.rule_text}</p>
                {rule.evidence && (
                  <p className="text-xs text-gray-500 italic mt-1.5 leading-relaxed">{rule.evidence}</p>
                )}
                <p className="text-[10px] text-gray-700 mt-1.5">Added {fmtDate(rule.created_at)}</p>
              </div>
              <div className="flex-shrink-0 flex flex-col gap-1.5 items-end">
                {isAdmin && (
                  <button
                    onClick={async () => {
                      setPromotingId(rule.id);
                      await fetch(`/api/rules/${rule.id}`, {
                        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ scope: rule.scope === 'platform' ? 'brand' : 'platform' }),
                      });
                      setPromotingId(null);
                      await load();
                    }}
                    disabled={promotingId === rule.id}
                    title={rule.scope === 'platform' ? 'Hạ về rule riêng brand này' : 'Promote thành nguyên tắc chung — áp MỌI brand'}
                    className="px-3 py-1.5 bg-emerald-900/30 hover:bg-emerald-900/60 disabled:opacity-40 text-emerald-400 text-xs font-semibold rounded-lg border border-emerald-800/40 transition-colors whitespace-nowrap"
                  >
                    {promotingId === rule.id ? '⟳' : rule.scope === 'platform' ? '↓ Riêng brand' : '🌐 Promote toàn hệ'}
                  </button>
                )}
                <button
                  onClick={() => handleRetire(rule.id)}
                  disabled={retiringId === rule.id}
                  className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/60 disabled:opacity-40 text-red-400 text-xs font-semibold rounded-lg border border-red-800/40 transition-colors whitespace-nowrap"
                >
                  {retiringId === rule.id ? '⟳' : 'Retire'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Retired rules — collapsible */}
      {retired.length > 0 && (
        <div className="border border-gray-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowRetired(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-900/50 hover:bg-gray-900 transition-colors text-left"
          >
            <span className="text-xs font-bold uppercase tracking-widest text-gray-600">
              Retired Rules ({retired.length})
            </span>
            <span className="text-gray-600 text-xs">{showRetired ? '▲' : '▼'}</span>
          </button>
          {showRetired && (
            <div className="divide-y divide-gray-800/50">
              {retired.map((rule, idx) => (
                <div key={rule.id} className="px-4 py-3 flex gap-4 items-start bg-gray-950">
                  <span className="text-xs font-bold text-gray-700 mt-0.5 w-5 text-right flex-shrink-0">
                    {idx + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <VersionBadge version={rule.version} />
                      <SourceBadge source={rule.source} />
                      <span className="text-[10px] text-gray-600">
                        Retired {rule.retired_at ? fmtDate(rule.retired_at) : '—'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 line-through leading-snug">{rule.rule_text}</p>
                    {rule.evidence && (
                      <p className="text-xs text-gray-700 italic mt-1">{rule.evidence}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

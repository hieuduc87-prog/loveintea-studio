'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface KnowledgeDoc {
  id: string;
  brand_id: string;
  type: string;
  title: string;
  content: string;
  content_preview: string;
  content_size: number;
  file_url: string | null;
  uploaded_at: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string; order: number }> = {
  playbook:                { label: 'Playbook',        color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30', icon: '📗', order: 1 },
  guideline:               { label: 'Guideline',       color: 'text-blue-400',    bg: 'bg-blue-500/15 border-blue-500/30',       icon: '📘', order: 2 },
  research:                { label: 'Research',        color: 'text-amber-400',   bg: 'bg-amber-500/15 border-amber-500/30',     icon: '🔬', order: 3 },
  workflow:                { label: 'Workflow',         color: 'text-purple-400',  bg: 'bg-purple-500/15 border-purple-500/30',   icon: '🔄', order: 4 },
  flowmap:                 { label: 'Flow Map',        color: 'text-rose-400',    bg: 'bg-rose-500/15 border-rose-500/30',       icon: '🗺️', order: 5 },
  communication_direction: { label: 'Comm Direction',  color: 'text-cyan-400',    bg: 'bg-cyan-500/15 border-cyan-500/30',       icon: '📣', order: 6 },
  social_strategy:         { label: 'Social Strategy', color: 'text-orange-400',  bg: 'bg-orange-500/15 border-orange-500/30',   icon: '📱', order: 7 },
};

const DEFAULT_TYPE_CONFIG = { label: 'Document', color: 'text-gray-400', bg: 'bg-gray-500/15 border-gray-500/30', icon: '📄', order: 99 };

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] ?? DEFAULT_TYPE_CONFIG;
}

const READING_FLOW = [
  { step: 1, label: 'README',      matchTitle: 'readme',      matchType: 'guideline' },
  { step: 2, label: 'Flow Map',    matchTitle: 'flowmap',     matchType: 'flowmap' },
  { step: 3, label: 'IA v2',       matchTitle: 'ia',          matchType: 'guideline' },
  { step: 4, label: 'Detail Spec', matchTitle: 'spec',        matchType: 'research' },
  { step: 5, label: 'Case Study',  matchTitle: 'case study',  matchType: 'research' },
  { step: 6, label: 'Playbook',    matchTitle: 'playbook',    matchType: 'playbook' },
];

// ── Markdown-like renderer ────────────────────────────────────────────────────

function renderMarkdown(content: string): React.ReactNode[] {
  const lines = content.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // H1
    if (line.startsWith('# ')) {
      nodes.push(
        <h1 key={i} className="text-xl font-bold text-white mt-6 mb-3 pb-2 border-b border-gray-700">
          {line.slice(2)}
        </h1>
      );
      i++; continue;
    }

    // H2
    if (line.startsWith('## ')) {
      nodes.push(
        <h2 key={i} className="text-base font-bold text-white mt-5 mb-2">
          {line.slice(3)}
        </h2>
      );
      i++; continue;
    }

    // H3
    if (line.startsWith('### ')) {
      nodes.push(
        <h3 key={i} className="text-sm font-semibold text-gray-200 mt-4 mb-1.5">
          {line.slice(4)}
        </h3>
      );
      i++; continue;
    }

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <div key={i} className="my-3">
          {lang && <span className="text-[10px] text-gray-500 font-mono mb-1 block">{lang}</span>}
          <pre className="bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-x-auto text-xs text-gray-300 font-mono leading-relaxed whitespace-pre-wrap">
            {codeLines.join('\n')}
          </pre>
        </div>
      );
      i++; continue;
    }

    // Table — detect by leading |
    if (line.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      const rows = tableLines.filter(r => !/^\|[-| ]+\|$/.test(r.trim()));
      const parseRow = (r: string) =>
        r.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

      if (rows.length >= 1) {
        const [header, ...body] = rows;
        nodes.push(
          <div key={i} className="my-4 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  {parseRow(header).map((cell, ci) => (
                    <th key={ci} className="text-left px-3 py-2 text-gray-400 font-semibold border-b border-gray-700 bg-gray-900/60">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? 'bg-gray-900/30' : 'bg-transparent'}>
                    {parseRow(row).map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 text-gray-300 border-b border-gray-800/60">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={i} className="border-gray-800 my-4" />);
      i++; continue;
    }

    // Bullet list
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        items.push(lines[i].slice(2));
        i++;
      }
      nodes.push(
        <ul key={i} className="my-2 space-y-1 ml-4">
          {items.map((item, ii) => (
            <li key={ii} className="flex gap-2 text-sm text-gray-300 leading-relaxed">
              <span className="text-gray-600 mt-0.5 flex-shrink-0">•</span>
              <span>{inlineFormat(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      let num = 1;
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      nodes.push(
        <ol key={i} className="my-2 space-y-1 ml-4">
          {items.map((item, ii) => (
            <li key={ii} className="flex gap-2 text-sm text-gray-300 leading-relaxed">
              <span className="text-brand-400 font-mono text-xs mt-0.5 flex-shrink-0 w-4">{num + ii}.</span>
              <span>{inlineFormat(item)}</span>
            </li>
          ))}
        </ol>
      );
      num += items.length;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        items.push(lines[i].slice(2));
        i++;
      }
      nodes.push(
        <blockquote key={i} className="my-3 pl-4 border-l-2 border-brand-600/60">
          {items.map((item, ii) => (
            <p key={ii} className="text-sm text-gray-400 italic leading-relaxed">{item}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    // Empty line — spacing
    if (line.trim() === '') {
      nodes.push(<div key={i} className="h-2" />);
      i++; continue;
    }

    // Bold heading-like line (all caps or ends with colon)
    const isBoldLine = /^[A-Z][A-Z\s\-_:]+:?$/.test(line.trim()) && line.trim().length < 60;
    if (isBoldLine) {
      nodes.push(
        <p key={i} className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-4 mb-1">
          {line.trim()}
        </p>
      );
      i++; continue;
    }

    // Plain paragraph
    nodes.push(
      <p key={i} className="text-sm text-gray-300 leading-relaxed my-1">
        {inlineFormat(line)}
      </p>
    );
    i++;
  }

  return nodes;
}

// Inline formatting: **bold**, `code`, _italic_
function inlineFormat(text: string): React.ReactNode {
  // Process bold + code inline — simple split approach
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|_[^_]+_)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={i} className="bg-gray-800 text-emerald-300 rounded px-1 py-0.5 text-xs font-mono">{part.slice(1, -1)}</code>;
        }
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('_') && part.endsWith('_')) {
          return <em key={i} className="text-gray-300 italic">{part.slice(1, -1)}</em>;
        }
        return part;
      })}
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const cfg = getTypeConfig(type);
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
      <span>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

function DocCard({
  doc,
  expanded,
  highlighted,
  onToggle,
  id,
}: {
  doc: KnowledgeDoc;
  expanded: boolean;
  highlighted: boolean;
  onToggle: () => void;
  id: string;
}) {
  const cfg = getTypeConfig(doc.type);

  return (
    <div
      id={id}
      className={`bg-gray-900 border rounded-xl overflow-hidden transition-all duration-200 ${
        highlighted
          ? 'border-brand-500/60 ring-1 ring-brand-500/30'
          : expanded
          ? 'border-gray-700'
          : 'border-gray-800 hover:border-gray-700'
      }`}
    >
      {/* Card header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <TypeBadge type={doc.type} />
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {doc.file_url && (
              <a
                href={doc.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 flex items-center gap-1"
                title="Open file in new tab"
              >
                <span>↗</span>
                <span>File</span>
              </a>
            )}
            <button
              onClick={onToggle}
              className={`text-[11px] px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                expanded
                  ? 'bg-brand-600/20 text-brand-300 hover:bg-brand-600/30'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {expanded ? (
                <><span>▲</span><span>Close</span></>
              ) : (
                <><span>▼</span><span>View</span></>
              )}
            </button>
          </div>
        </div>

        <h3 className="text-white font-semibold text-sm leading-snug mb-2">
          {doc.title}
        </h3>

        {!expanded && (
          <p className="text-gray-400 text-xs leading-relaxed line-clamp-3">
            {doc.content_preview || doc.content.slice(0, 200)}
          </p>
        )}

        {/* Metadata row */}
        <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-gray-800/60">
          <span className="flex items-center gap-1 text-[11px] text-gray-600">
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.color.replace('text-', 'bg-')}`} />
            {formatSize(doc.content_size)}
          </span>
          <span className="text-[11px] text-gray-600">
            {formatDate(doc.uploaded_at)}
          </span>
          <span className="text-[11px] text-gray-700 ml-auto font-mono">
            {doc.id.slice(0, 8)}
          </span>
        </div>
      </div>

      {/* Expanded content viewer */}
      {expanded && (
        <div className="border-t border-gray-800">
          <div className="bg-gray-950/60 px-5 py-5 max-h-[600px] overflow-y-auto">
            <div className="prose-custom max-w-none">
              {renderMarkdown(doc.content)}
            </div>
          </div>
          <div className="px-4 py-2.5 border-t border-gray-800 flex items-center justify-between bg-gray-900/80">
            <span className="text-[11px] text-gray-600">
              {doc.content.length.toLocaleString()} chars · {formatSize(doc.content_size)}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(doc.content)}
                className="text-[11px] px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              >
                Copy text
              </button>
              <button
                onClick={onToggle}
                className="text-[11px] px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              >
                ▲ Collapse
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reading Flow Banner ────────────────────────────────────────────────────────

function ReadingFlowBanner({
  docs,
  onHighlight,
}: {
  docs: KnowledgeDoc[];
  onHighlight: (docId: string | null) => void;
}) {
  function findDocForStep(step: typeof READING_FLOW[number]): KnowledgeDoc | null {
    // Try title match first
    const byTitle = docs.find(d =>
      d.title.toLowerCase().includes(step.matchTitle.toLowerCase())
    );
    if (byTitle) return byTitle;
    // Fallback to type match
    return docs.find(d => d.type === step.matchType) ?? null;
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Recommended Reading Order</span>
        <div className="flex-1 h-px bg-gray-800" />
      </div>
      <div className="flex items-center gap-0 overflow-x-auto pb-1 scrollbar-thin">
        {READING_FLOW.map((step, idx) => {
          const doc = findDocForStep(step);
          return (
            <div key={step.step} className="flex items-center flex-shrink-0">
              <button
                onClick={() => {
                  if (doc) {
                    const el = document.getElementById(`doc-${doc.id}`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    onHighlight(doc.id);
                    setTimeout(() => onHighlight(null), 2500);
                  }
                }}
                disabled={!doc}
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                  doc
                    ? 'border-gray-700 bg-gray-800/60 text-gray-300 hover:border-brand-600/50 hover:bg-brand-600/10 hover:text-white cursor-pointer'
                    : 'border-gray-800/40 bg-gray-900/30 text-gray-700 cursor-default'
                }`}
                title={doc ? `Jump to: ${doc.title}` : `No ${step.label} document yet`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                  doc ? 'bg-brand-600/30 text-brand-300' : 'bg-gray-800 text-gray-600'
                }`}>
                  {step.step}
                </span>
                <span className={doc ? '' : 'opacity-40'}>{step.label}</span>
                {doc && <span className="text-green-500 text-[9px]">●</span>}
              </button>
              {idx < READING_FLOW.length - 1 && (
                <div className="flex items-center px-1 flex-shrink-0">
                  <div className={`h-px w-4 ${idx < READING_FLOW.length - 1 ? 'bg-gray-700' : 'bg-transparent'}`} />
                  <span className="text-gray-700 text-xs">›</span>
                  <div className="h-px w-4 bg-gray-700" />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-gray-600 mt-2.5">
        Click any step to jump to that document. Green dot = document found in knowledge base.
      </p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function KnowledgeHubView({ brandId }: { brandId: string }) {
  const [docs, setDocs]           = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [search, setSearch]       = useState('');
  const [filterType, setFilterType] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`/api/knowledge?brandId=${encodeURIComponent(brandId)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json() as { docs?: KnowledgeDoc[]; items?: KnowledgeDoc[] } | KnowledgeDoc[];
      const list: KnowledgeDoc[] = Array.isArray(data)
        ? data
        : (data as { docs?: KnowledgeDoc[]; items?: KnowledgeDoc[] }).docs
          ?? (data as { docs?: KnowledgeDoc[]; items?: KnowledgeDoc[] }).items
          ?? [];
      // Sort by type order, then by date desc
      list.sort((a, b) => {
        const ao = getTypeConfig(a.type).order;
        const bo = getTypeConfig(b.type).order;
        if (ao !== bo) return ao - bo;
        return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
      });
      setDocs(list);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  // Derived state
  const allTypes = Array.from(new Set(docs.map(d => d.type))).sort(
    (a, b) => getTypeConfig(a).order - getTypeConfig(b).order
  );

  const filtered = docs.filter(d => {
    const matchType = filterType === 'all' || d.type === filterType;
    const q = search.toLowerCase().trim();
    const matchSearch = !q
      || d.title.toLowerCase().includes(q)
      || d.content_preview.toLowerCase().includes(q)
      || d.type.toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  function toggleExpand(id: string) {
    setExpandedId(prev => prev === id ? null : id);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-start gap-4 mb-6 p-5 bg-gradient-to-r from-brand-600/20 to-transparent border border-brand-600/30 rounded-xl">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-10 h-10 rounded-xl bg-brand-600/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">🧠</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-tight">Knowledge Hub</h1>
              <p className="text-gray-400 text-xs mt-0.5">Brand Brain — tài liệu nguồn nuôi toàn bộ pipeline</p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3 ml-13">
            <span className="text-xs text-gray-500">
              <span className="text-white font-semibold">{docs.length}</span> document{docs.length !== 1 ? 's' : ''}
            </span>
            {allTypes.length > 0 && (
              <>
                <span className="text-gray-700">·</span>
                <span className="text-xs text-gray-500">
                  {allTypes.length} type{allTypes.length !== 1 ? 's' : ''}
                </span>
              </>
            )}
            {docs.length > 0 && (
              <>
                <span className="text-gray-700">·</span>
                <span className="text-xs text-gray-500">
                  {formatSize(docs.reduce((acc, d) => acc + d.content_size, 0))} total
                </span>
              </>
            )}
          </div>
        </div>

        {/* Search bar */}
        <div className="relative flex-shrink-0 md:w-72">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">⌕</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full bg-gray-900/80 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Reading Flow Banner ── */}
      {docs.length > 0 && !loading && (
        <ReadingFlowBanner docs={docs} onHighlight={setHighlightedId} />
      )}

      {/* ── Type Filter ── */}
      {docs.length > 0 && !loading && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <button
            onClick={() => setFilterType('all')}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              filterType === 'all'
                ? 'bg-brand-600 border-brand-600 text-white'
                : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white bg-gray-900'
            }`}
          >
            All
            <span className={`ml-1.5 ${filterType === 'all' ? 'text-brand-200' : 'text-gray-600'}`}>
              {docs.length}
            </span>
          </button>
          {allTypes.map(type => {
            const cfg = getTypeConfig(type);
            const count = docs.filter(d => d.type === type).length;
            const isActive = filterType === type;
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                  isActive
                    ? `${cfg.bg} ${cfg.color} border-current`
                    : 'border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300 bg-gray-900'
                }`}
              >
                <span className="mr-1">{cfg.icon}</span>
                {cfg.label}
                <span className={`ml-1.5 ${isActive ? 'opacity-70' : 'text-gray-600'}`}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Loading state ── */}
      {loading && (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-brand-600/30 border-t-brand-500 animate-spin" />
          <p className="text-gray-500 text-sm">Loading knowledge base...</p>
        </div>
      )}

      {/* ── Error state ── */}
      {!loading && error && (
        <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-6 text-center">
          <p className="text-red-400 text-sm font-medium mb-1">Failed to load knowledge documents</p>
          <p className="text-red-500/70 text-xs mb-4 font-mono">{error}</p>
          <button
            onClick={loadDocs}
            className="px-4 py-2 bg-red-900/40 hover:bg-red-900/60 text-red-300 text-xs rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && docs.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 flex flex-col items-center justify-center text-center">
          <p className="text-5xl mb-4">🧠</p>
          <p className="text-white font-semibold text-base mb-2">Knowledge base is empty</p>
          <p className="text-gray-500 text-sm max-w-md">
            No knowledge documents yet. Upload brand strategy documents to power the AI pipeline.
          </p>
        </div>
      )}

      {/* ── No search results ── */}
      {!loading && !error && docs.length > 0 && filtered.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 flex flex-col items-center justify-center text-center">
          <p className="text-3xl mb-3">🔍</p>
          <p className="text-white font-medium mb-1">No documents match</p>
          <p className="text-gray-500 text-sm">
            Try a different search term or remove the type filter.
          </p>
          <button
            onClick={() => { setSearch(''); setFilterType('all'); }}
            className="mt-4 px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition-colors"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* ── Document Grid ── */}
      {!loading && !error && filtered.length > 0 && (
        <>
          {/* Results count when filtered */}
          {(search || filterType !== 'all') && (
            <p className="text-xs text-gray-600 mb-3">
              Showing <span className="text-gray-400">{filtered.length}</span> of {docs.length} documents
              {filterType !== 'all' && <> · type: <span className="text-gray-400">{getTypeConfig(filterType).label}</span></>}
              {search && <> · search: <span className="text-gray-400">&ldquo;{search}&rdquo;</span></>}
            </p>
          )}

          {/* Expanded view: show full-width */}
          {expandedId ? (
            <div className="space-y-4">
              {/* Collapsed summary for non-expanded docs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-2">
                {filtered.filter(d => d.id !== expandedId).map(doc => {
                  const cfg = getTypeConfig(doc.type);
                  return (
                    <button
                      key={doc.id}
                      onClick={() => toggleExpand(doc.id)}
                      className="flex items-center gap-3 p-3 bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors text-left group"
                    >
                      <span className="text-lg flex-shrink-0">{cfg.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-300 group-hover:text-white truncate transition-colors">{doc.title}</p>
                        <p className={`text-[10px] ${cfg.color} mt-0.5`}>{cfg.label}</p>
                      </div>
                      <span className="text-gray-600 group-hover:text-gray-400 text-xs transition-colors flex-shrink-0">▼</span>
                    </button>
                  );
                })}
              </div>
              {/* Expanded card full-width */}
              {filtered.filter(d => d.id === expandedId).map(doc => (
                <DocCard
                  key={doc.id}
                  doc={doc}
                  expanded={true}
                  highlighted={highlightedId === doc.id}
                  onToggle={() => toggleExpand(doc.id)}
                  id={`doc-${doc.id}`}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(doc => (
                <DocCard
                  key={doc.id}
                  doc={doc}
                  expanded={expandedId === doc.id}
                  highlighted={highlightedId === doc.id}
                  onToggle={() => toggleExpand(doc.id)}
                  id={`doc-${doc.id}`}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Footer stats ── */}
      {!loading && !error && docs.length > 0 && (
        <div className="mt-8 pt-4 border-t border-gray-800/60 flex flex-wrap gap-4">
          {allTypes.map(type => {
            const cfg = getTypeConfig(type);
            const count = docs.filter(d => d.type === type).length;
            const totalSize = docs.filter(d => d.type === type).reduce((acc, d) => acc + d.content_size, 0);
            return (
              <div key={type} className="flex items-center gap-2">
                <span className={`text-[11px] ${cfg.color}`}>{cfg.icon} {cfg.label}</span>
                <span className="text-[11px] text-gray-600">{count} doc{count !== 1 ? 's' : ''} · {formatSize(totalSize)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

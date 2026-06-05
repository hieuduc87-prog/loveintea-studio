'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { v4 as uuid } from 'uuid';

// ─── Types ───────────────────────────────────────────────────────────────────

type NodeType = 'start' | 'end' | 'step' | 'ai_step' | 'decision' | 'output' | 'note';
type ProcessType = 'manual' | 'ai' | 'automated' | '';
type Condition = 'always' | 'yes' | 'no' | 'approved' | 'rejected' | 'trigger';

interface FlowNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  title: string;
  description: string;
  processType: ProcessType;
  tool: string;
  prompt: string;
  promptNotes: string;
  inputRequired: string;
  outputDescription: string;
  assignedTo: string;
  estimatedTime: string;
  notes: string;
  outputImages: string[];
}

interface FlowEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  condition: Condition;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  category: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  createdAt: string;
  updatedAt: string;
}

interface WorkflowSummary {
  id: string;
  name: string;
  description: string;
  category: string;
  updatedAt: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const NODE_W = 160;
const NODE_H = 52;
const DIAMOND_SIZE = 70;
const ELLIPSE_RX = 50;
const ELLIPSE_RY = 26;

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  start: 'Start', end: 'End', step: 'Step', ai_step: 'AI Step',
  decision: 'Decision', output: 'Output', note: 'Note',
};

const CONDITION_COLORS: Record<Condition, string> = {
  always: '#6b7280',
  yes: '#10b981',
  no: '#ef4444',
  approved: '#10b981',
  rejected: '#ef4444',
  trigger: '#f59e0b',
};

const TOOLS = [
  '—', 'Claude AI', 'GPT-image-2', 'DALL-E 3', 'Canva', 'n8n',
  'Figma', 'LoveinTea Studio', 'Manual', 'Custom...',
];

const CATEGORIES = ['image', 'content', 'blog', 'social', 'video', 'general'];

const CATEGORY_COLORS: Record<string, string> = {
  image: '#a78bfa', content: '#60a5fa', blog: '#34d399',
  social: '#f472b6', video: '#f97316', general: '#6b7280',
};

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function getNodeCenter(node: FlowNode): { cx: number; cy: number } {
  if (node.type === 'decision') {
    return { cx: node.x + DIAMOND_SIZE / 2, cy: node.y + DIAMOND_SIZE / 2 };
  }
  if (node.type === 'start' || node.type === 'end') {
    return { cx: node.x + ELLIPSE_RX, cy: node.y + ELLIPSE_RY };
  }
  return { cx: node.x + NODE_W / 2, cy: node.y + NODE_H / 2 };
}

function getPortOut(node: FlowNode): { x: number; y: number } {
  const c = getNodeCenter(node);
  if (node.type === 'decision') return { x: node.x + DIAMOND_SIZE, y: c.cy };
  if (node.type === 'start' || node.type === 'end') return { x: node.x + ELLIPSE_RX * 2, y: c.cy };
  return { x: node.x + NODE_W, y: c.cy };
}

function getPortIn(node: FlowNode): { x: number; y: number } {
  const c = getNodeCenter(node);
  if (node.type === 'decision') return { x: node.x, y: c.cy };
  if (node.type === 'start' || node.type === 'end') return { x: node.x, y: c.cy };
  return { x: node.x, y: c.cy };
}

function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.abs(x2 - x1) * 0.5;
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}

// ─── Node rendering ───────────────────────────────────────────────────────────

function NodeShape({ node, selected, onMouseDown, connectMode, onConnectClick }: {
  node: FlowNode;
  selected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  connectMode: boolean;
  onConnectClick: () => void;
}) {
  const selRing = selected ? 2 : 0;

  if (node.type === 'start' || node.type === 'end') {
    const fill = node.type === 'start' ? '#052e16' : '#450a0a';
    const stroke = node.type === 'start' ? '#22c55e' : '#ef4444';
    const textColor = node.type === 'start' ? '#86efac' : '#fca5a5';
    return (
      <g transform={`translate(${node.x},${node.y})`} onMouseDown={onMouseDown} style={{ cursor: 'move' }}>
        <ellipse
          cx={ELLIPSE_RX} cy={ELLIPSE_RY}
          rx={ELLIPSE_RX} ry={ELLIPSE_RY}
          fill={fill}
          stroke={selected ? '#f43f5e' : stroke}
          strokeWidth={selected ? 2 : 1.5}
        />
        <text x={ELLIPSE_RX} y={ELLIPSE_RY + 4} textAnchor="middle"
          fill={textColor} fontSize={12} fontWeight="600" style={{ pointerEvents: 'none', userSelect: 'none' }}>
          {node.title}
        </text>
        {connectMode && (
          <circle
            cx={ELLIPSE_RX * 2 + 8} cy={ELLIPSE_RY}
            r={6} fill="#f43f5e" stroke="#fff" strokeWidth={1.5}
            style={{ cursor: 'crosshair' }}
            onClick={e => { e.stopPropagation(); onConnectClick(); }}
          />
        )}
      </g>
    );
  }

  if (node.type === 'decision') {
    const half = DIAMOND_SIZE / 2;
    const pts = `${half},0 ${DIAMOND_SIZE},${half} ${half},${DIAMOND_SIZE} 0,${half}`;
    return (
      <g transform={`translate(${node.x},${node.y})`} onMouseDown={onMouseDown} style={{ cursor: 'move' }}>
        <polygon
          points={pts}
          fill="#451a03"
          stroke={selected ? '#f43f5e' : '#f59e0b'}
          strokeWidth={selected ? 2 : 1.5}
        />
        <text x={half} y={half - 4} textAnchor="middle"
          fill="#fde68a" fontSize={10} fontWeight="700" style={{ pointerEvents: 'none', userSelect: 'none' }}>
          {node.title.length > 10 ? node.title.slice(0, 10) + '…' : node.title}
        </text>
        <text x={half} y={half + 8} textAnchor="middle"
          fill="#78716c" fontSize={8} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          decision
        </text>
        {connectMode && (
          <circle
            cx={DIAMOND_SIZE + 8} cy={half}
            r={6} fill="#f43f5e" stroke="#fff" strokeWidth={1.5}
            style={{ cursor: 'crosshair' }}
            onClick={e => { e.stopPropagation(); onConnectClick(); }}
          />
        )}
      </g>
    );
  }

  const styleMap: Record<NodeType, { fill: string; stroke: string; badge: string; badgeColor: string }> = {
    step: { fill: '#1e3a5f', stroke: '#60a5fa', badge: 'step', badgeColor: '#93c5fd' },
    ai_step: { fill: '#2d1b69', stroke: '#a78bfa', badge: 'AI', badgeColor: '#c4b5fd' },
    output: { fill: '#052e16', stroke: '#10b981', badge: 'out', badgeColor: '#6ee7b7' },
    note: { fill: '#422006', stroke: '#fbbf24', badge: 'note', badgeColor: '#fde68a' },
    start: { fill: '#052e16', stroke: '#22c55e', badge: '', badgeColor: '' },
    end: { fill: '#450a0a', stroke: '#ef4444', badge: '', badgeColor: '' },
    decision: { fill: '#451a03', stroke: '#f59e0b', badge: '', badgeColor: '' },
  };

  const s = styleMap[node.type] || styleMap.step;
  const truncTitle = node.title.length > 20 ? node.title.slice(0, 20) + '…' : node.title;

  return (
    <g transform={`translate(${node.x},${node.y})`} onMouseDown={onMouseDown} style={{ cursor: 'move' }}>
      <rect
        width={NODE_W} height={NODE_H} rx={node.type === 'note' ? 4 : 8}
        fill={s.fill}
        stroke={selected ? '#f43f5e' : s.stroke}
        strokeWidth={selected ? 2 : 1.5}
      />
      {/* title */}
      <text x={10} y={21} fill="white" fontSize={12} fontWeight="600"
        style={{ pointerEvents: 'none', userSelect: 'none' }}>
        {node.type === 'note' ? <tspan fontStyle="italic">{truncTitle}</tspan> : truncTitle}
      </text>
      {/* type badge */}
      <text x={10} y={38} fill={s.badgeColor} fontSize={9}
        style={{ pointerEvents: 'none', userSelect: 'none' }}>
        {s.badge}
        {node.processType === 'manual' && ' 🤚'}
        {node.processType === 'ai' && ' 🤖'}
        {node.processType === 'automated' && ' ⚙️'}
      </text>
      {/* AI badge top-right */}
      {node.type === 'ai_step' && (
        <>
          <rect x={NODE_W - 24} y={4} width={20} height={14} rx={3} fill="#7c3aed" />
          <text x={NODE_W - 14} y={14} textAnchor="middle" fill="white" fontSize={8} fontWeight="700"
            style={{ pointerEvents: 'none', userSelect: 'none' }}>AI</text>
        </>
      )}
      {/* port out */}
      {connectMode && (
        <circle
          cx={NODE_W + 8} cy={NODE_H / 2}
          r={6} fill="#f43f5e" stroke="#fff" strokeWidth={1.5}
          style={{ cursor: 'crosshair' }}
          onClick={e => { e.stopPropagation(); onConnectClick(); }}
        />
      )}
    </g>
  );
}

// ─── Edge rendering ───────────────────────────────────────────────────────────

function EdgeShape({ edge, fromNode, toNode, selected, onClick }: {
  edge: FlowEdge;
  fromNode: FlowNode;
  toNode: FlowNode;
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const out = getPortOut(fromNode);
  const inp = getPortIn(toNode);
  const d = bezierPath(out.x, out.y, inp.x, inp.y);
  const color = selected ? '#f43f5e' : (CONDITION_COLORS[edge.condition] || '#6b7280');

  // midpoint for label
  const mx = (out.x + inp.x) / 2;
  const my = (out.y + inp.y) / 2;

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      {/* wider invisible hit area */}
      <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
      <path
        d={d} fill="none"
        stroke={color}
        strokeWidth={selected ? 2 : 1.5}
        strokeDasharray={edge.condition === 'always' ? undefined : '6,3'}
        markerEnd={`url(#arrow-${selected ? 'sel' : 'def'})`}
      />
      {edge.label && (
        <text x={mx} y={my - 6} textAnchor="middle"
          fill="#9ca3af" fontSize={9}
          style={{ pointerEvents: 'none', userSelect: 'none' }}>
          {edge.label}
        </text>
      )}
      {edge.condition !== 'always' && (
        <text x={mx} y={my + 14} textAnchor="middle"
          fill={color} fontSize={8} fontWeight="600"
          style={{ pointerEvents: 'none', userSelect: 'none' }}>
          {edge.condition}
        </text>
      )}
    </g>
  );
}

// ─── Right panel ──────────────────────────────────────────────────────────────

function NodePanel({ node, workflowId, onChange, onDelete }: {
  node: FlowNode;
  workflowId: string;
  onChange: (updated: FlowNode) => void;
  onDelete: () => void;
}) {
  const [uploadingImg, setUploadingImg] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [expandImg, setExpandImg] = useState<string | null>(null);

  const set = (field: keyof FlowNode, val: unknown) =>
    onChange({ ...node, [field]: val });

  const uploadImage = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingImg(true);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res = await fetch(`/api/flow-builder/${workflowId}/image`, { method: 'POST', body: fd });
        if (res.ok) {
          const { filename } = await res.json();
          onChange({ ...node, outputImages: [...(node.outputImages || []), filename] });
        }
      } catch {}
    }
    setUploadingImg(false);
  };

  const deleteImage = async (filename: string) => {
    onChange({ ...node, outputImages: (node.outputImages || []).filter(f => f !== filename) });
  };

  const inputCls = 'w-full text-xs rounded-md px-2.5 py-1.5 border border-gray-700 bg-gray-800 text-white outline-none focus:border-pink-500 placeholder-gray-600';
  const labelCls = 'text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block';
  const sectionCls = 'border-t border-gray-800 pt-3 mt-3';

  return (
    <div className="p-3 space-y-3 text-sm">
      {/* Title */}
      <div>
        <label className={labelCls}>Title</label>
        <input
          className={inputCls + ' text-sm font-semibold'}
          value={node.title}
          onChange={e => set('title', e.target.value)}
          placeholder="Step title..."
        />
      </div>

      {/* Type */}
      <div>
        <label className={labelCls}>Type</label>
        <div className="flex flex-wrap gap-1">
          {(['start', 'step', 'ai_step', 'decision', 'output', 'end', 'note'] as NodeType[]).map(t => (
            <button
              key={t}
              onClick={() => set('type', t)}
              className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors ${
                node.type === t
                  ? 'bg-pink-600 border-pink-500 text-white'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
              }`}
            >
              {NODE_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Process Type */}
      <div>
        <label className={labelCls}>Process Type</label>
        <div className="flex gap-1">
          {([['manual', '🤚 Manual'], ['ai', '🤖 AI'], ['automated', '⚙️ Auto'], ['', '—']] as [ProcessType, string][]).map(([v, lbl]) => (
            <button
              key={v}
              onClick={() => set('processType', v)}
              className={`flex-1 text-[10px] py-1 rounded border transition-colors ${
                node.processType === v
                  ? 'bg-pink-600/20 border-pink-500 text-pink-300'
                  : 'border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Tool */}
      <div>
        <label className={labelCls}>Tool</label>
        <select
          className={inputCls}
          value={TOOLS.includes(node.tool) ? node.tool : 'Custom...'}
          onChange={e => set('tool', e.target.value === '—' ? '' : e.target.value)}
        >
          {TOOLS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Description */}
      <div>
        <label className={labelCls}>Description</label>
        <textarea
          className={inputCls + ' resize-none'}
          rows={3}
          value={node.description}
          onChange={e => set('description', e.target.value)}
          placeholder="What happens in this step..."
        />
      </div>

      {/* Input / Output */}
      <div>
        <label className={labelCls}>Input Required</label>
        <textarea
          className={inputCls + ' resize-none'}
          rows={2}
          value={node.inputRequired}
          onChange={e => set('inputRequired', e.target.value)}
          placeholder="What must be provided to start..."
        />
      </div>
      <div>
        <label className={labelCls}>Output Description</label>
        <textarea
          className={inputCls + ' resize-none'}
          rows={2}
          value={node.outputDescription}
          onChange={e => set('outputDescription', e.target.value)}
          placeholder="What comes out of this step..."
        />
      </div>

      {/* AI Prompt (only for ai_step) */}
      {node.type === 'ai_step' && (
        <div className={sectionCls}>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-px bg-purple-900/50" />
            <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider">AI Prompt</span>
            <div className="flex-1 h-px bg-purple-900/50" />
          </div>
          <div>
            <label className={labelCls}>Prompt</label>
            <textarea
              className={inputCls + ' resize-none font-mono text-[11px]'}
              rows={6}
              value={node.prompt}
              onChange={e => set('prompt', e.target.value)}
              placeholder="Enter AI prompt here..."
            />
          </div>
          <div className="mt-2">
            <label className={labelCls}>Prompt Notes</label>
            <textarea
              className={inputCls + ' resize-none'}
              rows={3}
              value={node.promptNotes}
              onChange={e => set('promptNotes', e.target.value)}
              placeholder="Tips for editing this prompt..."
            />
          </div>
        </div>
      )}

      {/* Assignment */}
      <div className={sectionCls}>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Assigned To</label>
            <input
              className={inputCls}
              value={node.assignedTo}
              onChange={e => set('assignedTo', e.target.value)}
              placeholder="Person / team..."
            />
          </div>
          <div>
            <label className={labelCls}>Est. Time</label>
            <input
              className={inputCls}
              value={node.estimatedTime}
              onChange={e => set('estimatedTime', e.target.value)}
              placeholder="5 phút..."
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className={labelCls}>Notes</label>
        <textarea
          className={inputCls + ' resize-none'}
          rows={3}
          value={node.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="Additional notes, checklists..."
        />
      </div>

      {/* Demo Output Images */}
      <div className={sectionCls}>
        <label className={labelCls}>Demo Output Images</label>
        <div
          className="border-2 border-dashed border-gray-700 rounded-lg p-3 text-center cursor-pointer hover:border-gray-600 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); uploadImage(e.dataTransfer.files); }}
        >
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            onChange={e => uploadImage(e.target.files)} />
          {uploadingImg
            ? <p className="text-xs text-gray-500">Uploading...</p>
            : <p className="text-xs text-gray-500">Drop images or click to upload</p>
          }
        </div>
        {(node.outputImages || []).length > 0 && (
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            {(node.outputImages || []).map(img => (
              <div key={img} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/flow-builder/${workflowId}/image/${img}`}
                  alt={img}
                  className="rounded object-cover w-full h-16 border border-gray-700 cursor-pointer"
                  onClick={() => setExpandImg(img)}
                />
                <button
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 text-white text-[9px] hidden group-hover:flex items-center justify-center hover:bg-red-600"
                  onClick={() => deleteImage(img)}
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete node */}
      <div className={sectionCls}>
        <button
          onClick={onDelete}
          className="w-full text-xs py-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-900/50 transition-colors"
        >
          Delete Node
        </button>
      </div>

      {/* Image lightbox */}
      {expandImg && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setExpandImg(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/flow-builder/${workflowId}/image/${expandImg}`}
            alt={expandImg}
            className="max-w-full max-h-full rounded-lg"
          />
        </div>
      )}
    </div>
  );
}

function EdgePanel({ edge, nodeMap, onChange, onDelete }: {
  edge: FlowEdge;
  nodeMap: Record<string, FlowNode>;
  onChange: (updated: FlowEdge) => void;
  onDelete: () => void;
}) {
  const set = (field: keyof FlowEdge, val: unknown) =>
    onChange({ ...edge, [field]: val });
  const inputCls = 'w-full text-xs rounded-md px-2.5 py-1.5 border border-gray-700 bg-gray-800 text-white outline-none focus:border-pink-500';
  const labelCls = 'text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block';

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-800/50 rounded-lg p-2">
        <span className="font-medium text-white">{nodeMap[edge.from]?.title || '?'}</span>
        <span>→</span>
        <span className="font-medium text-white">{nodeMap[edge.to]?.title || '?'}</span>
      </div>

      <div>
        <label className={labelCls}>Label</label>
        <input
          className={inputCls}
          value={edge.label}
          onChange={e => set('label', e.target.value)}
          placeholder="Describes what triggers this arrow..."
        />
      </div>

      <div>
        <label className={labelCls}>Condition</label>
        <select
          className={inputCls}
          value={edge.condition}
          onChange={e => set('condition', e.target.value as Condition)}
        >
          {(['always', 'yes', 'no', 'approved', 'rejected', 'trigger'] as Condition[]).map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CONDITION_COLORS[edge.condition] }} />
        <span>Condition color: {edge.condition}</span>
      </div>

      <button
        onClick={onDelete}
        className="w-full text-xs py-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-900/50 transition-colors"
      >
        Delete Edge
      </button>
    </div>
  );
}

function WorkflowPanel({ workflow, workflowId, onChange, onDelete }: {
  workflow: { name: string; description: string; category: string };
  workflowId: string;
  onChange: (field: string, val: string) => void;
  onDelete: () => void;
}) {
  const inputCls = 'w-full text-xs rounded-md px-2.5 py-1.5 border border-gray-700 bg-gray-800 text-white outline-none focus:border-pink-500';
  const labelCls = 'text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block';

  return (
    <div className="p-3 space-y-3">
      <div>
        <label className={labelCls}>Workflow Name</label>
        <input
          className={inputCls + ' text-sm font-semibold'}
          value={workflow.name}
          onChange={e => onChange('name', e.target.value)}
          placeholder="Workflow name..."
        />
      </div>
      <div>
        <label className={labelCls}>Description</label>
        <textarea
          className={inputCls + ' resize-none'}
          rows={3}
          value={workflow.description}
          onChange={e => onChange('description', e.target.value)}
          placeholder="Describe this workflow..."
        />
      </div>
      <div>
        <label className={labelCls}>Category</label>
        <select
          className={inputCls}
          value={workflow.category}
          onChange={e => onChange('category', e.target.value)}
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="border-t border-gray-800 pt-3 space-y-2">
        <a
          href={`/api/flow-builder/${workflowId}/claude-brief`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 w-full text-xs py-2 rounded-md border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition-colors bg-gray-800/50"
        >
          Export as Claude Brief ↗
        </a>
        <button
          onClick={onDelete}
          className="w-full text-xs py-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-900/50 transition-colors"
        >
          Delete Workflow
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FlowBuilderPage() {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // canvas state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // drag state
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<{ nodeId: string; ox: number; oy: number } | null>(null);
  const panning = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  // connect mode
  const [connectMode, setConnectMode] = useState(false);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);

  // ── Load workflow list ──────────────────────────────────────────────────────
  const loadList = useCallback(async () => {
    try {
      const res = await fetch('/api/flow-builder');
      if (res.ok) {
        const list = await res.json();
        setWorkflows(list);
        if (list.length > 0 && !activeId) {
          setActiveId(list[0].id);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useEffect(() => { loadList(); }, []);

  // ── Load active workflow ────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeId) return;
    setWorkflow(null);
    fetch(`/api/flow-builder/${activeId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setWorkflow(data); });
  }, [activeId]);

  // ── Save workflow ───────────────────────────────────────────────────────────
  const saveWorkflow = useCallback(async (wf: Workflow) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/flow-builder/${wf.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: wf.name, description: wf.description, category: wf.category, nodes: wf.nodes, edges: wf.edges }),
      });
      if (res.ok) {
        const updated = await res.json();
        setWorkflow(updated);
        setWorkflows(prev => prev.map(w => w.id === updated.id
          ? { id: updated.id, name: updated.name, description: updated.description, category: updated.category, updatedAt: updated.updatedAt }
          : w
        ));
      }
    } finally {
      setSaving(false);
    }
  }, []);

  const saveNow = useCallback(() => {
    if (workflow) saveWorkflow(workflow);
  }, [workflow, saveWorkflow]);

  // ── Create workflow ─────────────────────────────────────────────────────────
  const createWorkflow = async () => {
    const res = await fetch('/api/flow-builder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Workflow', description: '', category: 'general' }),
    });
    if (res.ok) {
      const w = await res.json();
      setWorkflows(prev => [{ id: w.id, name: w.name, description: w.description, category: w.category, updatedAt: w.updatedAt }, ...prev]);
      setActiveId(w.id);
    }
  };

  // ── Delete workflow ─────────────────────────────────────────────────────────
  const deleteWorkflow = async () => {
    if (!workflow) return;
    if (!confirm(`Delete "${workflow.name}"? This cannot be undone.`)) return;
    await fetch(`/api/flow-builder/${workflow.id}`, { method: 'DELETE' });
    const remaining = workflows.filter(w => w.id !== workflow.id);
    setWorkflows(remaining);
    setWorkflow(null);
    setActiveId(remaining.length > 0 ? remaining[0].id : null);
  };

  // ── Add node ────────────────────────────────────────────────────────────────
  const addNode = useCallback((type: NodeType) => {
    if (!workflow) return;
    const newNode: FlowNode = {
      id: uuid(),
      type,
      x: Math.round((200 - pan.x) / zoom + 100),
      y: Math.round((200 - pan.y) / zoom + 100),
      title: NODE_TYPE_LABELS[type],
      description: '', processType: type === 'ai_step' ? 'ai' : type === 'start' || type === 'end' ? '' : 'manual',
      tool: '', prompt: '', promptNotes: '',
      inputRequired: '', outputDescription: '',
      assignedTo: '', estimatedTime: '', notes: '', outputImages: [],
    };
    const updated = { ...workflow, nodes: [...workflow.nodes, newNode] };
    setWorkflow(updated);
    setSelectedNodeId(newNode.id);
    setSelectedEdgeId(null);
  }, [workflow, pan, zoom]);

  // ── Update node ─────────────────────────────────────────────────────────────
  const updateNode = useCallback((updated: FlowNode) => {
    if (!workflow) return;
    setWorkflow(prev => prev ? { ...prev, nodes: prev.nodes.map(n => n.id === updated.id ? updated : n) } : prev);
  }, [workflow]);

  // ── Delete selected ─────────────────────────────────────────────────────────
  const deleteSelected = useCallback(() => {
    if (!workflow) return;
    if (selectedNodeId) {
      setWorkflow(prev => prev ? {
        ...prev,
        nodes: prev.nodes.filter(n => n.id !== selectedNodeId),
        edges: prev.edges.filter(e => e.from !== selectedNodeId && e.to !== selectedNodeId),
      } : prev);
      setSelectedNodeId(null);
    } else if (selectedEdgeId) {
      setWorkflow(prev => prev ? { ...prev, edges: prev.edges.filter(e => e.id !== selectedEdgeId) } : prev);
      setSelectedEdgeId(null);
    }
  }, [workflow, selectedNodeId, selectedEdgeId]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
      if (e.key === 'Escape') {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setConnectMode(false);
        setConnectFrom(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [deleteSelected]);

  // ── SVG mouse events ────────────────────────────────────────────────────────
  const svgToWorld = (clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  };

  const onSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 1 || (e.button === 0 && (e.target as SVGElement).dataset.bg === 'true')) {
      panning.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
      e.preventDefault();
    }
  };

  const onSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (dragging.current) {
      const world = svgToWorld(e.clientX, e.clientY);
      const nx = Math.round(world.x - dragging.current.ox);
      const ny = Math.round(world.y - dragging.current.oy);
      setWorkflow(prev => prev ? {
        ...prev,
        nodes: prev.nodes.map(n => n.id === dragging.current!.nodeId ? { ...n, x: nx, y: ny } : n),
      } : prev);
    }
    if (panning.current) {
      const dx = e.clientX - panning.current.startX;
      const dy = e.clientY - panning.current.startY;
      setPan({ x: panning.current.panX + dx, y: panning.current.panY + dy });
    }
  };

  const onSvgMouseUp = () => {
    dragging.current = null;
    panning.current = null;
  };

  const onSvgWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setZoom(prev => Math.max(0.1, Math.min(3, prev + delta)));
  };

  const onNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (connectMode) return;
    const node = workflow?.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const world = svgToWorld(e.clientX, e.clientY);
    dragging.current = { nodeId, ox: world.x - node.x, oy: world.y - node.y };
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
  };

  const onNodeConnectClick = (nodeId: string) => {
    if (!connectMode) return;
    if (!connectFrom) {
      setConnectFrom(nodeId);
    } else {
      if (connectFrom !== nodeId) {
        const newEdge: FlowEdge = {
          id: uuid(),
          from: connectFrom,
          to: nodeId,
          label: '',
          condition: 'always',
        };
        setWorkflow(prev => prev ? { ...prev, edges: [...prev.edges, newEdge] } : prev);
        setSelectedEdgeId(newEdge.id);
        setSelectedNodeId(null);
      }
      setConnectFrom(null);
      setConnectMode(false);
    }
  };

  const onSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as SVGElement).dataset.bg === 'true') {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const nodeMap = useMemo(() =>
    Object.fromEntries((workflow?.nodes || []).map(n => [n.id, n])),
    [workflow?.nodes]
  );

  const selectedNode = selectedNodeId ? nodeMap[selectedNodeId] : null;
  const selectedEdge = selectedEdgeId ? workflow?.edges.find(e => e.id === selectedEdgeId) : null;

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    } catch { return ''; }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col" style={{ height: '100vh' }}>
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 h-12 border-b border-gray-800 bg-gray-900/80 flex-shrink-0">
        <Link href="/" className="text-xs text-gray-500 hover:text-white transition-colors flex-shrink-0">
          ← Studio
        </Link>
        <div className="w-px h-4 bg-gray-800 flex-shrink-0" />
        <input
          className="text-sm font-semibold bg-transparent border-none outline-none text-white placeholder-gray-600 min-w-0 flex-1"
          value={workflow?.name || ''}
          onChange={e => setWorkflow(prev => prev ? { ...prev, name: e.target.value } : prev)}
          placeholder="Workflow name..."
        />
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Zoom controls */}
          <button
            onClick={() => setZoom(z => Math.max(0.1, z - 0.1))}
            className="w-6 h-6 rounded text-gray-400 hover:text-white hover:bg-gray-800 text-sm flex items-center justify-center"
          >-</button>
          <span className="text-xs text-gray-500 w-10 text-center font-mono">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(z => Math.min(3, z + 0.1))}
            className="w-6 h-6 rounded text-gray-400 hover:text-white hover:bg-gray-800 text-sm flex items-center justify-center"
          >+</button>
          <button
            onClick={() => { setZoom(1); setPan({ x: 40, y: 40 }); }}
            className="text-[10px] px-2 py-0.5 rounded border border-gray-700 text-gray-500 hover:text-white hover:border-gray-500"
          >reset</button>

          <div className="w-px h-4 bg-gray-800" />

          {/* Connect mode */}
          <button
            onClick={() => { setConnectMode(c => !c); setConnectFrom(null); }}
            className={`text-xs px-2.5 py-1 rounded border transition-colors ${
              connectMode
                ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
            }`}
          >
            {connectMode
              ? (connectFrom ? `Click target node` : 'Click source node')
              : '🔗 Connect'}
          </button>

          {/* Add node dropdown */}
          <AddNodeMenu onAdd={addNode} />

          <div className="w-px h-4 bg-gray-800" />

          <button
            onClick={saveNow}
            disabled={saving || !workflow}
            className="text-xs px-3 py-1 rounded font-medium text-white disabled:opacity-50 transition-colors"
            style={{ backgroundColor: '#f43f5e' }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: workflow list */}
        <aside className="w-48 flex-shrink-0 border-r border-gray-800 bg-gray-900/50 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-800">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Workflows</span>
            <button
              onClick={createWorkflow}
              className="text-[10px] px-2 py-0.5 rounded bg-pink-600/20 text-pink-400 hover:bg-pink-600/30 border border-pink-900/50 transition-colors"
            >+ New</button>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {loading ? (
              <p className="text-xs text-gray-600 px-3 py-4">Loading...</p>
            ) : workflows.length === 0 ? (
              <p className="text-xs text-gray-600 px-3 py-4">No workflows yet</p>
            ) : (
              workflows.map(w => (
                <button
                  key={w.id}
                  onClick={() => setActiveId(w.id)}
                  className={`w-full text-left px-3 py-2 border-b border-gray-800/50 transition-colors ${
                    w.id === activeId
                      ? 'bg-pink-600/10 border-l-2 border-l-pink-500'
                      : 'hover:bg-gray-800/50'
                  }`}
                >
                  <div className="text-xs font-medium text-white leading-tight truncate">{w.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase"
                      style={{ backgroundColor: (CATEGORY_COLORS[w.category] || '#6b7280') + '22', color: CATEGORY_COLORS[w.category] || '#6b7280' }}
                    >{w.category}</span>
                    <span className="text-[9px] text-gray-600">{formatDate(w.updatedAt)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Center: canvas */}
        <div className="flex-1 relative overflow-hidden bg-gray-950">
          {!workflow ? (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              {loading ? 'Loading...' : 'Select or create a workflow'}
            </div>
          ) : (
            <svg
              ref={svgRef}
              className="w-full h-full"
              onMouseDown={onSvgMouseDown}
              onMouseMove={onSvgMouseMove}
              onMouseUp={onSvgMouseUp}
              onMouseLeave={onSvgMouseUp}
              onWheel={onSvgWheel}
              onClick={onSvgClick}
              style={{ cursor: panning.current ? 'grabbing' : 'default' }}
            >
              <defs>
                <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"
                  patternTransform={`translate(${pan.x % 24},${pan.y % 24})`}>
                  <circle cx="0.5" cy="0.5" r="0.5" fill="#374151" opacity="0.5" />
                </pattern>
                <marker id="arrow-def" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
                </marker>
                <marker id="arrow-sel" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#f43f5e" />
                </marker>
              </defs>

              {/* Dot grid background */}
              <rect width="100%" height="100%" fill="url(#grid)" data-bg="true" />

              <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
                {/* Edges */}
                {workflow.edges.map(edge => {
                  const from = nodeMap[edge.from];
                  const to = nodeMap[edge.to];
                  if (!from || !to) return null;
                  return (
                    <EdgeShape
                      key={edge.id}
                      edge={edge}
                      fromNode={from}
                      toNode={to}
                      selected={edge.id === selectedEdgeId}
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedEdgeId(edge.id);
                        setSelectedNodeId(null);
                      }}
                    />
                  );
                })}

                {/* Nodes */}
                {workflow.nodes.map(node => (
                  <NodeShape
                    key={node.id}
                    node={node}
                    selected={node.id === selectedNodeId}
                    onMouseDown={e => onNodeMouseDown(e, node.id)}
                    connectMode={connectMode}
                    onConnectClick={() => onNodeConnectClick(node.id)}
                  />
                ))}
              </g>

              {/* Connect mode overlay hint */}
              {connectMode && (
                <text x="50%" y={20} textAnchor="middle" fill="#f59e0b" fontSize={11}>
                  {connectFrom
                    ? 'Now click the target node — Esc to cancel'
                    : 'Click the source node — Esc to cancel'}
                </text>
              )}
            </svg>
          )}
        </div>

        {/* Right: detail panel */}
        <aside className="w-[340px] flex-shrink-0 border-l border-gray-800 bg-gray-900/50 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-800 flex-shrink-0">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              {selectedNode ? `Node: ${selectedNode.title}` : selectedEdge ? 'Edge' : 'Workflow'}
            </span>
            {(selectedNode || selectedEdge) && (
              <button
                onClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }}
                className="ml-auto text-[10px] text-gray-600 hover:text-gray-400"
              >✕ deselect</button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {selectedNode ? (
              <NodePanel
                node={selectedNode}
                workflowId={activeId!}
                onChange={updateNode}
                onDelete={deleteSelected}
              />
            ) : selectedEdge ? (
              <EdgePanel
                edge={selectedEdge}
                nodeMap={nodeMap}
                onChange={updated => {
                  setWorkflow(prev => prev ? {
                    ...prev,
                    edges: prev.edges.map(e => e.id === updated.id ? updated : e),
                  } : prev);
                }}
                onDelete={() => {
                  setWorkflow(prev => prev ? {
                    ...prev,
                    edges: prev.edges.filter(e => e.id !== selectedEdgeId),
                  } : prev);
                  setSelectedEdgeId(null);
                }}
              />
            ) : workflow ? (
              <WorkflowPanel
                workflow={{ name: workflow.name, description: workflow.description, category: workflow.category }}
                workflowId={workflow.id}
                onChange={(field, val) => setWorkflow(prev => prev ? { ...prev, [field]: val } : prev)}
                onDelete={deleteWorkflow}
              />
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─── Add Node Menu ─────────────────────────────────────────────────────────────

function AddNodeMenu({ onAdd }: { onAdd: (type: NodeType) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const items: [NodeType, string, string][] = [
    ['start', 'Start', '#22c55e'],
    ['step', 'Step', '#60a5fa'],
    ['ai_step', 'AI Step', '#a78bfa'],
    ['decision', 'Decision', '#f59e0b'],
    ['output', 'Output', '#10b981'],
    ['note', 'Note', '#fbbf24'],
    ['end', 'End', '#ef4444'],
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs px-2.5 py-1 rounded border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
      >
        + Add Node ▾
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[140px]">
          {items.map(([type, label, color]) => (
            <button
              key={type}
              onClick={() => { onAdd(type); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

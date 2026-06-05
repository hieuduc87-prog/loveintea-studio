'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { v4 as uuid } from 'uuid';

// ─── Types ───────────────────────────────────────────────────────────────────

type NodeType = 'start' | 'end' | 'step' | 'ai_step' | 'decision' | 'output' | 'note';
type ProcessType = 'manual' | 'ai' | 'automated' | '';
type Condition = 'always' | 'yes' | 'no' | 'approved' | 'rejected' | 'trigger';

interface FlowNode {
  id: string; type: NodeType; x: number; y: number;
  title: string; description: string; processType: ProcessType;
  tool: string; prompt: string; promptNotes: string;
  inputRequired: string; outputDescription: string;
  assignedTo: string; estimatedTime: string; notes: string;
  outputImages: string[];
}

interface FlowEdge {
  id: string; from: string; to: string; label: string; condition: Condition;
}

interface Workflow {
  id: string; name: string; description: string; category: string;
  nodes: FlowNode[]; edges: FlowEdge[]; createdAt: string; updatedAt: string;
}

interface WorkflowSummary {
  id: string; name: string; description: string; category: string; updatedAt: string;
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
  always: '#6b7280', yes: '#10b981', no: '#ef4444',
  approved: '#10b981', rejected: '#ef4444', trigger: '#f59e0b',
};

const TOOLS = ['—', 'Claude AI', 'GPT-image-2', 'DALL-E 3', 'Canva', 'n8n', 'Figma', 'LoveinTea Studio', 'Manual', 'Custom...'];
const CATEGORIES = ['image', 'content', 'blog', 'social', 'video', 'general'];
const CATEGORY_COLORS: Record<string, string> = {
  image: '#a78bfa', content: '#60a5fa', blog: '#34d399',
  social: '#f472b6', video: '#f97316', general: '#6b7280',
};

const NODE_PALETTE: [NodeType, string, string][] = [
  ['start', 'Start', '#22c55e'],
  ['step', 'Step', '#60a5fa'],
  ['ai_step', 'AI Step', '#a78bfa'],
  ['decision', 'Decision', '#f59e0b'],
  ['output', 'Output', '#10b981'],
  ['note', 'Note', '#fbbf24'],
  ['end', 'End', '#ef4444'],
];

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function getNodeCenter(node: FlowNode) {
  if (node.type === 'decision') return { cx: node.x + DIAMOND_SIZE / 2, cy: node.y + DIAMOND_SIZE / 2 };
  if (node.type === 'start' || node.type === 'end') return { cx: node.x + ELLIPSE_RX, cy: node.y + ELLIPSE_RY };
  return { cx: node.x + NODE_W / 2, cy: node.y + NODE_H / 2 };
}

function getPortOut(node: FlowNode) {
  const c = getNodeCenter(node);
  if (node.type === 'decision') return { x: node.x + DIAMOND_SIZE, y: c.cy };
  if (node.type === 'start' || node.type === 'end') return { x: node.x + ELLIPSE_RX * 2, y: c.cy };
  return { x: node.x + NODE_W, y: c.cy };
}

function getPortIn(node: FlowNode) {
  const c = getNodeCenter(node);
  if (node.type === 'decision') return { x: node.x, y: c.cy };
  if (node.type === 'start' || node.type === 'end') return { x: node.x, y: c.cy };
  return { x: node.x, y: c.cy };
}

function bezierPath(x1: number, y1: number, x2: number, y2: number) {
  const dx = Math.abs(x2 - x1) * 0.5;
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}

function hitTestNode(node: FlowNode, wx: number, wy: number) {
  if (node.type === 'decision') {
    const hx = node.x + DIAMOND_SIZE / 2;
    const hy = node.y + DIAMOND_SIZE / 2;
    return Math.abs(wx - hx) + Math.abs(wy - hy) <= DIAMOND_SIZE / 2 + 8;
  }
  if (node.type === 'start' || node.type === 'end') {
    const dx = (wx - (node.x + ELLIPSE_RX)) / (ELLIPSE_RX + 8);
    const dy = (wy - (node.y + ELLIPSE_RY)) / (ELLIPSE_RY + 8);
    return dx * dx + dy * dy <= 1;
  }
  return wx >= node.x - 8 && wx <= node.x + NODE_W + 8 && wy >= node.y - 8 && wy <= node.y + NODE_H + 8;
}

// ─── Node rendering ───────────────────────────────────────────────────────────

interface NodeShapeProps {
  node: FlowNode;
  selected: boolean;
  hovered: boolean;
  isDropTarget: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onPortMouseDown: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function NodeShape({ node, selected, hovered, isDropTarget, onMouseDown, onMouseEnter, onMouseLeave, onPortMouseDown, onContextMenu }: NodeShapeProps) {
  const showPort = hovered && node.type !== 'end';
  const portOut = getPortOut(node);
  const portIn = getPortIn(node);

  const dropRing = isDropTarget ? 2.5 : 0;

  if (node.type === 'start' || node.type === 'end') {
    const fill = node.type === 'start' ? '#052e16' : '#450a0a';
    const stroke = node.type === 'start' ? '#22c55e' : '#ef4444';
    const textColor = node.type === 'start' ? '#86efac' : '#fca5a5';
    return (
      <g transform={`translate(${node.x},${node.y})`}
        onMouseDown={onMouseDown} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
        onContextMenu={onContextMenu}
        style={{ cursor: 'move' }}>
        {isDropTarget && (
          <ellipse cx={ELLIPSE_RX} cy={ELLIPSE_RY} rx={ELLIPSE_RX + 8} ry={ELLIPSE_RY + 8}
            fill="none" stroke="#10b981" strokeWidth={2} strokeDasharray="4,3" opacity={0.8} />
        )}
        <ellipse cx={ELLIPSE_RX} cy={ELLIPSE_RY} rx={ELLIPSE_RX} ry={ELLIPSE_RY}
          fill={fill} stroke={selected ? '#f43f5e' : stroke} strokeWidth={selected ? 2 : 1.5} />
        <text x={ELLIPSE_RX} y={ELLIPSE_RY + 4} textAnchor="middle"
          fill={textColor} fontSize={12} fontWeight="600" style={{ pointerEvents: 'none', userSelect: 'none' }}>
          {node.title}
        </text>
        {showPort && (
          <circle cx={portOut.x - node.x + 8} cy={ELLIPSE_RY}
            r={6} fill="#10b981" stroke="#fff" strokeWidth={1.5}
            style={{ cursor: 'crosshair' }}
            onMouseDown={e => { e.stopPropagation(); onPortMouseDown(e); }} />
        )}
      </g>
    );
  }

  if (node.type === 'decision') {
    const half = DIAMOND_SIZE / 2;
    const pts = `${half},0 ${DIAMOND_SIZE},${half} ${half},${DIAMOND_SIZE} 0,${half}`;
    return (
      <g transform={`translate(${node.x},${node.y})`}
        onMouseDown={onMouseDown} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
        onContextMenu={onContextMenu}
        style={{ cursor: 'move' }}>
        {isDropTarget && (
          <polygon points={`${half},-8 ${DIAMOND_SIZE + 8},${half} ${half},${DIAMOND_SIZE + 8} -8,${half}`}
            fill="none" stroke="#10b981" strokeWidth={2} strokeDasharray="4,3" opacity={0.8} />
        )}
        <polygon points={pts} fill="#451a03"
          stroke={selected ? '#f43f5e' : '#f59e0b'} strokeWidth={selected ? 2 : 1.5} />
        <text x={half} y={half - 4} textAnchor="middle"
          fill="#fde68a" fontSize={10} fontWeight="700" style={{ pointerEvents: 'none', userSelect: 'none' }}>
          {node.title.length > 10 ? node.title.slice(0, 10) + '…' : node.title}
        </text>
        <text x={half} y={half + 8} textAnchor="middle"
          fill="#78716c" fontSize={8} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          decision
        </text>
        {showPort && (
          <circle cx={DIAMOND_SIZE + 8} cy={half}
            r={6} fill="#10b981" stroke="#fff" strokeWidth={1.5}
            style={{ cursor: 'crosshair' }}
            onMouseDown={e => { e.stopPropagation(); onPortMouseDown(e); }} />
        )}
      </g>
    );
  }

  const styleMap: Record<NodeType, { fill: string; stroke: string; badge: string; badgeColor: string }> = {
    step:     { fill: '#1e3a5f', stroke: '#60a5fa', badge: 'step', badgeColor: '#93c5fd' },
    ai_step:  { fill: '#2d1b69', stroke: '#a78bfa', badge: 'AI', badgeColor: '#c4b5fd' },
    output:   { fill: '#052e16', stroke: '#10b981', badge: 'out', badgeColor: '#6ee7b7' },
    note:     { fill: '#422006', stroke: '#fbbf24', badge: 'note', badgeColor: '#fde68a' },
    start:    { fill: '#052e16', stroke: '#22c55e', badge: '', badgeColor: '' },
    end:      { fill: '#450a0a', stroke: '#ef4444', badge: '', badgeColor: '' },
    decision: { fill: '#451a03', stroke: '#f59e0b', badge: '', badgeColor: '' },
  };
  const s = styleMap[node.type] || styleMap.step;
  const truncTitle = node.title.length > 20 ? node.title.slice(0, 20) + '…' : node.title;

  return (
    <g transform={`translate(${node.x},${node.y})`}
      onMouseDown={onMouseDown} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
      onContextMenu={onContextMenu}
      style={{ cursor: 'move' }}>
      {isDropTarget && (
        <rect width={NODE_W + 16} height={NODE_H + 16} x={-8} y={-8}
          rx={node.type === 'note' ? 6 : 12} fill="none"
          stroke="#10b981" strokeWidth={2} strokeDasharray="4,3" opacity={0.8} />
      )}
      <rect width={NODE_W} height={NODE_H} rx={node.type === 'note' ? 4 : 8}
        fill={s.fill} stroke={selected ? '#f43f5e' : s.stroke} strokeWidth={selected ? 2 : 1.5} />
      <text x={10} y={21} fill="white" fontSize={12} fontWeight="600"
        style={{ pointerEvents: 'none', userSelect: 'none' }}>
        {node.type === 'note' ? <tspan fontStyle="italic">{truncTitle}</tspan> : truncTitle}
      </text>
      <text x={10} y={38} fill={s.badgeColor} fontSize={9}
        style={{ pointerEvents: 'none', userSelect: 'none' }}>
        {s.badge}
        {node.processType === 'manual' && ' 🤚'}
        {node.processType === 'ai' && ' 🤖'}
        {node.processType === 'automated' && ' ⚙️'}
      </text>
      {node.type === 'ai_step' && (
        <>
          <rect x={NODE_W - 24} y={4} width={20} height={14} rx={3} fill="#7c3aed" />
          <text x={NODE_W - 14} y={14} textAnchor="middle" fill="white" fontSize={8} fontWeight="700"
            style={{ pointerEvents: 'none', userSelect: 'none' }}>AI</text>
        </>
      )}
      {/* Output port — appears on hover */}
      {showPort && (
        <circle cx={NODE_W + 8} cy={NODE_H / 2}
          r={6} fill="#10b981" stroke="#fff" strokeWidth={1.5}
          style={{ cursor: 'crosshair' }}
          onMouseDown={e => { e.stopPropagation(); onPortMouseDown(e); }} />
      )}
    </g>
  );
}

// ─── Edge rendering ───────────────────────────────────────────────────────────

function EdgeShape({ edge, fromNode, toNode, selected, onClick }: {
  edge: FlowEdge; fromNode: FlowNode; toNode: FlowNode;
  selected: boolean; onClick: (e: React.MouseEvent) => void;
}) {
  const out = getPortOut(fromNode);
  const inp = getPortIn(toNode);
  const d = bezierPath(out.x, out.y, inp.x, inp.y);
  const color = selected ? '#f43f5e' : (CONDITION_COLORS[edge.condition] || '#6b7280');
  const mx = (out.x + inp.x) / 2;
  const my = (out.y + inp.y) / 2;

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
      <path d={d} fill="none" stroke={color} strokeWidth={selected ? 2 : 1.5}
        strokeDasharray={edge.condition === 'always' ? undefined : '6,3'}
        markerEnd={`url(#arrow-${selected ? 'sel' : 'def'})`} />
      {edge.label && (
        <text x={mx} y={my - 6} textAnchor="middle" fill="#9ca3af" fontSize={9}
          style={{ pointerEvents: 'none', userSelect: 'none' }}>
          {edge.label}
        </text>
      )}
      {edge.condition !== 'always' && (
        <text x={mx} y={my + 14} textAnchor="middle" fill={color} fontSize={8} fontWeight="600"
          style={{ pointerEvents: 'none', userSelect: 'none' }}>
          {edge.condition}
        </text>
      )}
    </g>
  );
}

// ─── Node Context Menu (right-click) ─────────────────────────────────────────

function NodeContextMenu({ sx, sy, onDelete, onDuplicate, onConnect, onAddAfter, onClose }: {
  sx: number; sy: number;
  onDelete: () => void;
  onDuplicate: () => void;
  onConnect: () => void;
  onAddAfter: (type: NodeType) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [showAddAfter, setShowAddAfter] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const Item = ({ onClick, children, danger }: { onClick: () => void; children: React.ReactNode; danger?: boolean }) => (
    <button onClick={() => { onClick(); onClose(); }}
      className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs transition-colors text-left ${
        danger ? 'text-red-400 hover:bg-red-500/10' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
      }`}>
      {children}
    </button>
  );

  return (
    <div ref={ref}
      className="absolute z-50 bg-gray-900/95 border border-gray-700 rounded-xl shadow-2xl py-1 min-w-[160px] backdrop-blur"
      style={{ left: sx, top: sy }}>
      <Item onClick={onConnect}>🔗 Connect from here</Item>
      <Item onClick={onDuplicate}>📋 Duplicate</Item>
      <div className="border-t border-gray-800 my-1" />
      <div className="relative">
        <button
          onMouseEnter={() => setShowAddAfter(true)}
          onMouseLeave={() => setShowAddAfter(false)}
          onClick={() => setShowAddAfter(v => !v)}
          className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800 hover:text-white transition-colors">
          ➕ Add node after ›
        </button>
        {showAddAfter && (
          <div
            onMouseEnter={() => setShowAddAfter(true)}
            onMouseLeave={() => setShowAddAfter(false)}
            className="absolute left-full top-0 ml-1 bg-gray-900/95 border border-gray-700 rounded-xl shadow-2xl py-1 min-w-[130px] backdrop-blur">
            {NODE_PALETTE.map(([type, label, color]) => (
              <button key={type} onClick={() => { onAddAfter(type); onClose(); }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800 hover:text-white transition-colors">
                <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="border-t border-gray-800 my-1" />
      <Item onClick={onDelete} danger>🗑 Delete node</Item>
    </div>
  );
}

// ─── Quick-Add menu (appears at cursor on double-click) ───────────────────────

function QuickAddMenu({ screenX, screenY, onAdd, onClose }: {
  screenX: number; screenY: number;
  onAdd: (type: NodeType) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 bg-gray-900/95 border border-gray-700 rounded-xl shadow-2xl p-2 backdrop-blur"
      style={{ left: screenX, top: screenY, transform: 'translate(-50%, -8px)' }}
    >
      <p className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold px-1 pb-1.5">Add Node</p>
      <div className="grid grid-cols-4 gap-1">
        {NODE_PALETTE.map(([type, label, color]) => (
          <button
            key={type}
            onClick={() => { onAdd(type); onClose(); }}
            className="flex flex-col items-center gap-1 px-2 py-2 rounded-lg hover:bg-gray-800 transition-colors group"
          >
            <div className="w-5 h-5 rounded flex items-center justify-center"
              style={{ backgroundColor: color + '22', border: `1.5px solid ${color}` }}>
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
            </div>
            <span className="text-[9px] text-gray-400 group-hover:text-white">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Node Panel ───────────────────────────────────────────────────────────────

function NodePanel({ node, workflowId, onChange, onDelete }: {
  node: FlowNode; workflowId: string;
  onChange: (updated: FlowNode) => void; onDelete: () => void;
}) {
  const [uploadingImg, setUploadingImg] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [expandImg, setExpandImg] = useState<string | null>(null);

  const set = (field: keyof FlowNode, val: unknown) => onChange({ ...node, [field]: val });

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

  const inputCls = 'w-full text-xs rounded-md px-2.5 py-1.5 border border-gray-700 bg-gray-800 text-white outline-none focus:border-pink-500 placeholder-gray-600';
  const labelCls = 'text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block';
  const sectionCls = 'border-t border-gray-800 pt-3 mt-3';

  return (
    <div className="p-3 space-y-3 text-sm">
      <div>
        <label className={labelCls}>Title</label>
        <input className={inputCls + ' text-sm font-semibold'} value={node.title}
          onChange={e => set('title', e.target.value)} placeholder="Step title..." />
      </div>

      <div>
        <label className={labelCls}>Type</label>
        <div className="flex flex-wrap gap-1">
          {(['start', 'step', 'ai_step', 'decision', 'output', 'end', 'note'] as NodeType[]).map(t => (
            <button key={t} onClick={() => set('type', t)}
              className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors ${
                node.type === t
                  ? 'bg-pink-600/20 border-pink-500 text-pink-300'
                  : 'border-gray-700 text-gray-500 hover:border-gray-500 hover:text-white'
              }`}>
              {NODE_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelCls}>Description</label>
        <textarea className={inputCls + ' resize-none'} rows={2} value={node.description}
          onChange={e => set('description', e.target.value)} placeholder="What happens in this step..." />
      </div>

      {node.type !== 'start' && node.type !== 'end' && node.type !== 'note' && (
        <>
          <div>
            <label className={labelCls}>Process Type</label>
            <div className="flex gap-1">
              {(['manual', 'ai', 'automated'] as ProcessType[]).map(pt => (
                <button key={pt} onClick={() => set('processType', pt)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                    node.processType === pt
                      ? 'bg-pink-600/20 border-pink-500 text-pink-300'
                      : 'border-gray-700 text-gray-500 hover:border-gray-500'
                  }`}>
                  {pt === 'manual' ? '🤚 Manual' : pt === 'ai' ? '🤖 AI' : '⚙️ Auto'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Tool</label>
            <select className={inputCls} value={node.tool} onChange={e => set('tool', e.target.value)}>
              {TOOLS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className={sectionCls}>
            <label className={labelCls}>Input Required</label>
            <input className={inputCls} value={node.inputRequired}
              onChange={e => set('inputRequired', e.target.value)} placeholder="What input does this step need..." />
          </div>

          <div>
            <label className={labelCls}>Output</label>
            <input className={inputCls} value={node.outputDescription}
              onChange={e => set('outputDescription', e.target.value)} placeholder="What this step produces..." />
          </div>

          {(node.type === 'ai_step' || node.processType === 'ai') && (
            <div className={sectionCls}>
              <label className={labelCls}>AI Prompt</label>
              <textarea className={inputCls + ' resize-none font-mono text-[11px]'} rows={4}
                value={node.prompt} onChange={e => set('prompt', e.target.value)}
                placeholder="Prompt template..." />
              <label className={labelCls + ' mt-2'}>Prompt Notes</label>
              <input className={inputCls} value={node.promptNotes}
                onChange={e => set('promptNotes', e.target.value)} placeholder="Notes on using this prompt..." />
            </div>
          )}

          <div className={sectionCls}>
            <label className={labelCls}>Assigned To</label>
            <input className={inputCls} value={node.assignedTo}
              onChange={e => set('assignedTo', e.target.value)} placeholder="Person or team..." />
          </div>
          <div>
            <label className={labelCls}>Estimated Time</label>
            <input className={inputCls} value={node.estimatedTime}
              onChange={e => set('estimatedTime', e.target.value)} placeholder="e.g. 30 min, 2h..." />
          </div>
        </>
      )}

      <div className={sectionCls}>
        <label className={labelCls}>Notes</label>
        <textarea className={inputCls + ' resize-none'} rows={2} value={node.notes}
          onChange={e => set('notes', e.target.value)} placeholder="Any notes..." />
      </div>

      {/* Image attachments */}
      <div className={sectionCls}>
        <div className="flex items-center justify-between mb-1">
          <label className={labelCls} style={{ marginBottom: 0 }}>Output Images</label>
          <button onClick={() => fileRef.current?.click()}
            className="text-[10px] px-2 py-0.5 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors">
            {uploadingImg ? '…' : '+ Upload'}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => uploadImage(e.target.files)} />
        {(node.outputImages || []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {node.outputImages.map(fn => (
              <div key={fn} className="relative group">
                <img src={`/api/flow-builder/${workflowId}/image/${fn}`} alt={fn}
                  className="w-14 h-14 object-cover rounded cursor-pointer border border-gray-700 hover:border-gray-500"
                  onClick={() => setExpandImg(`/api/flow-builder/${workflowId}/image/${fn}`)} />
                <button onClick={() => onChange({ ...node, outputImages: node.outputImages.filter(f => f !== fn) })}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-white text-[9px] opacity-0 group-hover:opacity-100 flex items-center justify-center">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {expandImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setExpandImg(null)}>
          <img src={expandImg} className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
        </div>
      )}

      <div className={sectionCls}>
        <button onClick={onDelete}
          className="w-full text-xs py-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-900/50 transition-colors">
          Delete Node
        </button>
      </div>
    </div>
  );
}

// ─── Edge Panel ───────────────────────────────────────────────────────────────

function EdgePanel({ edge, nodeMap, onChange, onDelete }: {
  edge: FlowEdge; nodeMap: Record<string, FlowNode>;
  onChange: (updated: FlowEdge) => void; onDelete: () => void;
}) {
  const set = (field: keyof FlowEdge, val: unknown) => onChange({ ...edge, [field]: val });
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
        <input className={inputCls} value={edge.label} onChange={e => set('label', e.target.value)}
          placeholder="Describes what triggers this arrow..." />
      </div>
      <div>
        <label className={labelCls}>Condition</label>
        <div className="flex flex-wrap gap-1">
          {(['always', 'yes', 'no', 'approved', 'rejected', 'trigger'] as Condition[]).map(c => (
            <button key={c} onClick={() => set('condition', c)}
              className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors ${
                edge.condition === c
                  ? 'bg-pink-600/20 border-pink-500 text-pink-300'
                  : 'border-gray-700 text-gray-500 hover:border-gray-500'
              }`}>
              <span className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle"
                style={{ backgroundColor: CONDITION_COLORS[c] }} />
              {c}
            </button>
          ))}
        </div>
      </div>
      <button onClick={onDelete}
        className="w-full text-xs py-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-900/50 transition-colors">
        Delete Edge
      </button>
    </div>
  );
}

// ─── Workflow Panel ───────────────────────────────────────────────────────────

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
        <input className={inputCls + ' text-sm font-semibold'} value={workflow.name}
          onChange={e => onChange('name', e.target.value)} placeholder="Workflow name..." />
      </div>
      <div>
        <label className={labelCls}>Description</label>
        <textarea className={inputCls + ' resize-none'} rows={3} value={workflow.description}
          onChange={e => onChange('description', e.target.value)} placeholder="Describe this workflow..." />
      </div>
      <div>
        <label className={labelCls}>Category</label>
        <select className={inputCls} value={workflow.category} onChange={e => onChange('category', e.target.value)}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="border-t border-gray-800 pt-3 space-y-2">
        <a href={`/api/flow-builder/${workflowId}/claude-brief`} target="_blank" rel="noreferrer"
          className="flex items-center justify-center gap-2 w-full text-xs py-2 rounded-md border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition-colors bg-gray-800/50">
          Export as Claude Brief ↗
        </a>
        <button onClick={onDelete}
          className="w-full text-xs py-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-900/50 transition-colors">
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

  // canvas
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // drag-to-connect state
  const [connectDrag, setConnectDrag] = useState<{
    fromId: string; fromX: number; fromY: number; curX: number; curY: number;
  } | null>(null);

  // quick-add menu (double-click canvas)
  const [quickAdd, setQuickAdd] = useState<{ sx: number; sy: number; wx: number; wy: number } | null>(null);

  // right-click context menu
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; sx: number; sy: number } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<{ nodeId: string; ox: number; oy: number } | null>(null);
  const panning = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const isConnecting = connectDrag !== null;

  // ── Load ─────────────────────────────────────────────────────────────────────
  const loadList = useCallback(async () => {
    try {
      const res = await fetch('/api/flow-builder');
      if (res.ok) {
        const list = await res.json();
        setWorkflows(list);
        if (list.length > 0 && !activeId) setActiveId(list[0].id);
      }
    } finally { setLoading(false); }
  }, [activeId]);

  useEffect(() => { loadList(); }, []);

  useEffect(() => {
    if (!activeId) return;
    setWorkflow(null);
    fetch(`/api/flow-builder/${activeId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setWorkflow(data); });
  }, [activeId]);

  // ── Save ─────────────────────────────────────────────────────────────────────
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
          : w));
      }
    } finally { setSaving(false); }
  }, []);

  const saveNow = useCallback(() => { if (workflow) saveWorkflow(workflow); }, [workflow, saveWorkflow]);

  // ── Create workflow ───────────────────────────────────────────────────────────
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

  const deleteWorkflow = async () => {
    if (!workflow) return;
    if (!confirm(`Delete "${workflow.name}"? This cannot be undone.`)) return;
    await fetch(`/api/flow-builder/${workflow.id}`, { method: 'DELETE' });
    const remaining = workflows.filter(w => w.id !== workflow.id);
    setWorkflows(remaining);
    setWorkflow(null);
    setActiveId(remaining.length > 0 ? remaining[0].id : null);
  };

  // ── Node ops ─────────────────────────────────────────────────────────────────
  const addNode = useCallback((type: NodeType, wx?: number, wy?: number) => {
    if (!workflow) return;
    const newNode: FlowNode = {
      id: uuid(), type,
      x: wx !== undefined ? Math.round(wx) : Math.round((200 - pan.x) / zoom + 60),
      y: wy !== undefined ? Math.round(wy) : Math.round((200 - pan.y) / zoom + 60),
      title: NODE_TYPE_LABELS[type],
      description: '',
      processType: type === 'ai_step' ? 'ai' : (type === 'start' || type === 'end') ? '' : 'manual',
      tool: '', prompt: '', promptNotes: '',
      inputRequired: '', outputDescription: '',
      assignedTo: '', estimatedTime: '', notes: '', outputImages: [],
    };
    setWorkflow(prev => prev ? { ...prev, nodes: [...prev.nodes, newNode] } : prev);
    setSelectedNodeId(newNode.id);
    setSelectedEdgeId(null);
  }, [workflow, pan, zoom]);

  const updateNode = useCallback((updated: FlowNode) => {
    setWorkflow(prev => prev ? { ...prev, nodes: prev.nodes.map(n => n.id === updated.id ? updated : n) } : prev);
  }, []);

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

  const duplicateNode = useCallback((nodeId: string) => {
    if (!workflow) return;
    const orig = workflow.nodes.find(n => n.id === nodeId);
    if (!orig) return;
    const newNode = { ...orig, id: uuid(), x: orig.x + 24, y: orig.y + 24 };
    setWorkflow(prev => prev ? { ...prev, nodes: [...prev.nodes, newNode] } : prev);
    setSelectedNodeId(newNode.id);
    setSelectedEdgeId(null);
  }, [workflow]);

  const startConnectFromNode = useCallback((nodeId: string) => {
    const node = workflow?.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const port = getPortOut(node);
    setConnectDrag({ fromId: nodeId, fromX: port.x, fromY: port.y, curX: port.x + 40, curY: port.y });
    setHoveredNodeId(null);
  }, [workflow]);

  const addNodeAfter = useCallback((sourceNodeId: string, type: NodeType) => {
    if (!workflow) return;
    const source = workflow.nodes.find(n => n.id === sourceNodeId);
    if (!source) return;
    const port = getPortOut(source);
    const newNode: FlowNode = {
      id: uuid(), type,
      x: Math.round(port.x + 40),
      y: Math.round(source.y - (type === 'decision' ? DIAMOND_SIZE / 2 - NODE_H / 2 : 0)),
      title: NODE_TYPE_LABELS[type], description: '',
      processType: type === 'ai_step' ? 'ai' : (type === 'start' || type === 'end') ? '' : 'manual',
      tool: '', prompt: '', promptNotes: '', inputRequired: '', outputDescription: '',
      assignedTo: '', estimatedTime: '', notes: '', outputImages: [],
    };
    const newEdge: FlowEdge = { id: uuid(), from: sourceNodeId, to: newNode.id, label: '', condition: 'always' };
    setWorkflow(prev => prev ? { ...prev, nodes: [...prev.nodes, newNode], edges: [...prev.edges, newEdge] } : prev);
    setSelectedNodeId(newNode.id);
    setSelectedEdgeId(null);
  }, [workflow]);

  // ── Keyboard ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
      if (e.key === 'Escape') {
        setSelectedNodeId(null); setSelectedEdgeId(null);
        setConnectDrag(null); setQuickAdd(null); setContextMenu(null);
      }
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveNow(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [deleteSelected, saveNow]);

  // ── SVG coordinate helpers ───────────────────────────────────────────────────
  const svgToWorld = (clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: (clientX - rect.left - pan.x) / zoom, y: (clientY - rect.top - pan.y) / zoom };
  };

  // ── SVG events ───────────────────────────────────────────────────────────────
  const onSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 1 || (e.button === 0 && (e.target as SVGElement).dataset.bg === 'true')) {
      if (isConnecting) { setConnectDrag(null); return; }
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
      setPan({
        x: panning.current.panX + (e.clientX - panning.current.startX),
        y: panning.current.panY + (e.clientY - panning.current.startY),
      });
    }
    if (connectDrag) {
      const world = svgToWorld(e.clientX, e.clientY);
      // find hovered node
      const hit = workflow?.nodes.find(n => n.id !== connectDrag.fromId && hitTestNode(n, world.x, world.y));
      setHoveredNodeId(hit?.id ?? null);
      setConnectDrag(prev => prev ? { ...prev, curX: world.x, curY: world.y } : null);
    }
  };

  const onSvgMouseUp = () => {
    dragging.current = null;
    panning.current = null;
    if (connectDrag) {
      if (hoveredNodeId && hoveredNodeId !== connectDrag.fromId) {
        const newEdge: FlowEdge = { id: uuid(), from: connectDrag.fromId, to: hoveredNodeId, label: '', condition: 'always' };
        setWorkflow(prev => prev ? { ...prev, edges: [...prev.edges, newEdge] } : prev);
        setSelectedEdgeId(newEdge.id);
        setSelectedNodeId(null);
      }
      setConnectDrag(null);
      setHoveredNodeId(null);
    }
  };

  const onSvgDblClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as SVGElement).dataset.bg !== 'true') return;
    const world = svgToWorld(e.clientX, e.clientY);
    const rect = svgRef.current!.getBoundingClientRect();
    setQuickAdd({
      sx: e.clientX - rect.left,
      sy: e.clientY - rect.top,
      wx: world.x,
      wy: world.y,
    });
  };

  const onSvgWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    setZoom(prev => Math.max(0.1, Math.min(3, prev + (-e.deltaY * 0.001))));
  };

  const onSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as SVGElement).dataset.bg === 'true') {
      setSelectedNodeId(null); setSelectedEdgeId(null);
      setQuickAdd(null);
    }
  };

  const onNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setContextMenu(null);
    if (isConnecting) return;
    const node = workflow?.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const world = svgToWorld(e.clientX, e.clientY);
    dragging.current = { nodeId, ox: world.x - node.x, oy: world.y - node.y };
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
  };

  const onNodeRightClick = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = svgRef.current!.getBoundingClientRect();
    setContextMenu({ nodeId, sx: e.clientX - rect.left, sy: e.clientY - rect.top });
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
  };

  const onPortMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = workflow?.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const port = getPortOut(node);
    setConnectDrag({ fromId: nodeId, fromX: port.x, fromY: port.y, curX: port.x, curY: port.y });
    setHoveredNodeId(null);
  };

  // ── Memo ─────────────────────────────────────────────────────────────────────
  const nodeMap = useMemo(() =>
    Object.fromEntries((workflow?.nodes || []).map(n => [n.id, n])), [workflow?.nodes]);

  const selectedNode = selectedNodeId ? nodeMap[selectedNodeId] : null;
  const selectedEdge = selectedEdgeId ? workflow?.edges.find(e => e.id === selectedEdgeId) : null;

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }); }
    catch { return ''; }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col" style={{ height: '100vh' }}>
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 h-12 border-b border-gray-800 bg-gray-900/80 flex-shrink-0">
        <Link href="/" className="text-xs text-gray-500 hover:text-white transition-colors flex-shrink-0">← Studio</Link>
        <div className="w-px h-4 bg-gray-800 flex-shrink-0" />
        <input
          className="text-sm font-semibold bg-transparent border-none outline-none text-white placeholder-gray-600 min-w-0 flex-1"
          value={workflow?.name || ''}
          onChange={e => setWorkflow(prev => prev ? { ...prev, name: e.target.value } : prev)}
          placeholder="Workflow name..."
        />

        {/* Hint when connecting */}
        {isConnecting && (
          <span className="text-xs text-amber-400 animate-pulse flex-shrink-0">
            🔗 Drag to target node — Esc to cancel
          </span>
        )}

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Zoom */}
          <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))}
            className="w-6 h-6 rounded text-gray-400 hover:text-white hover:bg-gray-800 text-sm flex items-center justify-center">-</button>
          <span className="text-xs text-gray-500 w-10 text-center font-mono">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.1))}
            className="w-6 h-6 rounded text-gray-400 hover:text-white hover:bg-gray-800 text-sm flex items-center justify-center">+</button>
          <button onClick={() => { setZoom(1); setPan({ x: 40, y: 40 }); }}
            className="text-[10px] px-2 py-0.5 rounded border border-gray-700 text-gray-500 hover:text-white hover:border-gray-500">reset</button>
          <div className="w-px h-4 bg-gray-800" />

          {/* Add node */}
          <AddNodeMenu onAdd={type => addNode(type)} />
          <div className="w-px h-4 bg-gray-800" />

          {/* Save (Ctrl+S) */}
          <button onClick={saveNow} disabled={saving || !workflow}
            className="text-xs px-3 py-1 rounded font-medium text-white disabled:opacity-50 transition-colors"
            style={{ backgroundColor: '#f43f5e' }}>
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
            <button onClick={createWorkflow}
              className="text-[10px] px-2 py-0.5 rounded bg-pink-600/20 text-pink-400 hover:bg-pink-600/30 border border-pink-900/50 transition-colors">
              + New
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {loading ? (
              <p className="text-xs text-gray-600 px-3 py-4">Loading...</p>
            ) : workflows.length === 0 ? (
              <p className="text-xs text-gray-600 px-3 py-4">No workflows yet</p>
            ) : (
              workflows.map(w => (
                <button key={w.id} onClick={() => setActiveId(w.id)}
                  className={`w-full text-left px-3 py-2 border-b border-gray-800/50 transition-colors ${
                    w.id === activeId ? 'bg-pink-600/10 border-l-2 border-l-pink-500' : 'hover:bg-gray-800/50'
                  }`}>
                  <div className="text-xs font-medium text-white leading-tight truncate">{w.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase"
                      style={{ backgroundColor: (CATEGORY_COLORS[w.category] || '#6b7280') + '22', color: CATEGORY_COLORS[w.category] || '#6b7280' }}>
                      {w.category}
                    </span>
                    <span className="text-[9px] text-gray-600">{formatDate(w.updatedAt)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Center: canvas */}
        <div className="flex-1 relative overflow-hidden bg-gray-950" style={{ cursor: isConnecting ? 'crosshair' : 'default' }}>
          {!workflow ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-600 text-sm gap-2">
              {loading ? 'Loading...' : (
                <>
                  <p>Select or create a workflow</p>
                  <button onClick={createWorkflow}
                    className="text-xs px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors">
                    + New Workflow
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              <svg
                ref={svgRef}
                className="w-full h-full"
                onMouseDown={onSvgMouseDown}
                onMouseMove={onSvgMouseMove}
                onMouseUp={onSvgMouseUp}
                onMouseLeave={onSvgMouseUp}
                onWheel={onSvgWheel}
                onClick={onSvgClick}
                onDoubleClick={onSvgDblClick}
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
                  <marker id="arrow-connect" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#10b981" />
                  </marker>
                </defs>

                <rect width="100%" height="100%" fill="url(#grid)" data-bg="true" />

                <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
                  {/* Edges */}
                  {workflow.edges.map(edge => {
                    const from = nodeMap[edge.from];
                    const to = nodeMap[edge.to];
                    if (!from || !to) return null;
                    return (
                      <EdgeShape key={edge.id} edge={edge} fromNode={from} toNode={to}
                        selected={edge.id === selectedEdgeId}
                        onClick={e => { e.stopPropagation(); setSelectedEdgeId(edge.id); setSelectedNodeId(null); }} />
                    );
                  })}

                  {/* Rubber-band wire while connecting */}
                  {connectDrag && (
                    <path
                      d={bezierPath(connectDrag.fromX, connectDrag.fromY, connectDrag.curX, connectDrag.curY)}
                      fill="none" stroke="#10b981" strokeWidth={1.5 / zoom}
                      strokeDasharray={`${5 / zoom},${3 / zoom}`}
                      markerEnd="url(#arrow-connect)"
                      style={{ pointerEvents: 'none' }} />
                  )}

                  {/* Nodes */}
                  {workflow.nodes.map(node => (
                    <NodeShape
                      key={node.id}
                      node={node}
                      selected={node.id === selectedNodeId}
                      hovered={node.id === hoveredNodeId && !isConnecting}
                      isDropTarget={isConnecting && node.id === hoveredNodeId && node.id !== connectDrag?.fromId}
                      onMouseDown={e => onNodeMouseDown(e, node.id)}
                      onMouseEnter={() => { if (!isConnecting) setHoveredNodeId(node.id); }}
                      onMouseLeave={() => { if (!isConnecting) setHoveredNodeId(null); }}
                      onPortMouseDown={e => onPortMouseDown(e, node.id)}
                      onContextMenu={e => onNodeRightClick(e, node.id)}
                    />
                  ))}
                </g>
              </svg>

              {/* Floating toolbar above selected node */}
              {selectedNodeId && nodeMap[selectedNodeId] && (() => {
                const n = nodeMap[selectedNodeId];
                const w = n.type === 'decision' ? DIAMOND_SIZE : n.type === 'start' || n.type === 'end' ? ELLIPSE_RX * 2 : NODE_W;
                const sx = pan.x + (n.x + w / 2) * zoom;
                const sy = pan.y + n.y * zoom - 36;
                return (
                  <div style={{ position: 'absolute', left: sx, top: sy, transform: 'translateX(-50%)', pointerEvents: 'auto' }}
                    className="flex items-center gap-0.5 bg-gray-900/95 border border-gray-700 rounded-lg px-1 py-0.5 shadow-xl backdrop-blur">
                    <button
                      title="Connect from this node"
                      onClick={() => startConnectFromNode(selectedNodeId)}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                      🔗 Connect
                    </button>
                    <div className="w-px h-4 bg-gray-700" />
                    <button
                      title="Duplicate node"
                      onClick={() => duplicateNode(selectedNodeId)}
                      className="px-2 py-1 rounded text-[10px] text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
                      📋
                    </button>
                    <div className="w-px h-4 bg-gray-700" />
                    <button
                      title="Delete node (Del)"
                      onClick={deleteSelected}
                      className="px-2 py-1 rounded text-[10px] text-red-400 hover:bg-red-500/10 transition-colors">
                      🗑
                    </button>
                  </div>
                );
              })()}

              {/* Right-click context menu */}
              {contextMenu && (
                <NodeContextMenu
                  sx={contextMenu.sx}
                  sy={contextMenu.sy}
                  onDelete={() => { setContextMenu(null); deleteSelected(); }}
                  onDuplicate={() => duplicateNode(contextMenu.nodeId)}
                  onConnect={() => startConnectFromNode(contextMenu.nodeId)}
                  onAddAfter={type => addNodeAfter(contextMenu.nodeId, type)}
                  onClose={() => setContextMenu(null)}
                />
              )}

              {/* Double-click quick-add menu */}
              {quickAdd && (
                <QuickAddMenu
                  screenX={quickAdd.sx}
                  screenY={quickAdd.sy}
                  onAdd={type => {
                    addNode(type, quickAdd.wx - (type === 'decision' ? DIAMOND_SIZE / 2 : type === 'start' || type === 'end' ? ELLIPSE_RX : NODE_W / 2),
                      quickAdd.wy - (type === 'decision' ? DIAMOND_SIZE / 2 : type === 'start' || type === 'end' ? ELLIPSE_RY : NODE_H / 2));
                  }}
                  onClose={() => setQuickAdd(null)}
                />
              )}

              {/* Canvas hint */}
              {!isConnecting && workflow.nodes.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-gray-700 text-sm">Double-click canvas to add nodes</p>
                  <p className="text-gray-700 text-xs mt-1">or use "+ Add Node" in toolbar</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: detail panel */}
        <aside className="w-[340px] flex-shrink-0 border-l border-gray-800 bg-gray-900/50 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-800 flex-shrink-0">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              {selectedNode ? `Node: ${selectedNode.title}` : selectedEdge ? 'Edge' : 'Workflow'}
            </span>
            {(selectedNode || selectedEdge) && (
              <button onClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }}
                className="ml-auto text-[10px] text-gray-600 hover:text-gray-400">✕ deselect</button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {selectedNode ? (
              <NodePanel node={selectedNode} workflowId={activeId!} onChange={updateNode} onDelete={deleteSelected} />
            ) : selectedEdge ? (
              <EdgePanel edge={selectedEdge} nodeMap={nodeMap}
                onChange={updated => setWorkflow(prev => prev ? { ...prev, edges: prev.edges.map(e => e.id === updated.id ? updated : e) } : prev)}
                onDelete={() => { setWorkflow(prev => prev ? { ...prev, edges: prev.edges.filter(e => e.id !== selectedEdgeId) } : prev); setSelectedEdgeId(null); }}
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

// ─── Add Node Menu (toolbar) ──────────────────────────────────────────────────

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

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="text-xs px-2.5 py-1 rounded border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition-colors">
        + Node ▾
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[140px]">
          {NODE_PALETTE.map(([type, label, color]) => (
            <button key={type}
              onClick={() => { onAdd(type); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800 hover:text-white transition-colors">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
              {label}
            </button>
          ))}
          <div className="border-t border-gray-800 mt-1 pt-1 px-3 pb-1">
            <p className="text-[9px] text-gray-600">or double-click canvas</p>
          </div>
        </div>
      )}
    </div>
  );
}

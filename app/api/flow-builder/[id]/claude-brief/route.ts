import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'flows');

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, `${params.id}.json`), 'utf8');
    const w = JSON.parse(raw);

    const lines: string[] = [];
    lines.push(`# Workflow: ${w.name}`);
    lines.push('');
    if (w.description) {
      lines.push(w.description);
      lines.push('');
    }
    lines.push(`Category: ${w.category}`);
    lines.push(`Last updated: ${w.updatedAt}`);
    lines.push('');

    lines.push('## Steps');
    lines.push('');
    for (const node of (w.nodes || [])) {
      lines.push(`### ${node.title} (${node.type}${node.processType ? ', ' + node.processType : ''})`);
      if (node.description) lines.push(node.description);
      if (node.tool) lines.push(`Tool: ${node.tool}`);
      if (node.inputRequired) lines.push(`Input: ${node.inputRequired}`);
      if (node.outputDescription) lines.push(`Output: ${node.outputDescription}`);
      if (node.assignedTo) lines.push(`Assigned to: ${node.assignedTo}`);
      if (node.estimatedTime) lines.push(`Time: ${node.estimatedTime}`);
      if (node.prompt) {
        lines.push('');
        lines.push('**Prompt:**');
        lines.push('```');
        lines.push(node.prompt);
        lines.push('```');
      }
      if (node.promptNotes) {
        lines.push('');
        lines.push('*Prompt Notes:*');
        lines.push(node.promptNotes);
      }
      if (node.notes) {
        lines.push('');
        lines.push(`Notes: ${node.notes}`);
      }
      lines.push('');
    }

    lines.push('## Flow');
    lines.push('');
    const nodeMap = Object.fromEntries((w.nodes || []).map((n: any) => [n.id, n.title]));
    for (const edge of (w.edges || [])) {
      const from = nodeMap[edge.from] || edge.from;
      const to = nodeMap[edge.to] || edge.to;
      const label = edge.label ? `: ${edge.label}` : '';
      const condition = edge.condition && edge.condition !== 'always' ? ` (${edge.condition})` : '';
      lines.push(`- ${from} → ${to}${label}${condition}`);
    }

    const text = lines.join('\n');
    return new NextResponse(text, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'kanban');

export async function GET(req: NextRequest) {
  try {
    // Optional ?brand=X filters to one project; default = ALL projects (each card
    // tagged with its Brand) so the auto-fix loop knows which brand a task belongs to.
    const only = req.nextUrl.searchParams.get('brand') || '';
    const entries = await fs.readdir(DATA_DIR, { withFileTypes: true }).catch(() => []);
    const cards: any[] = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      try {
        const c = JSON.parse(await fs.readFile(path.join(DATA_DIR, e.name, 'card.json'), 'utf8'));
        c.brandId = c.brandId || 'loveintea';
        if (c.status !== 'approved' && (!only || c.brandId === only)) cards.push(c);
      } catch {}
    }
    if (cards.length === 0) return new NextResponse('# No pending tasks\nAll clear!\n', { headers: { 'Content-Type': 'text/plain' } });

    const order = ['critical','high','medium','low'];
    cards.sort((a, b) => (a.brandId || '').localeCompare(b.brandId || '') || order.indexOf(a.priority) - order.indexOf(b.priority));
    const emoji: Record<string,string> = { critical:'🔴', high:'🟠', medium:'🟡', low:'🟢' };

    let out = `# Kanban Brief (${new Date().toLocaleDateString('vi-VN')})\n${cards.length} tasks\n\n`;
    for (const c of cards) {
      out += `## ${emoji[c.priority]||'⚪'} [${c.type.toUpperCase()}] ${c.title} (${c.status})\n`;
      out += `Brand/Project: \`${c.brandId}\`\n`;
      if (c.fileHint) out += `File: \`${c.fileHint}\`\n`;
      if (c.errorLog) out += `\nLog:\n${c.errorLog}\n`;
      if (c.description) out += `\nMô tả:\n${c.description}\n`;
      if (c.goal) out += `\nMục tiêu:\n${c.goal}\n`;
      out += '\n';
    }
    return new NextResponse(out, { headers: { 'Content-Type': 'text/plain' } });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

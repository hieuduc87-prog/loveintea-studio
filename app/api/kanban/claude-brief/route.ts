import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getBrandId, isAllBrands } from '@/lib/brand-guard';

const DATA_DIR = path.join(process.cwd(), 'data', 'kanban');

export async function GET(req: NextRequest) {
  try {
    // SEC (vbsec C2): TRƯỚC đây đọc ?brand từ query (client-controlled), mặc định DUMP
    // MỌI brand → editor brand X gọi không tham số thấy card + error log brand khác.
    // Vá: brand TIN CẬY từ middleware; chỉ admin (__all__) mới xem gộp — như /api/kanban.
    const brand = getBrandId(req);
    const aggregate = isAllBrands(req) && (brand === '__all__' || !brand);
    const entries = await fs.readdir(DATA_DIR, { withFileTypes: true }).catch(() => []);
    const cards: any[] = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      try {
        const c = JSON.parse(await fs.readFile(path.join(DATA_DIR, e.name, 'card.json'), 'utf8'));
        c.brandId = c.brandId || '';
        if (c.status !== 'approved' && (aggregate || c.brandId === brand)) cards.push(c);
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
  } catch (e: any) { console.error('[api] kanban/claude-brief', e); return NextResponse.json({ error: 'Có lỗi hệ thống' }, { status: 500 }); }
}

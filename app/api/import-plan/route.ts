export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { v4 as uuid } from 'uuid';
import { getDb } from '@/lib/db';

// ── SKU name → sku_id ──────────────────────────────────────────────
function mapSku(raw: string): string {
  const s = (raw ?? '').toLowerCase();
  if (s.includes('nighty night') || s.includes('nighty-night')) return 'nighty-night';
  if (s.includes('lemon balm') || s.includes('lemon-balm'))     return 'lemon-balm';
  if (s.includes('peppermint'))  return 'peppermint';
  if (s.includes('hibiscus'))    return 'hibiscus';
  if (s.includes('dandelion'))   return 'dandelion';
  if (s.includes('ginger'))      return 'ginger';
  return 'hibiscus';
}

// ── Surface → platforms ────────────────────────────────────────────
function mapPlatform(surface: string): string {
  const s = (surface ?? '').toLowerCase();
  if (s.includes('reel')) return 'instagram';
  return 'facebook,instagram';
}

// ── "Jun 8" → ISO date string ──────────────────────────────────────
function parseDate(raw: string | number): string | null {
  if (!raw) return null;
  if (typeof raw === 'number') {
    const d = XLSX.SSF.parse_date_code(raw);
    if (!d) return null;
    return new Date(d.y, d.m - 1, d.d, 9, 0, 0).toISOString();
  }
  const str = String(raw).trim();
  const match = str.match(/^([A-Za-z]+)\s+(\d+)$/);
  if (!match) return null;
  const months: Record<string, number> = {
    jan:0, feb:1, mar:2, apr:3, may:4, jun:5,
    jul:6, aug:7, sep:8, oct:9, nov:10, dec:11,
  };
  const month = months[match[1].toLowerCase()];
  if (month === undefined) return null;
  const day = parseInt(match[2]);
  return new Date(2026, month, day, 9, 0, 0).toISOString();
}

function cell(row: unknown[], col: number): string {
  const v = (row as (string | number | undefined)[])[col];
  return v !== undefined && v !== null ? String(v).trim() : '';
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });

    // ── Sheet 1: Content Plan ──────────────────────────────────────
    const ws1 = wb.Sheets[wb.SheetNames[0]];
    const rows1: unknown[][] = XLSX.utils.sheet_to_json(ws1, { header: 1, defval: '' });

    let headerIdx = -1;
    for (let i = 0; i < rows1.length; i++) {
      if (String((rows1[i] as unknown[])[0]).trim().toLowerCase() === 'date') {
        headerIdx = i; break;
      }
    }
    if (headerIdx < 0) return NextResponse.json({ error: 'Cannot find header row in Sheet 1' }, { status: 400 });

    const dataRows = rows1.slice(headerIdx + 1).filter(r => cell(r as unknown[], 0));

    // ── Sheet 2: Stories & Highlights ────────────────────────────
    const storiesData: { daily: { day: string; theme: string; signal: string }[]; highlights: { name: string; holds: string; cover: string }[] } = {
      daily: [], highlights: [],
    };

    if (wb.SheetNames[1]) {
      const ws2 = wb.Sheets[wb.SheetNames[1]];
      const rows2: unknown[][] = XLSX.utils.sheet_to_json(ws2, { header: 1, defval: '' });
      let mode: 'daily' | 'highlights' | null = null;
      for (const row of rows2) {
        const r = row as string[];
        const c0 = String(r[0] ?? '').trim();
        const c1 = String(r[1] ?? '').trim();
        const c2 = String(r[2] ?? '').trim();
        if (c0.toLowerCase().includes('daily stories')) { mode = 'daily'; continue; }
        if (c0.toLowerCase().includes('highlight')) { mode = 'highlights'; continue; }
        if (!c0 || c0.toLowerCase() === 'day' || c0.toLowerCase() === 'highlight') continue;
        if (mode === 'daily' && c0 && c1) storiesData.daily.push({ day: c0, theme: c1, signal: c2 });
        else if (mode === 'highlights' && c0 && c1) storiesData.highlights.push({ name: c0, holds: c1, cover: c2 });
      }
    }

    // ── Sheet 3: Summary ──────────────────────────────────────────
    const summaryRows: string[][] = [];
    if (wb.SheetNames[2]) {
      const ws3 = wb.Sheets[wb.SheetNames[2]];
      const rows3: unknown[][] = XLSX.utils.sheet_to_json(ws3, { header: 1, defval: '' });
      for (const row of rows3.slice(1)) {
        const r = row as string[];
        if (r[0] || r[1] || r[2]) summaryRows.push([String(r[0]||''), String(r[1]||''), String(r[2]||''), String(r[3]||'')]);
      }
    }

    // ── Create content plan record ───────────────────────────────
    const db = getDb();
    const planId = uuid();
    const planTitle = file.name.replace(/\.xlsx?$/i, '').replace(/_/g, ' ');

    // Detect date range from rows
    const dates = dataRows.map(r => parseDate(cell(r as unknown[], 0))).filter(Boolean) as string[];
    const minDate = dates.length ? dates.sort()[0] : null;
    const maxDate = dates.length ? dates.sort()[dates.length - 1] : null;

    db.prepare(`
      INSERT INTO content_plans (id, brand_id, title, stories_json, summary_json, source_file, cadence, created_at)
      VALUES (?, 'loveintea', ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      planId,
      planTitle,
      JSON.stringify(storiesData),
      JSON.stringify({ rows: summaryRows, dateRange: { from: minDate, to: maxDate } }),
      file.name,
      `${dataRows.length} posts`,
    );

    // ── Insert plan items + posts ────────────────────────────────
    const insertItem = db.prepare(`
      INSERT INTO plan_items (id, plan_id, brand_id, date, day_of_week, wave, surface, purpose, pillar, audience_code, rtb_code, usp_code, product_id, context, hook, copy_direction, visual_direction, hashtags, repurpose, tree_id, win_band, sort_order)
      VALUES (?, ?, 'loveintea', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertPost = db.prepare(`
      INSERT INTO posts (id, plan_id, sku_id, segment_id, rtb_id, usp_id, context_id, cta, cell_id,
        caption, hashtags, image_prompt, platforms, scheduled_at, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
    `);

    const createdPosts: { id: string; date: string; sku: string; hook: string; surface: string }[] = [];
    const createdItems: { id: string; date: string; sku: string; hook: string; surface: string; wave: string; purpose: string; pillar: string; segment: string; rtb: string; usp: string; context: string; copyDir: string; visualDir: string }[] = [];

    for (let idx = 0; idx < dataRows.length; idx++) {
      const r = dataRows[idx] as unknown[];
      const dateRaw  = cell(r, 0);
      const dayOfWeek = cell(r, 1);
      const wave     = cell(r, 2);
      const surface  = cell(r, 3);
      const purpose  = cell(r, 4);
      const pillar   = cell(r, 5);
      const segment  = cell(r, 6);
      const rtb      = cell(r, 7);
      const usp      = cell(r, 8);
      const skuRaw   = cell(r, 9);
      const context  = cell(r, 10);
      const hook     = cell(r, 11);
      const copyDir  = cell(r, 12);
      const visualDir = cell(r, 13);
      const hashtags = cell(r, 14);
      const repurpose = cell(r, 15);
      const treeId   = cell(r, 16);
      const winBand  = cell(r, 17);

      if (!hook && !skuRaw) continue;

      const skuId    = mapSku(skuRaw);
      const platform = mapPlatform(surface);
      const scheduledAt = parseDate(dateRaw);

      // Plan item (raw plan data)
      const itemId = uuid();
      insertItem.run(
        itemId, planId, scheduledAt ?? dateRaw, dayOfWeek, wave, surface, purpose, pillar,
        segment, rtb, usp, skuId, context, hook, copyDir, visualDir, hashtags, repurpose, treeId, winBand, idx,
      );

      // Post (linked to plan)
      const caption = [hook, copyDir].filter(Boolean).join('\n\n');
      const notes = JSON.stringify({
        wave, surface, purpose, pillar, segment, rtb, usp,
        skuRaw, context, visualDir, repurpose, treeId, winBand,
      });

      const postId = uuid();
      insertPost.run(
        postId, planId, skuId, segment, rtb, usp, context, '', treeId,
        caption, hashtags, visualDir, platform, scheduledAt, notes,
      );

      createdPosts.push({ id: postId, date: dateRaw, sku: skuId, hook, surface });
      createdItems.push({ id: itemId, date: dateRaw, sku: skuId, hook, surface, wave, purpose, pillar, segment, rtb, usp, context, copyDir, visualDir });
    }

    // Save stories rotation to settings
    if (storiesData.daily.length > 0) {
      db.prepare(`
        INSERT INTO settings (key, value, updated_at) VALUES ('stories_rotation', ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
      `).run(JSON.stringify(storiesData));
    }

    return NextResponse.json({
      ok: true,
      planId,
      planTitle,
      created: createdPosts.length,
      posts: createdPosts,
      items: createdItems,
      stories: storiesData,
      summary: summaryRows,
    });

  } catch (e) {
    console.error('[import-plan]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

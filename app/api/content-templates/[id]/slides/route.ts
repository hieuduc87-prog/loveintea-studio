export const dynamic = 'force-dynamic';
export const maxDuration = 120;
/**
 * Manage ordered images of a template (collection).
 * POST  multipart files[] → append ordered slides (saves files, updates cover/kind)
 * PUT   { slides: [{url, order}] } → replace order (reorder/delete)
 */
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';
import { assertResourceBrand } from '@/lib/brand-guard';

const IMAGES_DIR = path.join(process.env.DATA_DIR || path.join(process.cwd(), 'data'), 'images');

/** 403 unless the caller is a member of the template's brand. */
function guardTemplate(req: NextRequest, id: string): NextResponse | null {
  const row = getDb().prepare('SELECT brand_id FROM content_templates WHERE id=?').get(id) as { brand_id: string } | undefined;
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return assertResourceBrand(req, row.brand_id);
}

interface Slide { url: string; order: number }

function readSlides(json: string | null): Slide[] {
  try { const a = JSON.parse(json || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
}

async function thumbOf(filePath: string, id: string): Promise<string> {
  try {
    const sharp = (await import('sharp')).default;
    const name = `tpl-${id}-thumb.webp`;
    await sharp(filePath).resize(400, undefined, { fit: 'inside' }).webp({ quality: 80 }).toFile(path.join(IMAGES_DIR, name));
    return `/api/images/${name}`;
  } catch { return ''; }
}

function persist(db: ReturnType<typeof getDb>, id: string, slides: Slide[], thumbnail?: string) {
  const ordered = slides.slice().sort((a, b) => a.order - b.order).map((s, i) => ({ url: s.url, order: i }));
  const cover = ordered[0]?.url ?? '';
  const kind = ordered.length > 1 ? 'collection' : 'single';
  db.prepare(`UPDATE content_templates SET slides_json=?, image_url=?, kind=?, thumbnail_url=COALESCE(NULLIF(?, ''), thumbnail_url, ?) WHERE id=?`)
    .run(JSON.stringify(ordered), cover, kind, thumbnail ?? '', cover, id);
  return { slides: ordered, cover, kind };
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const denied = guardTemplate(req, params.id);
    if (denied) return denied;
    const db = getDb();
    const tpl = db.prepare('SELECT slides_json, thumbnail_url FROM content_templates WHERE id=?').get(params.id) as { slides_json: string; thumbnail_url: string } | undefined;
    if (!tpl) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Add EXISTING images by URL (drag from library) — no upload
    if ((req.headers.get('content-type') || '').includes('application/json')) {
      const { addUrls } = await req.json() as { addUrls?: string[] };
      if (!addUrls?.length) return NextResponse.json({ error: 'addUrls required' }, { status: 400 });
      const slides = readSlides(tpl.slides_json);
      let order = slides.length;
      const existing = new Set(slides.map(s => s.url));
      for (const url of addUrls) {
        if (typeof url === 'string' && url.trim() && !existing.has(url)) { slides.push({ url, order: order++ }); existing.add(url); }
      }
      const r = persist(db, params.id, slides);
      return NextResponse.json({ ok: true, ...r });
    }

    const fd = await req.formData();
    const files = (fd.getAll('files') as File[]).filter(Boolean);
    if (!files.length) return NextResponse.json({ error: 'No files' }, { status: 400 });
    fs.mkdirSync(IMAGES_DIR, { recursive: true });

    // Video template → save the video as the template media
    const vid = files.find(f => f.type.startsWith('video/'));
    if (vid) {
      const ext = (vid.name.split('.').pop() || 'mp4').toLowerCase();
      const name = `tpl-${params.id.slice(0, 8)}-${uuid().slice(0, 8)}.${ext}`;
      fs.writeFileSync(path.join(IMAGES_DIR, name), Buffer.from(await vid.arrayBuffer()));
      const url = `/api/images/${name}`;
      db.prepare(`UPDATE content_templates SET image_url=?, thumbnail_url=?, file_type='video', kind='single', slides_json='[]' WHERE id=?`)
        .run(url, url, params.id);
      return NextResponse.json({ ok: true, slides: [], cover: url, kind: 'single', file_type: 'video', video_url: url });
    }

    const slides = readSlides(tpl.slides_json);
    let order = slides.length;
    let newThumb = tpl.thumbnail_url || '';
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      const ext = (f.name.split('.').pop() || 'png').toLowerCase();
      const sid = uuid();
      const name = `tpl-${params.id.slice(0, 8)}-${sid.slice(0, 8)}.${ext}`;
      const filePath = path.join(IMAGES_DIR, name);
      fs.writeFileSync(filePath, Buffer.from(await f.arrayBuffer()));
      const url = `/api/images/${name}`;
      slides.push({ url, order });
      if (order === 0) newThumb = await thumbOf(filePath, params.id);  // cover thumb from first
      order++;
    }
    const r = persist(db, params.id, slides, slides.length && !tpl.slides_json ? newThumb : (tpl.thumbnail_url ? '' : newThumb));
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const denied = guardTemplate(req, params.id);
    if (denied) return denied;
    const db = getDb();
    const { slides } = await req.json() as { slides?: Slide[] };
    if (!Array.isArray(slides)) return NextResponse.json({ error: 'slides[] required' }, { status: 400 });
    const r = persist(db, params.id, slides.map((s, i) => ({ url: s.url, order: i })));
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { canAccessBrand } from '@/lib/brand-guard';

const DATA_DIR = path.join(process.cwd(), 'data', 'flows');
const IMAGES_DIR = path.join(process.cwd(), 'data', 'flow-images');
// Card id is a filename component — reject traversal.
const SAFE_ID = /^[\w-]+$/;

function filePath(id: string) {
  return path.join(DATA_DIR, `${id}.json`);
}

/** Load a flow and 403 if the caller isn't a member of its brand. Returns the
 *  parsed flow, or a NextResponse (404/403) to return immediately. */
async function loadOwnedFlow(req: NextRequest, id: string): Promise<any | NextResponse> {
  if (!SAFE_ID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  let flow: any;
  try { flow = JSON.parse(await fs.readFile(filePath(id), 'utf8')); }
  catch { return NextResponse.json({ error: 'Not found' }, { status: 404 }); }
  if (!canAccessBrand(req, flow.brandId || 'loveintea')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return flow;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const flow = await loadOwnedFlow(req, params.id);
  if (flow instanceof NextResponse) return flow;
  return NextResponse.json(flow);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const loaded = await loadOwnedFlow(req, params.id);
    if (loaded instanceof NextResponse) return loaded;
    const existing = loaded;
    const body = await req.json();
    const updated = {
      ...existing,
      ...body,
      id: existing.id,                                  // never overwrite id
      brandId: existing.brandId || 'loveintea',          // never re-tenant via body
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(filePath(params.id), JSON.stringify(updated, null, 2));
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const loaded = await loadOwnedFlow(req, params.id);
  if (loaded instanceof NextResponse) return loaded;
  try {
    // Remove JSON file
    await fs.unlink(filePath(params.id));

    // Remove associated images
    try {
      const entries = await fs.readdir(IMAGES_DIR);
      for (const file of entries) {
        if (file.startsWith(`${params.id}-`)) {
          await fs.unlink(path.join(IMAGES_DIR, file)).catch(() => {});
        }
      }
    } catch {}

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}

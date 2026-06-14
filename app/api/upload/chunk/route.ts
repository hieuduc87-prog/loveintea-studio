export const dynamic = 'force-dynamic';
export const maxDuration = 60;
/**
 * Chunked upload — works around the Cloudflare 100MB request-body limit so the
 * UI can upload files up to ~200MB. Client splits into ~4MB chunks.
 *
 * formData per request:
 *   uploadId  (stable per file)   index  total   name (original filename)
 *   chunk     (Blob slice)        purpose  + purpose-specific fields
 *
 * On the final chunk we assemble and dispatch by `purpose`:
 *   product_media  → ingestProductMedia(productId)
 *   bgm_video      → extract audio track as BGM
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { TMP_DIR, IMAGES_DIR } from '@/lib/video/ffmpeg';
import { ingestProductMedia, extractAudioFromVideo } from '@/lib/video/ingest';

const CHUNK_DIR = path.join(TMP_DIR, 'chunks');
const MAX_TOTAL = 210 * 1024 * 1024; // 210MB hard cap

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData();
    const uploadId = String(fd.get('uploadId') || '').replace(/[^\w-]/g, '');
    const index = Number(fd.get('index'));
    const total = Number(fd.get('total'));
    const name = String(fd.get('name') || 'upload.bin');
    const purpose = String(fd.get('purpose') || '');
    const chunk = fd.get('chunk') as File | null;
    if (!uploadId || !chunk || Number.isNaN(index) || Number.isNaN(total)) {
      return NextResponse.json({ error: 'uploadId, index, total, chunk required' }, { status: 400 });
    }

    fs.mkdirSync(CHUNK_DIR, { recursive: true });
    const part = path.join(CHUNK_DIR, `${uploadId}.part`);

    // Guard: reject if growing past the cap
    const existing = fs.existsSync(part) ? fs.statSync(part).size : 0;
    const buf = Buffer.from(await chunk.arrayBuffer());
    if (existing + buf.length > MAX_TOTAL) {
      try { fs.unlinkSync(part); } catch { /* */ }
      return NextResponse.json({ error: 'File exceeds 210MB limit' }, { status: 413 });
    }
    fs.appendFileSync(part, buf);

    if (index < total - 1) {
      return NextResponse.json({ ok: true, received: index + 1, total });
    }

    // ── Final chunk: assemble + dispatch ──
    const ext = path.extname(name).toLowerCase() || '.bin';
    const assembled = path.join(CHUNK_DIR, `${uploadId}${ext}`);
    fs.renameSync(part, assembled);

    try {
      if (purpose === 'product_media') {
        const productId = String(fd.get('productId') || '');
        if (!productId) throw new Error('productId required');
        const result = await ingestProductMedia(productId, assembled, name, chunk.type);
        return NextResponse.json({ ok: true, ...result });
      }

      if (purpose === 'bgm_video') {
        // Stash the video in IMAGES_DIR briefly, extract audio, drop the video.
        const tmpVid = `bgmsrc_${uploadId}${ext}`;
        fs.renameSync(assembled, path.join(IMAGES_DIR, tmpVid));
        try {
          const { url } = await extractAudioFromVideo(tmpVid);
          return NextResponse.json({ ok: true, kind: 'bgm', url });
        } finally {
          try { fs.unlinkSync(path.join(IMAGES_DIR, tmpVid)); } catch { /* */ }
        }
      }

      throw new Error(`Unknown purpose: ${purpose}`);
    } catch (e) {
      try { fs.unlinkSync(assembled); } catch { /* */ }
      return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
    }
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

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

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.mov', '.m4v', '.webm', '.avi']);

/** Sniff the leading bytes of the assembled file to confirm it really is an
 *  image/video — don't trust the client-supplied extension/MIME. Returns
 *  'image' | 'video' | null. */
function sniffMedia(fp: string): 'image' | 'video' | null {
  let fd: number | undefined;
  try {
    fd = fs.openSync(fp, 'r');
    const b = Buffer.alloc(16);
    fs.readSync(fd, b, 0, 16, 0);
    // Images
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image';            // JPEG
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image'; // PNG
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image';            // GIF
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
        b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image'; // WEBP (RIFF..WEBP)
    // Videos
    if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'video'; // MP4/MOV (ftyp)
    if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video'; // WEBM/MKV (EBML)
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
        b[8] === 0x41 && b[9] === 0x56 && b[10] === 0x49) return 'video';           // AVI (RIFF..AVI)
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch { /* */ }
  }
}

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
    if (!ALLOWED_EXT.has(ext)) {
      try { fs.unlinkSync(part); } catch { /* */ }
      return NextResponse.json({ error: 'Chỉ nhận file ảnh/video' }, { status: 415 });
    }
    const assembled = path.join(CHUNK_DIR, `${uploadId}${ext}`);
    fs.renameSync(part, assembled);

    // Verify real media by magic bytes — don't trust the extension/MIME.
    if (!sniffMedia(assembled)) {
      try { fs.unlinkSync(assembled); } catch { /* */ }
      return NextResponse.json({ error: 'File không phải ảnh/video hợp lệ' }, { status: 415 });
    }

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

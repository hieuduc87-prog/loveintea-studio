/**
 * Media ingest helpers shared by chunked upload finalizers.
 *  - product media (image → product_images, video → video_clips per product)
 *  - extract audio track from a video to use as BGM
 */
import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db';
import { ffmpeg, probe, IMAGES_DIR } from './ffmpeg';

const IMG_EXT = /\.(png|jpe?g|webp|gif|avif)$/i;
const VID_EXT = /\.(mp4|mov|webm|m4v|avi|mkv)$/i;

export function mediaKind(name: string, mime?: string): 'image' | 'video' | 'audio' | 'other' {
  if (mime?.startsWith('image/') || IMG_EXT.test(name)) return 'image';
  if (mime?.startsWith('video/') || VID_EXT.test(name)) return 'video';
  if (mime?.startsWith('audio/') || /\.(mp3|m4a|wav|aac|ogg)$/i.test(name)) return 'audio';
  return 'other';
}

/** Async clip tagging — never blocks the upload response. */
async function tagClip(id: string, file: string, mime: string) {
  try {
    const { analyzeClip } = await import('./analyze');
    const a = await analyzeClip(file, mime, id);
    const db = getDb();
    if (a) {
      db.prepare(`UPDATE video_clips SET tags_json=?, analysis_json=?, status='ready' WHERE id=?`)
        .run(JSON.stringify(a), JSON.stringify(a.scenes ?? []), id);
    } else {
      db.prepare(`UPDATE video_clips SET status='ready' WHERE id=?`).run(id);
    }
  } catch (e) {
    console.warn('[ingest] tag failed:', String(e).slice(0, 150));
    try { getDb().prepare(`UPDATE video_clips SET status='ready' WHERE id=?`).run(id); } catch { /* */ }
  }
}

export interface IngestResult { kind: string; id?: string; url: string; status?: string }

/** Move an assembled upload into the product's media library. */
export async function ingestProductMedia(
  productId: string, assembledPath: string, originalName: string, mime?: string
): Promise<IngestResult> {
  const db = getDb();
  const product = db.prepare('SELECT brand_id FROM products WHERE id=?').get(productId) as { brand_id: string } | undefined;
  if (!product) throw new Error('Product not found');
  const brandId = product.brand_id;
  const kind = mediaKind(originalName, mime);
  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  if (kind === 'image') {
    const sub = path.join(IMAGES_DIR, 'products');
    fs.mkdirSync(sub, { recursive: true });
    const ext = path.extname(originalName).toLowerCase() || '.png';
    const id = uuid();
    const filename = `product-${productId.slice(0, 8)}-${id.slice(0, 8)}${ext}`;
    fs.renameSync(assembledPath, path.join(sub, filename));
    const url = `/api/images/products/${filename}`;
    const mx = (db.prepare('SELECT MAX(sort_order) mx FROM product_images WHERE product_id=?').get(productId) as { mx: number | null })?.mx ?? -1;
    db.prepare(`INSERT INTO product_images (id, brand_id, product_id, image_url, type, sort_order) VALUES (?,?,?,?,?,?)`)
      .run(id, brandId, productId, url, 'photo', mx + 1);
    return { kind: 'image', id, url };
  }

  if (kind === 'video') {
    const ext = path.extname(originalName).toLowerCase() || '.mp4';
    const id = uuid();
    const filename = `vidclip_${id}${ext}`;
    const dest = path.join(IMAGES_DIR, filename);
    fs.renameSync(assembledPath, dest);
    const url = `/api/images/${filename}`;
    let meta = { duration: 0, width: 0, height: 0 };
    try { meta = await probe(dest); } catch { /* keep zeros */ }
    db.prepare(`INSERT INTO video_clips (id, brand_id, product_id, url, filename, duration_s, width, height, source, status)
      VALUES (?,?,?,?,?,?,?,?, 'upload', 'tagging')`)
      .run(id, brandId, productId, url, filename, meta.duration, meta.width, meta.height);
    const m = ext === '.mov' ? 'video/quicktime' : ext === '.webm' ? 'video/webm' : 'video/mp4';
    void tagClip(id, dest, m); // fire-and-forget
    return { kind: 'video', id, url, status: 'tagging' };
  }

  throw new Error(`Unsupported file type: ${originalName}`);
}

/** Extract the audio track from a video into an mp3 BGM file. Returns its /api/images url. */
export async function extractAudioFromVideo(videoFilename: string): Promise<{ url: string }> {
  const src = path.join(IMAGES_DIR, videoFilename);
  if (!fs.existsSync(src)) throw new Error('source video not found');
  const has = await probe(src).then(() => true).catch(() => false);
  if (!has) throw new Error('cannot probe source');
  const out = `bgm_${uuid()}.mp3`;
  await ffmpeg(['-i', src, '-vn', '-ac', '2', '-ar', '44100', '-b:a', '192k', path.join(IMAGES_DIR, out)]);
  return { url: `/api/images/${out}` };
}

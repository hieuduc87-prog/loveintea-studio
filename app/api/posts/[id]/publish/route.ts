export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getDb } from '@/lib/db';
import { postToFacebook, postToInstagram, hasIgCreds, PostResult } from '@/lib/facebook';
import { assertResourceBrand } from '@/lib/brand-guard';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(params.id) as Record<string, string> | undefined;
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  const denied = assertResourceBrand(req, post.brand_id);
  if (denied) return denied;

  const caption   = post.caption ?? '';
  // Carousel: dùng images_json (nhiều ảnh) nếu có, fallback ảnh đơn.
  let imageUrls: string[] = post.image_url ? [post.image_url] : [];
  try { const arr = JSON.parse(post.images_json || '[]') as string[]; if (arr.length) imageUrls = arr; } catch { /* */ }
  const brandId   = post.brand_id || 'loveintea';
  // Column is `platforms`: 'facebook' | 'instagram' | 'facebook,instagram'
  const platforms = (post.platforms ?? 'facebook').split(',').map(p => p.trim());

  // Bài rỗng — không có gì để đăng.
  if (!caption.trim() && imageUrls.length === 0) {
    return NextResponse.json({ ok: false, error: 'Bài rỗng — cần caption hoặc ảnh trước khi đăng.' }, { status: 400 });
  }

  const logInsert = db.prepare(`
    INSERT INTO publish_log (id, post_id, platform, action, status, result_id, error)
    VALUES (?, ?, ?, 'publish_now', ?, ?, ?)
  `);
  const result: Record<string, PostResult> = {};
  const skipped: string[] = [];

  if (platforms.includes('facebook')) {
    const fb = await postToFacebook({ caption, imageUrls, brandId });
    result.fb = fb;
    logInsert.run(uuid(), params.id, 'facebook', fb.ok ? 'ok' : 'failed', fb.postId ?? null, fb.error ?? null);
    if (fb.ok) {
      db.prepare("UPDATE posts SET fb_post_id = ?, status = 'published', published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
        .run(fb.postId, params.id);
    }
  }

  // IG: skip gracefully nếu chưa kết nối (không tính là fail).
  if (platforms.includes('instagram')) {
    if (!hasIgCreds(brandId)) {
      skipped.push('instagram');
      logInsert.run(uuid(), params.id, 'instagram', 'skipped', null, 'IG chưa kết nối — bỏ qua.');
    } else {
      const ig = await postToInstagram({ caption, imageUrls, brandId });
      result.ig = ig;
      logInsert.run(uuid(), params.id, 'instagram', ig.ok ? 'ok' : 'failed', ig.postId ?? null, ig.error ?? null);
      if (ig.ok) {
        db.prepare("UPDATE posts SET ig_post_id = ?, status = 'published', published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
          .run(ig.postId, params.id);
      }
    }
  }

  const results = Object.values(result);
  const anyOk = results.some(r => r.ok);
  const allOk = results.length > 0 && results.every(r => r.ok);
  // Chỉ đánh failed khi có thử đăng mà KHÔNG kênh nào thành công.
  if (results.length > 0 && !anyOk) {
    db.prepare("UPDATE posts SET status = 'failed', updated_at = datetime('now') WHERE id = ?").run(params.id);
  }
  return NextResponse.json({ ok: allOk || (anyOk && skipped.length > 0), skipped, ...result });
}

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getDb } from '@/lib/db';
import { postToFacebook, postToInstagram, PostResult } from '@/lib/facebook';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(params.id) as Record<string, string> | undefined;
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  const caption   = post.caption ?? '';
  const imageUrls = post.image_url ? [post.image_url] : [];
  // Column is `platforms`: 'facebook' | 'instagram' | 'facebook,instagram'
  const platforms = (post.platforms ?? 'facebook').split(',').map(p => p.trim());

  const logInsert = db.prepare(`
    INSERT INTO publish_log (id, post_id, platform, action, status, result_id, error)
    VALUES (?, ?, ?, 'publish_now', ?, ?, ?)
  `);
  const result: Record<string, PostResult> = {};

  if (platforms.includes('facebook')) {
    const fb = await postToFacebook({ caption, imageUrls });
    result.fb = fb;
    logInsert.run(uuid(), params.id, 'facebook', fb.ok ? 'ok' : 'failed', fb.postId ?? null, fb.error ?? null);
    if (fb.ok) {
      db.prepare("UPDATE posts SET fb_post_id = ?, status = 'published', published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
        .run(fb.postId, params.id);
    }
  }

  if (platforms.includes('instagram')) {
    const ig = await postToInstagram({ caption, imageUrls });
    result.ig = ig;
    logInsert.run(uuid(), params.id, 'instagram', ig.ok ? 'ok' : 'failed', ig.postId ?? null, ig.error ?? null);
    if (ig.ok) {
      db.prepare("UPDATE posts SET ig_post_id = ?, status = 'published', published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
        .run(ig.postId, params.id);
    }
  }

  const results = Object.values(result);
  const allOk = results.length > 0 && results.every(r => r.ok);
  if (results.length > 0 && !results.some(r => r.ok)) {
    db.prepare("UPDATE posts SET status = 'failed', updated_at = datetime('now') WHERE id = ?").run(params.id);
  }
  return NextResponse.json({ ok: allOk, ...result });
}

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { postToFacebook, postToInstagram } from '@/lib/facebook';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(params.id) as Record<string, string> | undefined;
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  const caption   = post.caption ?? '';
  const imageUrls = post.image_url ? [post.image_url] : [];
  const platform  = post.platform ?? 'instagram';

  const result: Record<string, unknown> = {};

  if (platform === 'facebook' || platform === 'both') {
    const fb = await postToFacebook({ caption, imageUrls });
    result.fb = fb;
    if (fb.ok) {
      db.prepare("UPDATE posts SET fb_post_id = ?, status = 'published', published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
        .run(fb.postId, params.id);
    }
  }

  if (platform === 'instagram' || platform === 'both') {
    const ig = await postToInstagram({ caption, imageUrls });
    result.ig = ig;
    if (ig.ok) {
      db.prepare("UPDATE posts SET ig_post_id = ?, status = 'published', published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
        .run(ig.postId, params.id);
    }
  }

  const allOk = Object.values(result).every((r) => (r as { ok: boolean }).ok);
  return NextResponse.json({ ok: allOk, ...result });
}

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { reviewContent } from '@/lib/o3-engine';

// POST /api/review — run 3-gate review on a post
export async function POST(req: NextRequest) {
  try {
    const { postId, caption, brandId } = await req.json() as {
      postId?: string; caption?: string; brandId?: string;
    };

    let captionText = caption || '';
    const bid = brandId || 'loveintea';

    // If postId provided, fetch caption from DB
    if (postId && !captionText) {
      const db = getDb();
      const post = db.prepare('SELECT caption FROM posts WHERE id = ?').get(postId) as { caption: string } | undefined;
      if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      captionText = post.caption;
    }

    if (!captionText) {
      return NextResponse.json({ error: 'No caption to review' }, { status: 400 });
    }

    const result = reviewContent(captionText, bid);

    // Update post review status if postId provided
    if (postId) {
      try {
        const db = getDb();
        db.prepare(
          `UPDATE posts SET review_status = ?, review_notes = ?, updated_at = datetime('now') WHERE id = ?`
        ).run(
          result.passed ? 'passed' : 'failed',
          JSON.stringify(result.gates),
          postId
        );
      } catch { /* non-critical */ }
    }

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

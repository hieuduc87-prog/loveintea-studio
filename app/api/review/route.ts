export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { reviewContent } from '@/lib/o3-engine';
import { getBrandId, assertResourceBrand } from '@/lib/brand-guard';

// POST /api/review — run 3-gate review on a post
export async function POST(req: NextRequest) {
  try {
    const { postId, caption, brandId } = await req.json() as {
      postId?: string; caption?: string; brandId?: string;
    };

    let captionText = caption || '';
    const bid = getBrandId(req);

    // If postId provided, load it, verify ownership, and use its caption.
    if (postId) {
      const db = getDb();
      const post = db.prepare('SELECT caption, brand_id FROM posts WHERE id = ?').get(postId) as { caption: string; brand_id: string } | undefined;
      if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      const denied = assertResourceBrand(req, post.brand_id);
      if (denied) return denied;
      if (!captionText) captionText = post.caption;
    }

    if (!captionText) {
      return NextResponse.json({ error: 'No caption to review' }, { status: 400 });
    }

    const result = reviewContent(captionText, bid, postId);

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
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

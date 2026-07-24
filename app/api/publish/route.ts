export const dynamic = 'force-dynamic';
export const maxDuration = 120; // IG poll status container (carousel nhiều ảnh) có thể mất chục giây
import { NextRequest, NextResponse } from 'next/server';
import { postToFacebook, postToInstagram } from '@/lib/facebook';
import { getBrandId, assertResourceBrand } from '@/lib/brand-guard';

export async function POST(req: NextRequest) {
  try {
    const { caption, imageUrls, platforms, scheduledAt, postId } = await req.json() as {
      caption: string;
      imageUrls: string[];
      platforms: string[];
      scheduledAt?: string;
      postId?: string;
    };
    // Brand from the trusted header — never body.brandId (would let a tenant
    // publish to another store's / the built-in Loveintea Page).
    const brandId = getBrandId(req);
    const denied = assertResourceBrand(req, brandId);
    if (denied) return denied;

    const result: Record<string, unknown> = {};
    const schedDate = scheduledAt ? new Date(scheduledAt) : undefined;

    if (platforms?.includes('facebook')) {
      if (schedDate && postId) {
        // Post row exists — defer to the background scheduler so re-clicking
        // Schedule never creates duplicate FB-native scheduled posts.
        result.fb = { ok: true, deferred: true };
      } else {
        result.fb = await postToFacebook({ caption, imageUrls, scheduledAt: schedDate, brandId });
      }
    }
    if (platforms?.includes('instagram')) {
      if (schedDate && !postId) {
        // No post row → the background scheduler has nothing to pick up.
        result.ig = { ok: false, error: 'IG không hỗ trợ lên lịch trực tiếp — hãy tạo bài trong Review & Queue để hệ thống tự đăng đúng giờ' };
      } else if (schedDate) {
        // IG doesn't support scheduling via Graph API — the background
        // scheduler (lib/scheduler.ts) publishes it when scheduled_at is due.
        result.ig = { ok: true, deferred: true };
      } else {
        result.ig = await postToInstagram({ caption, imageUrls, brandId });
      }
    }

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

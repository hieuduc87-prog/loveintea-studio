export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';
import { getChannelCreds } from '@/lib/facebook';

const GRAPH = 'https://graph.facebook.com/v21.0';

interface FbPost {
  id: string;
  message?: string;
  created_time: string;
  full_picture?: string;
  fb_post_id?: string;
  caption?: string;
  sku_id?: string;
  published_at?: string;
}

interface PostInsight {
  post: FbPost;
  impressions: number;
  reach: number;
  engaged: number;
  reactions: number;
  comments: number;
  shares: number;
}

async function fetchPostInsights(postId: string, tok: string): Promise<Partial<PostInsight>> {
  try {
    const r = await fetch(
      `${GRAPH}/${postId}/insights?metric=post_impressions,post_reach,post_engaged_users,post_reactions_by_type_total&access_token=${tok}`
    );
    const d = await r.json() as { data?: { name: string; values: { value: number | Record<string, number> }[] }[] };
    const metrics: Record<string, number> = {};
    for (const m of d.data ?? []) {
      const v = m.values?.[0]?.value;
      if (typeof v === 'number') metrics[m.name] = v;
      else if (typeof v === 'object' && v !== null) {
        metrics[m.name] = Object.values(v as Record<string, number>).reduce((a, b) => a + b, 0);
      }
    }
    // Get comments + shares via post fields
    const r2 = await fetch(
      `${GRAPH}/${postId}?fields=comments.summary(true),shares,reactions.summary(true)&access_token=${tok}`
    );
    const d2 = await r2.json() as {
      comments?: { summary?: { total_count?: number } };
      shares?: { count?: number };
      reactions?: { summary?: { total_count?: number } };
    };
    return {
      impressions: metrics['post_impressions'] ?? 0,
      reach:       metrics['post_reach'] ?? 0,
      engaged:     metrics['post_engaged_users'] ?? 0,
      reactions:   d2.reactions?.summary?.total_count ?? 0,
      comments:    d2.comments?.summary?.total_count ?? 0,
      shares:      d2.shares?.count ?? 0,
    };
  } catch { return {}; }
}

export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30');
  const brand = getBrandId(req) || 'loveintea';
  const tok = getChannelCreds(brand).pageToken;
  if (!tok) return NextResponse.json({ posts: [], rolling: [], error: 'Store chưa kết nối Facebook' });

  const db = getDb();
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const posts = db.prepare(
    `SELECT * FROM posts WHERE brand_id=? AND status='published' AND fb_post_id IS NOT NULL AND fb_post_id != ''
     AND published_at >= ? ORDER BY published_at DESC LIMIT 50`
  ).all(brand, since) as FbPost[];

  // Fetch insights for each post (parallel, max 10 at a time)
  const results: PostInsight[] = [];
  for (let i = 0; i < posts.length; i += 10) {
    const batch = posts.slice(i, i + 10);
    const settled = await Promise.allSettled(
      batch.map(async p => {
        const insights = await fetchPostInsights(p.fb_post_id!, tok);
        return { post: p, ...insights } as PostInsight;
      })
    );
    for (const s of settled) {
      if (s.status === 'fulfilled') results.push(s.value);
    }
  }

  // Rolling window aggregates: 3, 7, 14, 30 days
  const windows = [3, 7, 14, 30].filter(d => d <= days);
  const rolling = windows.map(w => {
    const cutoff = new Date(Date.now() - w * 86400000).toISOString();
    const subset = results.filter(r => (r.post.published_at ?? '') >= cutoff);
    return {
      days: w,
      posts: subset.length,
      impressions: subset.reduce((a, r) => a + (r.impressions ?? 0), 0),
      reach:       subset.reduce((a, r) => a + (r.reach ?? 0), 0),
      engaged:     subset.reduce((a, r) => a + (r.engaged ?? 0), 0),
      reactions:   subset.reduce((a, r) => a + (r.reactions ?? 0), 0),
      comments:    subset.reduce((a, r) => a + (r.comments ?? 0), 0),
      shares:      subset.reduce((a, r) => a + (r.shares ?? 0), 0),
    };
  });

  return NextResponse.json({ posts: results, rolling });
}

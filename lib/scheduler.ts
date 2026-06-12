/**
 * Background scheduler — started once per server process via instrumentation.ts
 *
 * Closes the loop the UI can't:
 *  1. Every 60s  — publish due scheduled posts (IG has no native scheduling;
 *                  FB-native-scheduled posts are just marked published once due).
 *  2. Every 6h   — sync FB/IG metrics into post_metrics, then recompute the
 *                  scoreboard so Learn/Scoreboard run on real data.
 */
import { v4 as uuid } from 'uuid';
import { getDb } from './db';
import {
  postToFacebook, postToInstagram,
  getFbPostMetrics, getIgMediaMetrics, FetchedMetrics,
} from './facebook';
import { recomputeScoreboard } from './scoreboard-engine';

const PUBLISH_INTERVAL_MS = 60_000;
const METRICS_INTERVAL_MS = 6 * 60 * 60 * 1000;

declare global {
  // eslint-disable-next-line no-var
  var __loveinteaSchedulerStarted: boolean | undefined;
}

export function startScheduler() {
  if (globalThis.__loveinteaSchedulerStarted) return;
  globalThis.__loveinteaSchedulerStarted = true;
  console.log('[scheduler] started — publish check 60s, metrics sync 6h');

  setInterval(() => {
    publishDuePosts().catch(e => console.error('[scheduler] publish error:', e));
  }, PUBLISH_INTERVAL_MS);

  setInterval(() => {
    syncMetrics().catch(e => console.error('[scheduler] metrics error:', e));
  }, METRICS_INTERVAL_MS);

  // First metrics sync 2 min after boot (let the server settle)
  setTimeout(() => {
    syncMetrics().catch(e => console.error('[scheduler] initial metrics error:', e));
  }, 120_000);
}

interface DuePost {
  id: string; caption: string | null; image_url: string | null;
  platforms: string | null; fb_post_id: string | null; ig_post_id: string | null;
}

export async function publishDuePosts() {
  const db = getDb();
  const due = db.prepare(`
    SELECT id, caption, image_url, platforms, fb_post_id, ig_post_id
    FROM posts
    WHERE status = 'scheduled'
      AND scheduled_at IS NOT NULL
      AND datetime(scheduled_at) <= datetime('now')
  `).all() as DuePost[];

  if (due.length === 0) return;
  console.log(`[scheduler] ${due.length} scheduled post(s) due`);

  const logInsert = db.prepare(`
    INSERT INTO publish_log (id, post_id, platform, action, status, result_id, error)
    VALUES (?, ?, ?, 'scheduled_publish', ?, ?, ?)
  `);

  for (const post of due) {
    const platforms = (post.platforms ?? 'facebook').split(',').map(p => p.trim());
    const caption = post.caption ?? '';
    const imageUrls = post.image_url ? [post.image_url] : [];
    let anyOk = false;
    let anyFail = false;

    // FB: if fb_post_id already set, FB published it natively at the scheduled
    // time — nothing to do. Otherwise post now.
    if (platforms.includes('facebook')) {
      if (post.fb_post_id) {
        anyOk = true;
      } else {
        const fb = await postToFacebook({ caption, imageUrls });
        logInsert.run(uuid(), post.id, 'facebook', fb.ok ? 'ok' : 'failed', fb.postId ?? null, fb.error ?? null);
        if (fb.ok) {
          db.prepare('UPDATE posts SET fb_post_id = ? WHERE id = ?').run(fb.postId, post.id);
          anyOk = true;
        } else { anyFail = true; console.error(`[scheduler] FB publish failed for ${post.id}: ${fb.error}`); }
      }
    }

    // IG: no native scheduling — publish now if not already published.
    if (platforms.includes('instagram') && !post.ig_post_id) {
      const ig = await postToInstagram({ caption, imageUrls });
      logInsert.run(uuid(), post.id, 'instagram', ig.ok ? 'ok' : 'failed', ig.postId ?? null, ig.error ?? null);
      if (ig.ok) {
        db.prepare('UPDATE posts SET ig_post_id = ? WHERE id = ?').run(ig.postId, post.id);
        anyOk = true;
      } else { anyFail = true; console.error(`[scheduler] IG publish failed for ${post.id}: ${ig.error}`); }
    }

    if (anyOk) {
      db.prepare("UPDATE posts SET status = 'published', published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(post.id);
    } else if (anyFail) {
      db.prepare("UPDATE posts SET status = 'failed', updated_at = datetime('now') WHERE id = ?").run(post.id);
    }
  }
}

function upsertMetrics(postId: string, brandId: string, platform: string, m: FetchedMetrics) {
  const db = getDb();
  const updated = db.prepare(`
    UPDATE post_metrics
    SET reach=?, impressions=?, engaged=?, reactions=?, comments=?, shares=?, saves=?, fetched_at=datetime('now')
    WHERE post_id = ? AND platform = ?
  `).run(m.reach, m.impressions, m.engaged, m.reactions, m.comments, m.shares, m.saves, postId, platform);

  if (updated.changes === 0) {
    db.prepare(`
      INSERT INTO post_metrics (id, post_id, brand_id, platform, reach, impressions, engaged, reactions, comments, shares, saves)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuid(), postId, brandId, platform, m.reach, m.impressions, m.engaged, m.reactions, m.comments, m.shares, m.saves);
  }
}

export async function syncMetrics() {
  const db = getDb();
  const posts = db.prepare(`
    SELECT id, brand_id, fb_post_id, ig_post_id
    FROM posts
    WHERE status = 'published'
      AND published_at > datetime('now', '-60 days')
      AND (fb_post_id IS NOT NULL AND fb_post_id != '' OR ig_post_id IS NOT NULL AND ig_post_id != '')
  `).all() as Array<{ id: string; brand_id: string | null; fb_post_id: string | null; ig_post_id: string | null }>;

  if (posts.length === 0) {
    console.log('[scheduler] metrics sync: no published posts with platform IDs');
    return;
  }

  let synced = 0;
  for (const p of posts) {
    const brandId = p.brand_id || 'loveintea';
    if (p.fb_post_id) {
      const m = await getFbPostMetrics(p.fb_post_id);
      if (m) { upsertMetrics(p.id, brandId, 'facebook', m); synced++; }
    }
    if (p.ig_post_id) {
      const m = await getIgMediaMetrics(p.ig_post_id);
      if (m) { upsertMetrics(p.id, brandId, 'instagram', m); synced++; }
    }
  }
  console.log(`[scheduler] metrics sync: ${synced} metric row(s) updated across ${posts.length} post(s)`);

  // Recompute scoreboard per brand that has published posts
  const brands = db.prepare(`SELECT DISTINCT COALESCE(brand_id, 'loveintea') as b FROM posts WHERE status = 'published'`).all() as Array<{ b: string }>;
  for (const { b } of brands) {
    const r = recomputeScoreboard(b);
    console.log(`[scheduler] scoreboard recompute [${b}]: ${r.updated} angle(s) updated`);
  }
}

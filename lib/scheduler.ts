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
  postToFacebook, postToInstagram, hasIgCreds,
  postVideoToFacebook, postReelToInstagram,
  getFbPostMetrics, getIgMediaMetrics, FetchedMetrics,
  checkTokenHealth,
} from './facebook';
import { processVideoSchedules, onScheduledProjectDone } from './video/schedule';
import { recomputeScoreboard } from './scoreboard-engine';

const PUBLISH_INTERVAL_MS = 60_000;
const METRICS_INTERVAL_MS = 6 * 60 * 60 * 1000;
const VIDEO_QUEUE_INTERVAL_MS = 30_000;
const VIDEO_SCHEDULE_INTERVAL_MS = 5 * 60_000;

let videoRendering = false;

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
    refreshTokenHealth().catch(e => console.error('[scheduler] token health error:', e));
  }, METRICS_INTERVAL_MS);

  setInterval(() => {
    processVideoQueue().catch(e => console.error('[scheduler] video queue error:', e));
  }, VIDEO_QUEUE_INTERVAL_MS);

  setInterval(() => {
    processVideoSchedules().catch(e => console.error('[scheduler] video schedule error:', e));
  }, VIDEO_SCHEDULE_INTERVAL_MS);

  // First metrics sync 2 min after boot (let the server settle)
  setTimeout(() => {
    syncMetrics().catch(e => console.error('[scheduler] initial metrics error:', e));
    refreshTokenHealth().catch(e => console.error('[scheduler] initial token health error:', e));
  }, 120_000);
}

/** Render queued video projects — strictly one at a time (2 vCPU server). */
export async function processVideoQueue() {
  if (videoRendering) return;
  const db = getDb();
  // Recover projects stuck in 'rendering' from a previous crashed process
  db.prepare(`UPDATE video_projects SET status='failed', error='render interrupted (server restart)'
    WHERE status='rendering' AND updated_at < datetime('now', '-30 minutes')`).run();
  const next = db.prepare(`SELECT id FROM video_projects WHERE status='queued' ORDER BY updated_at ASC LIMIT 1`)
    .get() as { id: string } | undefined;
  if (!next) return;

  videoRendering = true;
  db.prepare(`UPDATE video_projects SET status='rendering', updated_at=datetime('now') WHERE id=?`).run(next.id);
  console.log(`[scheduler] video render start: ${next.id}`);
  try {
    const { renderProject } = await import('./video/render');
    await renderProject(next.id);
    console.log(`[scheduler] video render done: ${next.id}`);
    // Project thuộc lịch định kỳ → tạo bài đăng mang video (draft/scheduled)
    try { onScheduledProjectDone(next.id); } catch (e) { console.error('[scheduler] schedule post error:', e); }
  } catch (e) {
    console.error(`[scheduler] video render failed: ${next.id}:`, e);
  } finally {
    videoRendering = false;
  }
}

function upsertSetting(key: string, value: string) {
  getDb().prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`).run(key, value);
}

/** Re-validate the FB page token and cache the result for the Dashboard / health API. */
export async function refreshTokenHealth() {
  const health = await checkTokenHealth();
  upsertSetting('fb_token_health', JSON.stringify(health));
  if (health.configured && !health.valid) {
    console.error(`[scheduler] FB token INVALID: ${health.error}`);
  } else if (health.daysLeft !== null && health.daysLeft < 7) {
    console.warn(`[scheduler] FB token expires in ${health.daysLeft} day(s)`);
  }
}

interface DuePost {
  id: string; caption: string | null; image_url: string | null; images_json: string | null;
  platforms: string | null; fb_post_id: string | null; ig_post_id: string | null;
  brand_id: string | null; video_url: string | null;
}

export async function publishDuePosts() {
  const db = getDb();
  // Heartbeat — Dashboard reads this to confirm the scheduler is alive
  upsertSetting('scheduler_last_tick', new Date().toISOString());
  const due = db.prepare(`
    SELECT id, caption, image_url, images_json, platforms, fb_post_id, ig_post_id, brand_id, video_url
    FROM posts
    WHERE status = 'scheduled'
      AND scheduled_at IS NOT NULL
      AND datetime(scheduled_at) <= datetime('now')
      AND COALESCE(publish_mode, 'api') <> 'manual'
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
    let imageUrls = post.image_url ? [post.image_url] : [];
    try { const arr = JSON.parse(post.images_json || '[]') as string[]; if (arr.length) imageUrls = arr; } catch { /* */ }
    const brandId = post.brand_id || 'loveintea';
    let anyOk = false;
    let anyFail = false;

    // Bỏ qua bài rỗng (không caption + không ảnh + không video) — không thể đăng.
    if (!caption.trim() && imageUrls.length === 0 && !post.video_url) {
      logInsert.run(uuid(), post.id, 'all', 'failed', null, 'Bài rỗng — chưa có caption hoặc ảnh.');
      db.prepare("UPDATE posts SET status = 'failed', updated_at = datetime('now') WHERE id = ?").run(post.id);
      continue;
    }

    // FB: if fb_post_id already set, FB published it natively at the scheduled
    // time — nothing to do. Otherwise post now.
    if (platforms.includes('facebook')) {
      if (post.fb_post_id) {
        anyOk = true;
      } else {
        // Bài video (từ Video Studio / lịch định kỳ) → đăng qua /videos thay vì /feed ảnh.
        const fb = post.video_url
          ? await postVideoToFacebook({ caption, videoUrl: post.video_url, brandId })
          : await postToFacebook({ caption, imageUrls, brandId });
        logInsert.run(uuid(), post.id, 'facebook', fb.ok ? 'ok' : 'failed', fb.postId ?? null, fb.error ?? null);
        if (fb.ok) {
          db.prepare('UPDATE posts SET fb_post_id = ? WHERE id = ?').run(fb.postId, post.id);
          anyOk = true;
        } else { anyFail = true; console.error(`[scheduler] FB publish failed for ${post.id}: ${fb.error}`); }
      }
    }

    // IG: no native scheduling — publish now if not already published.
    // Nếu IG chưa kết nối → SKIP (không tính fail) để bài vẫn đăng FB bình thường.
    if (platforms.includes('instagram') && !post.ig_post_id) {
      if (!hasIgCreds(brandId)) {
        logInsert.run(uuid(), post.id, 'instagram', 'skipped', null, 'IG chưa kết nối — bỏ qua, chỉ đăng các kênh khác.');
      } else {
        const ig = post.video_url
          ? await postReelToInstagram({ caption, videoUrl: post.video_url, brandId })
          : await postToInstagram({ caption, imageUrls, brandId });
        logInsert.run(uuid(), post.id, 'instagram', ig.ok ? 'ok' : 'failed', ig.postId ?? null, ig.error ?? null);
        if (ig.ok) {
          db.prepare('UPDATE posts SET ig_post_id = ? WHERE id = ?').run(ig.postId, post.id);
          anyOk = true;
        } else { anyFail = true; console.error(`[scheduler] IG publish failed for ${post.id}: ${ig.error}`); }
      }
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
      const m = await getFbPostMetrics(p.fb_post_id, brandId);
      if (m) { upsertMetrics(p.id, brandId, 'facebook', m); synced++; }
    }
    if (p.ig_post_id) {
      const m = await getIgMediaMetrics(p.ig_post_id, brandId);
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

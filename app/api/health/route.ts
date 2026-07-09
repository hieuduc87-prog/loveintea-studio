export const dynamic = 'force-dynamic';
/**
 * GET /api/health — system status for the Dashboard, SCOPED to the active brand.
 * ?live=1 forces a fresh FB token check instead of the 6h cached one.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { checkTokenHealth, TokenHealth } from '@/lib/facebook';
import { getBrandId } from '@/lib/brand-guard';

export async function GET(req: NextRequest) {
  const db = getDb();
  const getSetting = (k: string) =>
    (db.prepare('SELECT value, updated_at FROM settings WHERE key=?').get(k) as { value: string; updated_at: string } | undefined);

  // Trusted brand (middleware-validated header). All per-brand stats below scope to it.
  const brand = getBrandId(req) || 'loveintea';

  // ── Facebook token health (cached by scheduler every 6h, or live) ──
  let fbToken: TokenHealth | null = null;
  if (brand && brand !== 'loveintea') {
    // Non-default brands: always live-check their own channel creds
    fbToken = await checkTokenHealth(brand);
  } else if (req.nextUrl.searchParams.get('live') === '1') {
    fbToken = await checkTokenHealth();
    db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('fb_token_health', ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
      .run(JSON.stringify(fbToken));
  } else {
    const cached = getSetting('fb_token_health');
    if (cached) { try { fbToken = JSON.parse(cached.value); } catch { /* recheck below */ } }
    if (!fbToken) fbToken = await checkTokenHealth();
  }

  const igConfigured = Boolean(
    process.env.IG_BUSINESS_ACCOUNT_ID ||
    getSetting('IG_BUSINESS_ACCOUNT_ID')?.value
  );

  // ── Scheduler heartbeat (global) ──
  const tick = getSetting('scheduler_last_tick')?.value ?? null;
  const schedulerAlive = tick ? (Date.now() - new Date(tick).getTime()) < 3 * 60_000 : false;

  // ── AI providers (global) ──
  const aiFallbackAt = getSetting('ai_text_fallback_at')?.value ?? null;
  const ai = {
    gemini: Boolean(process.env.GEMINI_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    openaiBackup: Boolean(process.env.OPENAI_API_KEY_BACKUP),
    // Fallback used in last 24h = Gemini đang gặp sự cố
    textFallbackActive: aiFallbackAt ? (Date.now() - new Date(aiFallbackAt).getTime()) < 24 * 3600_000 : false,
    textFallbackAt: aiFallbackAt,
  };

  // ── Content funnel (per-brand) ──
  const counts: Record<string, number> = { draft: 0, scheduled: 0, published: 0, failed: 0 };
  for (const r of db.prepare(`SELECT status, COUNT(*) n FROM posts WHERE brand_id=? GROUP BY status`).all(brand) as Array<{ status: string; n: number }>) {
    if (r.status in counts) counts[r.status] = r.n;
  }
  const publishedLast7d = (db.prepare(
    `SELECT COUNT(*) n FROM posts WHERE brand_id=? AND status='published' AND published_at > datetime('now','-7 days')`
  ).get(brand) as { n: number }).n;

  // ── Upcoming scheduled posts (per-brand) ──
  const upcoming = db.prepare(`
    SELECT id, caption, platforms, scheduled_at, image_url
    FROM posts WHERE brand_id=? AND status='scheduled' AND scheduled_at IS NOT NULL
    ORDER BY datetime(scheduled_at) ASC LIMIT 5
  `).all(brand);

  // ── Recent publish failures (7d, per-brand) ──
  const failures = db.prepare(`
    SELECT pl.post_id, pl.platform, pl.error, pl.created_at, p.caption
    FROM publish_log pl JOIN posts p ON p.id = pl.post_id
    WHERE pl.status='failed' AND pl.created_at > datetime('now','-7 days') AND p.brand_id=?
    ORDER BY pl.created_at DESC LIMIT 5
  `).all(brand);

  // ── Intelligence loop (per-brand) ──
  const metricsRows = (db.prepare(`SELECT COUNT(*) n FROM post_metrics WHERE brand_id=?`).get(brand) as { n: number }).n;
  const lastMetricsSync = (db.prepare(`SELECT MAX(fetched_at) t FROM post_metrics WHERE brand_id=?`).get(brand) as { t: string | null }).t;
  const scoreboardAngles = (db.prepare(`SELECT COUNT(*) n FROM scoreboard WHERE brand_id=?`).get(brand) as { n: number }).n;
  const activeRules = (db.prepare(`SELECT COUNT(*) n FROM content_rules WHERE status='active' AND brand_id=?`).get(brand) as { n: number }).n;

  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    brand,
    facebook: { token: fbToken, igConfigured },
    scheduler: { alive: schedulerAlive, lastTick: tick },
    ai,
    funnel: { ...counts, publishedLast7d },
    upcoming,
    failures,
    intelligence: { metricsRows, lastMetricsSync, scoreboardAngles, activeRules },
  });
}

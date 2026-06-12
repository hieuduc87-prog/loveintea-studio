export const dynamic = 'force-dynamic';
/**
 * GET /api/health — system status for the Dashboard.
 * ?live=1 forces a fresh FB token check instead of the 6h cached one.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { checkTokenHealth, TokenHealth } from '@/lib/facebook';

export async function GET(req: NextRequest) {
  const db = getDb();
  const getSetting = (k: string) =>
    (db.prepare('SELECT value, updated_at FROM settings WHERE key=?').get(k) as { value: string; updated_at: string } | undefined);

  // ── Facebook token health (cached by scheduler every 6h, or live) ──
  const brandId = req.nextUrl.searchParams.get('brandId') || undefined;
  let fbToken: TokenHealth | null = null;
  if (brandId && brandId !== 'loveintea') {
    // Non-default brands: always live-check their own channel creds
    fbToken = await checkTokenHealth(brandId);
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

  // ── Scheduler heartbeat ──
  const tick = getSetting('scheduler_last_tick')?.value ?? null;
  const schedulerAlive = tick ? (Date.now() - new Date(tick).getTime()) < 3 * 60_000 : false;

  // ── AI providers ──
  const aiFallbackAt = getSetting('ai_text_fallback_at')?.value ?? null;
  const ai = {
    gemini: Boolean(process.env.GEMINI_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    openaiBackup: Boolean(process.env.OPENAI_API_KEY_BACKUP),
    // Fallback used in last 24h = Gemini đang gặp sự cố
    textFallbackActive: aiFallbackAt ? (Date.now() - new Date(aiFallbackAt).getTime()) < 24 * 3600_000 : false,
    textFallbackAt: aiFallbackAt,
  };

  // ── Content funnel ──
  const counts: Record<string, number> = { draft: 0, scheduled: 0, published: 0, failed: 0 };
  for (const r of db.prepare(`SELECT status, COUNT(*) n FROM posts GROUP BY status`).all() as Array<{ status: string; n: number }>) {
    if (r.status in counts) counts[r.status] = r.n;
  }
  const publishedLast7d = (db.prepare(
    `SELECT COUNT(*) n FROM posts WHERE status='published' AND published_at > datetime('now','-7 days')`
  ).get() as { n: number }).n;

  // ── Upcoming scheduled posts ──
  const upcoming = db.prepare(`
    SELECT id, caption, platforms, scheduled_at, image_url
    FROM posts WHERE status='scheduled' AND scheduled_at IS NOT NULL
    ORDER BY datetime(scheduled_at) ASC LIMIT 5
  `).all();

  // ── Recent publish failures (7d) ──
  const failures = db.prepare(`
    SELECT pl.post_id, pl.platform, pl.error, pl.created_at, p.caption
    FROM publish_log pl LEFT JOIN posts p ON p.id = pl.post_id
    WHERE pl.status='failed' AND pl.created_at > datetime('now','-7 days')
    ORDER BY pl.created_at DESC LIMIT 5
  `).all();

  // ── Intelligence loop ──
  const metricsRows = (db.prepare(`SELECT COUNT(*) n FROM post_metrics`).get() as { n: number }).n;
  const lastMetricsSync = (db.prepare(`SELECT MAX(fetched_at) t FROM post_metrics`).get() as { t: string | null }).t;
  const scoreboardAngles = (db.prepare(`SELECT COUNT(*) n FROM scoreboard`).get() as { n: number }).n;
  const activeRules = (db.prepare(`SELECT COUNT(*) n FROM content_rules WHERE status='active'`).get() as { n: number }).n;

  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    facebook: { token: fbToken, igConfigured },
    scheduler: { alive: schedulerAlive, lastTick: tick },
    ai,
    funnel: { ...counts, publishedLast7d },
    upcoming,
    failures,
    intelligence: { metricsRows, lastMetricsSync, scoreboardAngles, activeRules },
  });
}

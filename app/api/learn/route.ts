export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateCaption } from '@/lib/gemini';

// POST /api/learn — run learn engine: attribute performance, propose rules
export async function POST(req: NextRequest) {
  try {
    const { brandId } = await req.json() as { brandId?: string };
    const bid = brandId || 'loveintea';
    const db = getDb();

    // Gather post performance data with lineage
    const posts = db.prepare(`
      SELECT
        p.id, p.cell_id, p.brief_id, p.rule_version, p.caption, p.sku_id,
        p.segment_id, p.rtb_id, p.usp_id, p.platforms,
        p.published_at,
        pm.reach, pm.impressions, pm.engaged, pm.saves, pm.comments, pm.shares
      FROM posts p
      LEFT JOIN post_metrics pm ON pm.post_id = p.id
      WHERE p.brand_id = ? AND p.status = 'published'
      AND p.published_at > datetime('now', '-30 days')
      ORDER BY p.published_at DESC
      LIMIT 50
    `).all(bid) as Array<Record<string, unknown>>;

    if (posts.length < 5) {
      return NextResponse.json({
        ok: true,
        message: `Only ${posts.length} published posts in last 30 days. Need at least 5 for meaningful analysis.`,
        status: 'insufficient_data',
        postCount: posts.length,
        scoreboard_updates: [],
        proposed_rules: [],
      });
    }

    // Get current active rules for context
    const activeRules = db.prepare(
      `SELECT rule_text FROM content_rules WHERE brand_id = ? AND status = 'active' ORDER BY created_at ASC`
    ).all(bid) as { rule_text: string }[];

    const prompt = `You are the learning engine for LoveinTea.

INPUT — Post performance data (last 30 days):
${JSON.stringify(posts.map(p => ({
  cell: p.cell_id, sku: p.sku_id, segment: p.segment_id, rtb: p.rtb_id, usp: p.usp_id,
  channel: String(p.platforms).includes('instagram') ? 'IG' : 'FB',
  reach: p.reach ?? 0, engaged: p.engaged ?? 0, saves: p.saves ?? 0, comments: p.comments ?? 0,
  brief_id: p.brief_id, rule_version: p.rule_version,
})), null, 1)}

Current active rules (${activeRules.length}):
${activeRules.map((r, i) => `${i + 1}. ${r.rule_text}`).join('\n')}

TASKS:
1. For each unique cell_id/angle: compute avg saves, reach, ER by channel.
2. Only conclude when sample >= 3 posts for that angle. Otherwise → HOLD.
3. Apply absolute saves floor (min 2 saves avg) before SCALE verdict.
4. Propose max 2-3 new rules with evidence. Rule ceiling is 30.
5. Identify if any current rule should be retired (no longer supported by data).

Return JSON:
{
  "scoreboard_updates": [{"angle": "...", "channel": "...", "verdict": "SCALE|HOLD|RETIRE", "avg_saves": 0, "sample_size": 0, "reasoning": "..."}],
  "proposed_rules": [{"rule_text": "...", "evidence": "...", "replaces_rule_id": null}],
  "retire_rules": [{"rule_text": "...", "reason": "..."}],
  "summary": "1-2 sentence summary"
}`;

    const result = await generateCaption(`${prompt}\n\nReturn only valid JSON.`);

    let parsed: {
      scoreboard_updates: Array<{ angle: string; channel: string; verdict: string; avg_saves: number; sample_size: number; reasoning: string }>;
      proposed_rules: Array<{ rule_text: string; evidence: string }>;
      retire_rules: Array<{ rule_text: string; reason: string }>;
      summary: string;
    };

    try {
      const m = result.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(m ? m[0] : result);
    } catch {
      return NextResponse.json({
        ok: false,
        error: 'Learn engine returned unparseable response',
        raw: result.slice(0, 500),
      }, { status: 500 });
    }

    // Apply scoreboard updates
    const { v4: uuid } = await import('uuid');
    const upsert = db.prepare(`
      INSERT INTO scoreboard (id, brand_id, angle, channel, saves, reach, er, sample_size, verdict, evidence_json, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, datetime('now'))
      ON CONFLICT(brand_id, angle, channel)
      DO UPDATE SET saves=?, sample_size=?, verdict=?, evidence_json=?, updated_at=datetime('now')
    `);

    for (const u of (parsed.scoreboard_updates ?? [])) {
      const evidence = JSON.stringify({ reasoning: u.reasoning, avg_saves: u.avg_saves });
      upsert.run(
        uuid(), bid, u.angle, u.channel || 'mixed', Math.round(u.avg_saves ?? 0), u.sample_size, u.verdict, evidence,
        Math.round(u.avg_saves ?? 0), u.sample_size, u.verdict, evidence
      );
    }

    return NextResponse.json({
      ok: true,
      status: 'analyzed',
      postCount: posts.length,
      ...parsed,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

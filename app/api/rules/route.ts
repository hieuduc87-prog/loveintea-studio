export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';

// GET /api/rules?brandId=X — list active rules
export async function GET(req: NextRequest) {
  try {
    const brandId = req.nextUrl.searchParams.get('brandId') || 'loveintea';
    const showAll = req.nextUrl.searchParams.get('all') === '1';
    const db = getDb();

    const where = showAll ? 'WHERE brand_id = ?' : "WHERE brand_id = ? AND status = 'active'";
    const rules = db.prepare(
      `SELECT * FROM content_rules ${where} ORDER BY created_at ASC`
    ).all(brandId);

    const activeCount = (db.prepare(
      `SELECT COUNT(*) as n FROM content_rules WHERE brand_id = ? AND status = 'active'`
    ).get(brandId) as { n: number }).n;

    return NextResponse.json({
      rules,
      activeCount,
      maxRules: 30,
      canAdd: activeCount < 30,
    });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

// POST /api/rules — add new rule or retire existing
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { brandId, action } = body as { brandId?: string; action?: string };
    const bid = brandId || 'loveintea';
    const db = getDb();

    if (action === 'add') {
      const { ruleText, evidence, replacesRuleId } = body as {
        ruleText: string; evidence?: string; replacesRuleId?: string;
      };
      if (!ruleText) return NextResponse.json({ error: 'ruleText required' }, { status: 400 });

      // Check limit
      const activeCount = (db.prepare(
        `SELECT COUNT(*) as n FROM content_rules WHERE brand_id = ? AND status = 'active'`
      ).get(bid) as { n: number }).n;

      if (activeCount >= 30 && !replacesRuleId) {
        return NextResponse.json({
          error: 'Rule limit reached (30). Retire a rule first or specify replacesRuleId.'
        }, { status: 400 });
      }

      // Retire old rule if replacing
      if (replacesRuleId) {
        db.prepare(
          `UPDATE content_rules SET status = 'retired', retired_at = datetime('now') WHERE id = ?`
        ).run(replacesRuleId);
      }

      // Compute version
      const lastRule = db.prepare(
        `SELECT version FROM content_rules WHERE brand_id = ? ORDER BY created_at DESC LIMIT 1`
      ).get(bid) as { version: string } | undefined;

      const lastVer = lastRule?.version ?? 'v1.0';
      const verNum = parseFloat(lastVer.replace('v', '')) || 1.0;
      const newVersion = `v${(verNum + 0.1).toFixed(1)}`;

      const id = uuid();
      db.prepare(
        `INSERT INTO content_rules (id, brand_id, version, rule_text, evidence, source, replaces_rule_id, status)
         VALUES (?, ?, ?, ?, ?, 'manual', ?, 'active')`
      ).run(id, bid, newVersion, ruleText, evidence ?? null, replacesRuleId ?? null);

      return NextResponse.json({ ok: true, rule: { id, version: newVersion, ruleText } }, { status: 201 });
    }

    if (action === 'retire') {
      const { ruleId, reason } = body as { ruleId: string; reason?: string };
      db.prepare(
        `UPDATE content_rules SET status = 'retired', retired_at = datetime('now'), evidence = COALESCE(evidence, '') || ? WHERE id = ?`
      ).run(reason ? `\n[Retired: ${reason}]` : '', ruleId);
      return NextResponse.json({ ok: true });
    }

    if (action === 'seed') {
      // Seed default rules from brand knowledge
      const defaults = [
        'Every post must follow 4-beat structure: Hook → Bridge to USP → Heritage Voice → CTA',
        'Copy must use theme/moment language only — NEVER structure/function health claims',
        'Tag: 1 white LoveinTea logo tag. NOT red, NOT kraft.',
        'CTA: maximum 1-2 per every 9 tiles in the feed grid',
        'Emotion:proof ratio ~70:30. Never let proof exceed 50%.',
        'Each post tests exactly 1 variable_cell — no multi-variable posts',
        'Brew color must match per-SKU HARD LOCK (see beverage table)',
        'IG = brand/discovery channel; FB = community/trust/conversion channel',
      ];

      const existing = (db.prepare(
        `SELECT COUNT(*) as n FROM content_rules WHERE brand_id = ? AND status = 'active'`
      ).get(bid) as { n: number }).n;

      if (existing > 0) {
        return NextResponse.json({ ok: true, message: 'Rules already exist, skipping seed', count: existing });
      }

      for (const rule of defaults) {
        db.prepare(
          `INSERT INTO content_rules (id, brand_id, version, rule_text, source, status)
           VALUES (?, ?, 'v1.0', ?, 'seed', 'active')`
        ).run(uuid(), bid, rule);
      }
      return NextResponse.json({ ok: true, seeded: defaults.length });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (console.error('[api]', e), 'Có lỗi hệ thống') }, { status: 500 });
  }
}

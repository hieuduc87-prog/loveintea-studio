/**
 * Cost engine — estimated unit costs per content type + actual-usage roll-up + P&L.
 * Unit costs are estimates (USD) stored in settings so they can be tuned per account.
 */
import { getDb } from './db';

export interface UnitCosts {
  caption_usd: number;   // 1 AI caption (Gemini/OpenAI)
  image_usd: number;     // 1 AI image (gpt-image-2)
  video_usd: number;     // 1 short video (AI image segments + TTS + render)
  template_usd: number;  // 1 template analysis (Gemini Vision)
  usd_to_vnd: number;    // FX for display
}

export const DEFAULT_UNIT_COSTS: UnitCosts = {
  caption_usd: 0.002,
  image_usd: 0.02,
  video_usd: 0.06,
  template_usd: 0.003,
  usd_to_vnd: 25000,
};

export function getUnitCosts(): UnitCosts {
  try {
    const row = getDb().prepare("SELECT value FROM settings WHERE key='unit_costs'").get() as { value: string } | undefined;
    if (row) return { ...DEFAULT_UNIT_COSTS, ...JSON.parse(row.value) };
  } catch { /* default */ }
  return DEFAULT_UNIT_COSTS;
}

export function setUnitCosts(costs: Partial<UnitCosts>) {
  const merged = { ...getUnitCosts(), ...costs };
  getDb().prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('unit_costs', ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
    .run(JSON.stringify(merged));
  return merged;
}

export interface CostReport {
  unit: UnitCosts;
  usage: { captions: number; images: number; videos: number; templates: number };
  cost: { captions: number; images: number; videos: number; templates: number; total_usd: number; total_vnd: number };
  perType: { single_post: number; image: number; video: number; template: number };  // unit cost per produced item (USD)
  pnl: { revenue_vnd: number; cost_vnd: number; profit_vnd: number; margin: number };
}

export function buildCostReport(brandId: string): CostReport {
  const db = getDb();
  const unit = getUnitCosts();
  const n = (sql: string, ...p: unknown[]) => (db.prepare(sql).get(...p) as { n: number } | undefined)?.n ?? 0;

  // Actual usage
  const captions  = n(`SELECT COUNT(*) n FROM posts WHERE brand_id=? AND caption IS NOT NULL AND caption!=''`, brandId);
  const images    = n(`SELECT COUNT(*) n FROM image_jobs WHERE status='done'`)
                  + n(`SELECT COUNT(*) n FROM posts WHERE brand_id=? AND image_url LIKE '/api/images/%'`, brandId);
  const videos    = n(`SELECT COUNT(*) n FROM video_projects WHERE brand_id=? AND status='done'`, brandId);
  const templates = n(`SELECT COUNT(*) n FROM content_templates WHERE brand_id=? AND analysis!=''`, brandId);

  const cost = {
    captions: captions * unit.caption_usd,
    images: images * unit.image_usd,
    videos: videos * unit.video_usd,
    templates: templates * unit.template_usd,
    total_usd: 0, total_vnd: 0,
  };
  cost.total_usd = cost.captions + cost.images + cost.videos + cost.templates;
  cost.total_vnd = Math.round(cost.total_usd * unit.usd_to_vnd);

  // P&L — revenue from paid bank transfers + momo
  const revenueVnd =
    n(`SELECT COALESCE(SUM(amount),0) n FROM bank_transfers WHERE status='paid'`)
    + n(`SELECT COALESCE(SUM(amount),0) n FROM momo_payments WHERE status='paid'`).valueOf();

  const profit = revenueVnd - cost.total_vnd;
  return {
    unit, usage: { captions, images, videos, templates }, cost,
    perType: {
      single_post: unit.caption_usd + unit.image_usd,
      image: unit.image_usd,
      video: unit.video_usd,
      template: unit.template_usd,
    },
    pnl: {
      revenue_vnd: revenueVnd, cost_vnd: cost.total_vnd, profit_vnd: profit,
      margin: revenueVnd > 0 ? Math.round((profit / revenueVnd) * 100) : 0,
    },
  };
}

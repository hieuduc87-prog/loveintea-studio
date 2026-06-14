export const dynamic = 'force-dynamic';
/**
 * GET /api/brands/[id]/mindmap — brand knowledge as a node tree for the mindmap UI.
 * Aggregates DNA, audience segments, products, knowledge docs (by type), rules, templates.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { SEGMENTS } from '@/lib/brand-dna';

interface Node { label: string; detail?: string }
interface Branch { key: string; label: string; icon: string; children: Node[] }

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: brandId } = await params;
  const db = getDb();
  const brand = db.prepare('SELECT name FROM brands WHERE id=?').get(brandId) as { name: string } | undefined;
  const dna = db.prepare('SELECT * FROM brand_dna WHERE brand_id=?').get(brandId) as Record<string, string> | undefined;

  const branches: Branch[] = [];

  // DNA
  const dnaNodes: Node[] = [];
  if (dna?.tagline) dnaNodes.push({ label: 'Tagline', detail: dna.tagline });
  if (dna?.archetype) dnaNodes.push({ label: 'Archetype', detail: dna.archetype });
  try { (JSON.parse(dna?.voice_traits || '[]') as string[]).slice(0, 4).forEach(v => dnaNodes.push({ label: 'Voice', detail: v })); } catch { /* */ }
  if (dna?.target_audience) dnaNodes.push({ label: 'Khách hàng', detail: dna.target_audience });
  if (dna?.insight) dnaNodes.push({ label: 'Insight', detail: dna.insight });
  if (dna?.behavior) dnaNodes.push({ label: 'Hành vi', detail: dna.behavior });
  if (dna?.brand_rules) dnaNodes.push({ label: 'Brand rules', detail: dna.brand_rules });
  if (dnaNodes.length) branches.push({ key: 'dna', label: 'Brand DNA', icon: '🌿', children: dnaNodes });

  // Audience segments (DB else seeded)
  const aud = db.prepare('SELECT name, tension FROM audiences WHERE brand_id=?').all(brandId) as Array<{ name: string; tension: string }>;
  const segs = aud.length ? aud : (brandId === 'loveintea' ? SEGMENTS.map(s => ({ name: s.name, tension: s.tension })) : []);
  if (segs.length) branches.push({ key: 'segments', label: 'Đối tượng', icon: '🎯', children: segs.map(s => ({ label: s.name, detail: s.tension })) });

  // Products
  const products = db.prepare('SELECT name, pitch FROM products WHERE brand_id=? ORDER BY sort_order').all(brandId) as Array<{ name: string; pitch: string }>;
  if (products.length) branches.push({ key: 'products', label: 'Sản phẩm', icon: '📦', children: products.map(p => ({ label: p.name, detail: p.pitch })) });

  // Knowledge docs grouped by type
  const docs = db.prepare('SELECT type, title FROM knowledge_docs WHERE brand_id=? ORDER BY uploaded_at DESC').all(brandId) as Array<{ type: string; title: string }>;
  if (docs.length) branches.push({ key: 'knowledge', label: `Tri thức (${docs.length})`, icon: '🧠', children: docs.slice(0, 12).map(d => ({ label: d.title, detail: d.type })) });

  // Rules
  const rules = db.prepare(`SELECT rule_text FROM content_rules WHERE brand_id=? AND status='active' ORDER BY created_at DESC LIMIT 10`).all(brandId) as Array<{ rule_text: string }>;
  if (rules.length) branches.push({ key: 'rules', label: 'Rules', icon: '⚙️', children: rules.map(r => ({ label: r.rule_text.slice(0, 40), detail: r.rule_text })) });

  // Templates
  const tpls = db.prepare(`SELECT name, kind FROM content_templates WHERE brand_id=? AND is_active=1 ORDER BY usage_count DESC LIMIT 10`).all(brandId) as Array<{ name: string; kind: string }>;
  if (tpls.length) branches.push({ key: 'templates', label: `Templates (${tpls.length})`, icon: '🎨', children: tpls.map(t => ({ label: t.name, detail: t.kind })) });

  return NextResponse.json({ brand: brand?.name ?? brandId, branches });
}

export const dynamic = 'force-dynamic';
/**
 * GET /api/admin/dashboard — Overview cho founder (admin-only).
 *
 * Trả JSON tổng hợp toàn platform + per-shop breakdown 30 ngày:
 *  - totals: shops, users, cost_usd, revenue_vnd (từ bank_transfers paid + momo done)
 *  - shops[]: {id, name, slug, plan, expires_at, quota{videos,images,content,cap_usd}
 *              usage{videos,images,content}, cost_30d_usd, revenue_30d_vnd,
 *              members_count, last_activity, alerts[]}
 *  - alerts: trial sắp hết (≤7d), quota gần đầy (>80%), cost bất thường (>gấp 2 tháng trước)
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdminSession } from '@/lib/api-auth';
import { isCostViewer } from '@/lib/platform-access';

interface Shop {
  id: string; name: string; slug: string; created_at: string;
  plan: string; plan_note: string; expires_at: string | null;
  quota_videos: number; quota_images: number; quota_content: number; cap_usd: number;
  usage_videos: number; usage_images: number; usage_content: number;
  cost_30d_usd: number; revenue_30d_vnd: number; revenue_all_vnd: number;
  members_count: number; last_activity: string | null;
  alerts: Array<{ level: 'warn' | 'critical'; msg: string }>;
}

export async function GET() {
  const auth = await requireAdminSession();
  if ('error' in auth) return auth.error;
  if (auth.role !== 'root_admin' && auth.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  const email = ((auth.session as { user?: { email?: string } } | null)?.user?.email || '').toLowerCase();
  const showCost = isCostViewer(email); // true = hieuduc87, false = manhson

  const db = getDb();
  const brands = db.prepare('SELECT id, name, slug, created_at FROM brands ORDER BY created_at DESC').all() as Array<{ id: string; name: string; slug: string; created_at: string }>;
  const now = new Date();
  const period = now.toISOString().slice(0, 7); // YYYY-MM (UTC)

  const shops: Shop[] = brands.map(b => {
    // Quota + plan
    const q = db.prepare('SELECT plan, videos, images, content, cap_usd, note FROM brand_quotas WHERE brand_id=?').get(b.id) as { plan: string; videos: number; images: number; content: number; cap_usd: number; note?: string } | undefined;
    const expiresMatch = q?.note?.match(/expires_at=(\d{4}-\d{2}-\d{2})/);
    const expiresAt = expiresMatch ? expiresMatch[1] : null;

    // Usage tháng hiện tại
    const usageRows = db.prepare('SELECT metric, used FROM usage_counters WHERE brand_id=? AND period=?').all(b.id, period) as Array<{ metric: string; used: number }>;
    const usage = { videos: 0, images: 0, content: 0 };
    for (const u of usageRows) { if (u.metric in usage) (usage as Record<string, number>)[u.metric] = u.used; }

    // Cost 30d (cost_ledger có brand_id)
    const cost = db.prepare("SELECT ROUND(SUM(usd), 4) sum FROM cost_ledger WHERE brand_id=? AND created_at >= datetime('now','-30 days')").get(b.id) as { sum: number | null };
    const cost30d = cost?.sum ?? 0;

    // Revenue 30d (bank_transfers paid + momo)
    const rev30 = db.prepare("SELECT COALESCE(SUM(amount),0) sum FROM bank_transfers WHERE brand_id=? AND status='paid' AND paid_at >= datetime('now','-30 days')").get(b.id) as { sum: number };
    const revAll = db.prepare("SELECT COALESCE(SUM(amount),0) sum FROM bank_transfers WHERE brand_id=? AND status='paid'").get(b.id) as { sum: number };

    // Members
    const memN = db.prepare('SELECT COUNT(*) c FROM brand_members WHERE brand_id=?').get(b.id) as { c: number };

    // Last activity — thời điểm cost_ledger mới nhất
    const last = db.prepare('SELECT MAX(created_at) t FROM cost_ledger WHERE brand_id=?').get(b.id) as { t: string | null };

    // Alerts
    const alerts: Shop['alerts'] = [];
    if (expiresAt) {
      const daysLeft = Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      if (daysLeft <= 0) alerts.push({ level: 'critical', msg: `Gói đã hết hạn ${-daysLeft} ngày` });
      else if (daysLeft <= 7) alerts.push({ level: 'warn', msg: `Gói còn ${daysLeft} ngày` });
    }
    if (q) {
      const usagePct = Math.max(
        q.videos > 0 ? usage.videos / q.videos : 0,
        q.images > 0 ? usage.images / q.images : 0,
        q.content > 0 ? usage.content / q.content : 0,
      );
      if (usagePct >= 1) alerts.push({ level: 'critical', msg: 'Đã dùng HẾT hạn mức' });
      else if (usagePct >= 0.8) alerts.push({ level: 'warn', msg: `Đã dùng ${Math.round(usagePct * 100)}% hạn mức` });
      if (cost30d >= q.cap_usd) alerts.push({ level: 'critical', msg: `Cost 30d ($${cost30d}) vượt trần ($${q.cap_usd})` });
    }
    if (!q) alerts.push({ level: 'warn', msg: 'Chưa set gói (quota rỗng)' });

    return {
      id: b.id, name: b.name, slug: b.slug, created_at: b.created_at,
      plan: q?.plan || '(chưa set)', plan_note: q?.note || '',
      expires_at: expiresAt,
      quota_videos: q?.videos ?? -1, quota_images: q?.images ?? -1, quota_content: q?.content ?? -1, cap_usd: q?.cap_usd ?? 0,
      usage_videos: usage.videos, usage_images: usage.images, usage_content: usage.content,
      cost_30d_usd: cost30d, revenue_30d_vnd: rev30.sum, revenue_all_vnd: revAll.sum,
      members_count: memN.c, last_activity: last?.t || null, alerts,
    };
  });

  // Totals platform
  const totalUsers = (db.prepare('SELECT COUNT(*) c FROM auth_users').get() as { c: number }).c;
  const activeUsers30d = (db.prepare("SELECT COUNT(*) c FROM auth_users WHERE last_login >= datetime('now','-30 days')").get() as { c: number }).c;
  const totalCost30d = shops.reduce((s, x) => s + x.cost_30d_usd, 0);
  const totalRev30d = shops.reduce((s, x) => s + x.revenue_30d_vnd, 0);
  const totalRevAll = shops.reduce((s, x) => s + x.revenue_all_vnd, 0);

  // Strip cost/revenue fields cho non-cost-viewer (manhson thấy shops + alerts nhưng KHÔNG thấy $)
  const shopsOut = showCost ? shops : shops.map(s => ({
    ...s,
    cost_30d_usd: 0, revenue_30d_vnd: 0, revenue_all_vnd: 0, cap_usd: 0,
    // Vẫn giữ alerts về trial/quota (không phải cost); strip alert "cost vượt cap"
    alerts: s.alerts.filter(a => !a.msg.startsWith('Cost 30d')),
  }));

  return NextResponse.json({
    show_cost: showCost,
    totals: {
      shops: shops.length,
      users: totalUsers,
      active_users_30d: activeUsers30d,
      // Ẩn hoàn toàn cost/revenue nếu không phải cost-viewer
      cost_30d_usd: showCost ? Math.round(totalCost30d * 10000) / 10000 : null,
      revenue_30d_vnd: showCost ? totalRev30d : null,
      revenue_all_vnd: showCost ? totalRevAll : null,
      profit_30d_vnd: showCost ? totalRev30d - Math.round(totalCost30d * 25000) : null,
    },
    shops: shopsOut,
    generated_at: now.toISOString(),
    // Ghi chú minh bạch cho hieuduc87: cost là ƯỚC theo pricing công bố, không phải billing thật
    cost_note: showCost ? 'Cost là ước tính theo bảng giá công bố (OpenAI/Gemini/fal). Không phải billing thật từ API provider — provider không hỗ trợ tag per-brand nên không thể lấy chính xác 100% per-shop. Reconcile với dashboard provider hàng tháng để hiệu chỉnh.' : undefined,
  });
}

export const dynamic = 'force-dynamic';
/**
 * POST /api/leads — PUBLIC route (middleware whitelist), nhận báo giá từ /plans/[slug]
 * và exit-intent popup. Ghi vào sales_leads + tạo kanban card 'sales-lead' cho team.
 *
 * Rate-limit: 3 lead/IP-hash/giờ (chống spam bot). IP hash SHA1 (không lưu IP thật).
 *
 * Body: { email, phone, storeName?, planSlug?, note?, source?: 'plans'|'exit-intent'|'homepage' }
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { getDb } from '@/lib/db';

const KANBAN_DIR = path.join(process.cwd(), 'data', 'kanban');
const RATE_LIMIT = 3;
const RATE_WINDOW_MIN = 60; // 60 phút

function hashIp(ip: string): string {
  return crypto.createHash('sha1').update(ip + '|ech-salt').digest('hex').slice(0, 16);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      email?: string; phone?: string; storeName?: string;
      planSlug?: string; note?: string; source?: string;
    };
    const email = (body.email || '').trim().toLowerCase();
    const phone = (body.phone || '').trim();
    const storeName = (body.storeName || '').trim();
    const planSlug = (body.planSlug || '').trim();
    const note = (body.note || '').trim();
    const source = (body.source || 'plans').trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email không hợp lệ' }, { status: 400 });
    }
    if (!phone || phone.length < 8) {
      return NextResponse.json({ error: 'Số điện thoại không hợp lệ' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
      || req.headers.get('x-real-ip') || 'unknown';
    const ipHash = hashIp(ip);
    const ua = req.headers.get('user-agent') || '';

    const db = getDb();

    // Rate-limit
    const since = new Date(Date.now() - RATE_WINDOW_MIN * 60 * 1000).toISOString();
    const recent = db.prepare(`SELECT COUNT(*) as n FROM sales_leads WHERE ip_hash=? AND created_at > ?`)
      .get(ipHash, since) as { n: number };
    if (recent.n >= RATE_LIMIT) {
      return NextResponse.json({ error: 'Bạn đã gửi quá nhiều lần. Vui lòng thử lại sau 1 giờ hoặc chat Zalo trực tiếp.' }, { status: 429 });
    }

    // Lấy plan name nếu có (để hiển thị trong kanban)
    let planName = planSlug;
    if (planSlug) {
      const p = db.prepare('SELECT name FROM service_plans WHERE slug=?').get(planSlug) as { name?: string } | undefined;
      if (p?.name) planName = p.name;
    }

    // 1) Tạo kanban card 'sales-lead' — brand=global (không thuộc tenant nào cụ thể)
    const cardId = crypto.randomUUID();
    const cardTitle = `[LEAD] ${storeName || email} — ${planName || 'chưa chọn gói'}`;
    const cardDesc = [
      `📧 Email: ${email}`,
      `📱 SĐT/Zalo: ${phone}`,
      storeName ? `🏬 Shop: ${storeName}` : '',
      planSlug ? `📦 Gói quan tâm: ${planName} (${planSlug})` : '',
      `🌐 Source: ${source}`,
      note ? `\n💬 Ghi chú khách:\n${note}` : '',
      `\n🕒 Nhận lúc: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
    ].filter(Boolean).join('\n');

    const card = {
      id: cardId,
      brandId: '__global__', // Không thuộc brand nào cụ thể, hiển thị Platform Console
      title: cardTitle,
      description: cardDesc,
      goal: `Liên hệ Zalo ${phone} trong 30 phút giờ hành chính, tư vấn gói ${planName || 'phù hợp'}, chốt deal.`,
      type: 'sales-lead',
      priority: 'high',
      status: 'todo',
      fileHint: '',
      errorLog: '',
      fixResult: null,
      images: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await fs.mkdir(path.join(KANBAN_DIR, cardId), { recursive: true });
      await fs.writeFile(path.join(KANBAN_DIR, cardId, 'card.json'), JSON.stringify(card, null, 2));
    } catch (e) { console.warn('[leads] kanban write fail:', String(e).slice(0, 100)); }

    // 2) Insert sales_leads
    const leadId = crypto.randomBytes(10).toString('hex');
    db.prepare(`INSERT INTO sales_leads
      (id, email, phone, store_name, plan_slug, source, note, user_agent, ip_hash, kanban_card_id, status)
      VALUES (?,?,?,?,?,?,?,?,?,?, 'new')`)
      .run(leadId, email, phone, storeName || null, planSlug || null, source, note || null, ua.slice(0, 500), ipHash, cardId);

    return NextResponse.json({
      ok: true,
      leadId,
      message: 'Đã nhận báo giá. Chuyên gia sẽ liên hệ trong 30 phút giờ hành chính.',
      zaloUrl: 'https://zalo.me/hieuduc87',
    });
  } catch (e) {
    console.error('[api] leads POST', e);
    return NextResponse.json({ error: (e as Error).message || 'Lỗi hệ thống, vui lòng thử lại' }, { status: 500 });
  }
}

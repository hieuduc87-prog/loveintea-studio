export const dynamic = 'force-dynamic';
/**
 * POST /api/admin/onboard — WIZARD 60S TẠO SHOP MỚI (founder-only).
 *
 * Gộp trong 1 lần call: (1) createStore → tạo brand + DB tenant per-brand (P3)
 * → (2) inviteToStore → tạo user admin+owner với password tạm → (3) set brand_quotas
 * theo gói chọn → (4) sinh welcomeMessage tiếng Việt để founder copy-paste vào
 * Zalo/Messenger gửi khách ngay (không cần email service).
 *
 * Body: { name: string, slug?: string, ownerEmail: string, plan?: 'trial-30d'|'pro'|'enterprise', logo_url?: string }
 * Return: { store: {id,slug,url}, owner: {email, tempPassword}, welcomeMessage }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createStore, inviteToStore } from '@/lib/provision';
import { requireAdminSession } from '@/lib/api-auth';
import { buildWelcomeMessage } from '@/lib/welcome-message';

// Định nghĩa các gói mặc định — founder có thể sửa sau trong /api/admin/quotas.
// Trial-30d: theo lệnh founder 2026-08-20 — 30 ngày / 30 ảnh (video+content scale theo).
const PLANS: Record<string, { videos: number; images: number; content: number; cap_usd: number; note: string }> = {
  'trial-30d': { videos: 3, images: 30, content: 25, cap_usd: 10, note: 'trial-30d' },
  'pro':       { videos: 20, images: 200, content: 500, cap_usd: 80, note: 'pro' },
  'enterprise':{ videos: -1, images: -1, content: -1, cap_usd: 500, note: 'enterprise' },
};

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession();
  if ('error' in auth) return auth.error;

  try {
    const body = await req.json() as {
      name?: string; slug?: string; ownerEmail?: string;
      plan?: string; logo_url?: string;
    };
    const name = (body.name || '').trim();
    const ownerEmail = (body.ownerEmail || '').trim().toLowerCase();
    const planKey = body.plan || 'trial-30d';
    const plan = PLANS[planKey];

    if (!name) return NextResponse.json({ error: 'Tên shop bắt buộc' }, { status: 400 });
    if (!ownerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) return NextResponse.json({ error: 'Email chủ shop không hợp lệ' }, { status: 400 });
    if (!plan) return NextResponse.json({ error: 'Gói không hợp lệ (trial-30d/pro/enterprise)' }, { status: 400 });

    // 1) Tạo brand + DB tenant + brand_dna row + settings (via lib/provision createStore)
    const { id, slug } = createStore({ name, slug: body.slug, logo_url: body.logo_url });

    // 2) Mời chủ shop làm admin+owner với password tạm
    const invite = inviteToStore({ email: ownerEmail, brandId: id, role: 'admin', memberRole: 'owner' });
    if (!invite.tempPassword) {
      // Trường hợp email đã tồn tại có password (Google-only cũ) → tempPassword không sinh.
      // Trả thông tin, welcome vẫn có nhưng KHÔNG có password (khách dùng Google login).
    }

    // 2b) AUTO-ADD partner co-founder (manhson) vào MỌI shop mới — theo lệnh founder 2026-08-20.
    // Bằng cách này manhson thấy tất cả store trong Platform Console + có admin quyền hỗ trợ khi
    // founder chính vắng. Idempotent (INSERT OR IGNORE) — không double-invite nếu chạy lại.
    // Không sinh tempPassword cho manhson (đã có tài khoản); không đưa vào welcomeMessage khách.
    try {
      const CO_FOUNDER_EMAILS = ['manhson.nguyen@gmail.com'];
      for (const coEmail of CO_FOUNDER_EMAILS) {
        if (coEmail.toLowerCase() === ownerEmail.toLowerCase()) continue; // ownerEmail trùng co-founder
        inviteToStore({ email: coEmail, brandId: id, role: 'admin', memberRole: 'member' });
      }
    } catch (e) { console.warn('[onboard] auto-add co-founder failed:', String(e).slice(0, 100)); }

    // 3) Set brand_quotas theo gói. Với trial: ghi thời hạn vào `note` để dashboard hiện.
    const db = getDb();
    const now = new Date();
    const expires = planKey === 'trial-30d' ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
    const noteText = expires ? `${plan.note} | expires_at=${expires.toISOString().slice(0, 10)}` : plan.note;
    db.prepare(`INSERT OR REPLACE INTO brand_quotas (brand_id, plan, videos, images, content, cap_usd, note, updated_at)
      VALUES (?,?,?,?,?,?,?, datetime('now'))`)
      .run(id, planKey, plan.videos, plan.images, plan.content, plan.cap_usd, noteText);

    // 4) Sinh welcome message
    const welcomeMessage = buildWelcomeMessage({
      storeName: name,
      slug,
      ownerEmail,
      tempPassword: invite.tempPassword ?? null, // null → helper render "Bạn đã có tài khoản trước…"
      planNote: plan.note,
      expiresAt: expires?.toISOString().slice(0, 10),
      scenario: 'new-shop',
    });

    return NextResponse.json({
      ok: true,
      store: { id, slug, name, url: `https://${slug}.easycreativehub.com` },
      owner: { email: ownerEmail, tempPassword: invite.tempPassword ?? null, created: invite.created },
      plan: { key: planKey, ...plan, expires_at: expires?.toISOString().slice(0, 10) ?? null },
      welcomeMessage,
    });
  } catch (e) {
    console.error('[api] admin/onboard', e);
    return NextResponse.json({ error: (e as Error).message || 'Không tạo được shop' }, { status: 400 });
  }
}

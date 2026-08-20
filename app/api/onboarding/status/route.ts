export const dynamic = 'force-dynamic';
/**
 * GET /api/onboarding/status — checklist 7 bước setup shop cho user hiện tại.
 *
 * Chấm điểm từ DB THẬT (không phải localStorage) → user chuyển máy/xoá cookie vẫn thấy
 * đúng tiến độ. Trả về steps[] có {id, title, done, cta_tab, hint}.
 *
 * Frontend: SetupProgressCard nổi bật ở top Dashboard khi có bước chưa xong; ẩn khi 7/7.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getDb } from '@/lib/db';
import { getBrandId } from '@/lib/brand-guard';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; email?: string; must_change_password?: number } | undefined;
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const brandId = getBrandId(req);
  if (!brandId) return NextResponse.json({ error: 'Chưa chọn brand' }, { status: 400 });

  const db = getDb();
  // Bước 1 — đổi mật khẩu (global auth_users)
  const usr = db.prepare('SELECT must_change_password FROM auth_users WHERE id=?').get(user.id) as { must_change_password: number } | undefined;
  const passwordChanged = !usr || usr.must_change_password === 0;

  // Các bước còn lại đọc từ tenant DB (getDb() resolve theo context brandId)
  const dna = db.prepare('SELECT tagline, voice_traits FROM brand_dna WHERE brand_id=?').get(brandId) as { tagline?: string; voice_traits?: string } | undefined;
  const dnaDone = !!(dna?.tagline && dna.tagline.trim());
  const voiceDone = !!(dna?.voice_traits && dna.voice_traits.trim() && dna.voice_traits !== '[]');

  const brandRow = db.prepare('SELECT logo_url FROM brands WHERE id=?').get(brandId) as { logo_url?: string } | undefined;
  const logoDone = !!(brandRow?.logo_url && brandRow.logo_url.trim());

  const productN = (db.prepare('SELECT COUNT(*) c FROM products WHERE brand_id=?').get(brandId) as { c: number }).c;
  const productHero = (db.prepare('SELECT COUNT(*) c FROM product_images WHERE brand_id=? AND is_hero=1').get(brandId) as { c: number }).c;

  const tplWithAnalysis = (db.prepare("SELECT COUNT(*) c FROM content_templates WHERE brand_id=? AND analysis IS NOT NULL AND analysis!=''").get(brandId) as { c: number }).c;

  const fbConnected = !!(db.prepare("SELECT 1 FROM channels WHERE brand_id=? AND platform='facebook' AND status='active'").get(brandId));

  const postN = (db.prepare("SELECT COUNT(*) c FROM posts WHERE brand_id=?").get(brandId) as { c: number }).c;

  const steps = [
    { id: 'password',   title: 'Đổi mật khẩu tạm',                  done: passwordChanged,   cta_tab: null,               hint: 'Bảo mật tài khoản của bạn.' },
    { id: 'dna',        title: 'Điền Brand DNA (tagline + giọng)',   done: dnaDone && voiceDone, cta_tab: 'brand_dna',    hint: 'AI viết đúng "chất" thương hiệu bạn — điền càng kỹ, mọi content sau càng chuẩn.' },
    { id: 'logo',       title: 'Upload logo thương hiệu',            done: logoDone,          cta_tab: 'brand_dna',        hint: 'Logo hiển thị ở header + dùng khi tạo ảnh marketing.' },
    { id: 'product',    title: `Thêm sản phẩm đầu tiên ${productN > 0 ? `(${productN})` : ''}`, done: productN > 0, cta_tab: 'products', hint: 'Điền tên + mô tả + ingredients — AI dùng để viết caption đúng.' },
    { id: 'hero',       title: 'Đánh ⭐ HERO cho mỗi sản phẩm',       done: productN > 0 && productHero >= productN, cta_tab: 'products', hint: 'Ảnh HERO = chuẩn vàng, AI bám 100% khi tạo ảnh mới, KHÔNG bịa bao bì.' },
    { id: 'template',   title: `Upload template mẫu ${tplWithAnalysis > 0 ? `(${tplWithAnalysis})` : ''}`, done: tplWithAnalysis > 0, cta_tab: 'content_templates', hint: 'Kéo-thả ảnh mẫu bạn thích → AI học phong cách + sinh ảnh của bạn.' },
    { id: 'channel',    title: 'Kết nối Facebook + Instagram',       done: fbConnected,       cta_tab: 'publisher',        hint: 'Đăng bài tự động thay vì copy-paste tay.' },
    { id: 'first_post', title: `Bài đầu tiên ${postN > 0 ? `(${postN} bài)` : ''}`, done: postN > 0, cta_tab: 'create_studio', hint: 'Tạo bài đầu tiên — nhanh nhất qua "Tạo Content" hoặc "Content Templates".' },
  ];

  const done = steps.filter(s => s.done).length;
  return NextResponse.json({
    total: steps.length,
    done,
    percent: Math.round(done / steps.length * 100),
    complete: done === steps.length,
    steps,
    brandId,
  });
}

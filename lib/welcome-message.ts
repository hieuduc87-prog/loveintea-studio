/**
 * Welcome message builder — dùng chung cho:
 *  - POST /api/admin/onboard (tạo shop mới)
 *  - POST /api/admin/stores/[brand]/members (invite member vào shop có sẵn)
 *  - POST /api/admin/stores/[brand]/members {action:'reset'} (user quên password)
 *
 * Founder copy tin nhắn này vào Zalo/Messenger gửi khách. Không cần email service.
 */
import { SHARE_FB_INSTRUCTIONS_VI } from './share-fb-instructions';

export interface WelcomeInput {
  storeName: string;
  slug: string;
  ownerEmail: string;
  tempPassword: string | null; // null nếu user đã có tài khoản cũ (không sinh temp)
  planNote?: string;
  expiresAt?: string;
  scenario?: 'new-shop' | 'invite-member' | 'reset-password';
}

export function buildWelcomeMessage(opts: WelcomeInput): string {
  const url = `https://${opts.slug}.easycreativehub.com`;
  const scenario = opts.scenario || 'new-shop';

  // Reset password: tin ngắn, chỉ URL + password mới + note đổi ngay
  if (scenario === 'reset-password') {
    return `🔑 Mật khẩu tạm MỚI cho ${opts.storeName}

Link: ${url}
Email: ${opts.ownerEmail}
Mật khẩu tạm: ${opts.tempPassword ?? '(dùng cũ hoặc Google Login)'}

Sau khi vào, hệ thống yêu cầu đổi lại mật khẩu mới.`;
  }

  // Invite member: tin trung — welcome ngắn, hướng dẫn login, nhắc wizard tự dẫn
  if (scenario === 'invite-member') {
    return `🎉 Bạn được mời vào shop ${opts.storeName} trên Easy Creative Hub!

Link: ${url}
Tài khoản: 📧 ${opts.ownerEmail}

Có 2 cách đăng nhập:
  ✨ Bấm "Đăng nhập bằng Google" với email trên (vào tức thì).
  🔑 Hoặc email + mật khẩu tạm: ${opts.tempPassword ?? '(dùng mật khẩu cũ nếu đã có tài khoản)'}

Sau khi vào, wizard 3 bước tự dẫn bạn setup. Bấm "?" ở mỗi màn để xem hướng dẫn, hoặc hỏi chatbot 💬 góc phải dưới.`;
  }

  // NEW SHOP: tin đầy đủ — giới thiệu + login + wizard + setup 15p + support + gói
  // Founder copy nguyên khối này paste Zalo/Messenger/Email cho khách mới hoàn toàn.
  const loginBlock = opts.tempPassword
    ? `🚪 CÁCH ĐĂNG NHẬP (chọn 1)

  ✨ CÁCH NHANH (khuyên dùng):
     Bấm nút "Đăng nhập bằng Google" trên trang login
     → Chọn tài khoản Google chính là ${opts.ownerEmail}
     → Vào tức thì, không cần mật khẩu.

  🔑 CÁCH THƯỜNG:
     Nhập ${opts.ownerEmail} + mật khẩu tạm: ${opts.tempPassword}
     → Hệ thống YÊU CẦU đổi mật khẩu ngay lần đầu.`
    : `🚪 ĐĂNG NHẬP

  Bấm "Đăng nhập bằng Google" trên trang login → chọn ${opts.ownerEmail}
  (Bạn đã có tài khoản trước đây, dùng luôn — hoặc mật khẩu cũ nếu nhớ.)`;

  const planBlock = opts.expiresAt && opts.planNote
    ? `📦 GÓI DÙNG THỬ (${opts.planNote}, hết hạn ${opts.expiresAt}):
   • 30 ảnh AI
   • 3 video Reel
   • 25 caption content
   • Trần chi phí $10 USD

Sau khi hết, bạn có thể nâng gói (Pro / Enterprise) hoặc tiếp tục dùng lượng miễn phí hàng tháng.`
    : '';

  return `🎉 Chào chị/anh,

Chào mừng ${opts.storeName} đến với Easy Creative Hub — nền tảng
AI + Đội ngũ chuyên gia marketing giúp shop bạn:
  • Chuyên gia MARKETING lên plan content tháng (không phó thác 100% cho AI)
  • AI thực thi caption + ảnh sản phẩm + video Reel theo plan
  • Đăng thẳng lên Facebook + Instagram theo lịch
  • Bạn duyệt qua Zalo — không cần thuê đội content riêng, không cần agency đắt

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 Link đăng nhập shop của bạn:
   ${url}

📧 Email tài khoản admin:
   ${opts.ownerEmail}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${loginBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📖 SAU KHI VÀO — Wizard 3 bước tự dẫn (~5 phút)

  1️⃣ Đổi mật khẩu (nếu chọn cách 2)
  2️⃣ Nhập "Chất thương hiệu" cơ bản:
       • Tagline: 1 câu mô tả bạn bán gì cho ai
         (vd "Trà thảo mộc cho người ngủ ngon")
       • Voice: 3-5 tính từ giọng thương hiệu
         (vd "ấm áp, chân thật, khoa học")
       → AI dựa vào 2 thông tin này để viết ĐÚNG giọng shop bạn
  3️⃣ Kết nối Facebook Page + Instagram
       → Chia sẻ Fanpage + IG cho Business Portfolio của ECH
         (làm 1 lần trên Meta Business Suite, dùng mãi, không hết hạn)
       → Hướng dẫn chi tiết có ảnh minh hoạ + FAQ:
         https://app.easycreativehub.com/help/share-fb-ig
       → Tóm tắt các bước cũng có ở phần "CHIA SẺ FB/IG" dưới cùng tin này

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 BƯỚC TIẾP THEO — Setup shop 15 phút

  📦 Vào menu Products → thêm sản phẩm:
     • Điền tên, mô tả, thành phần
     • Upload nhiều góc ảnh (mặt trước, nghiêng 45°, chi tiết)
     • ⭐ QUAN TRỌNG: đánh dấu 1 ảnh HERO (mặt trước chuẩn nhất)
       — AI sẽ bám ảnh này khi tạo mọi ảnh sau này

  🎨 Vào menu Content Templates → tải lên mẫu bạn thích:
     • Ảnh brand khác có phong cách bạn muốn học
     • Hệ thống TỰ phân tích bố cục ~8 giây (không cần bấm gì)
     • Sau đó bấm "Tạo post từ template" → AI sinh ảnh của bạn
       giữ phong cách mẫu nhưng CHỦ THỂ là sản phẩm bạn

  ✅ Vào Review & Queue → duyệt bài AI tạo → bấm "Post Now" đăng ngay
     hoặc "Đặt lịch" đăng theo giờ chọn

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🆘 VƯỚNG Ở ĐÂU?

  ❓ Ở MỖI MÀN HÌNH, có nút "?" ở góc trên
     → Bấm mở hướng dẫn chi tiết cho đúng màn đó

  💬 Ở GÓC PHẢI DƯỚI có nút chat tròn
     → Hỏi tiếng Việt tự do: "làm sao gen ảnh sản phẩm",
       "chèn chữ carousel thế nào", "FB không đăng được"
     → Trợ lý AI trả lời tức thì với các bước cụ thể

  🛎 Không giải quyết được?
     → Trong chatbot có nút "Tạo yêu cầu hỗ trợ"
     → Đội kỹ thuật sẽ xem và phản hồi trong 24h

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${planBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${SHARE_FB_INSTRUCTIONS_VI}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Chúc ${opts.storeName} có những campaign đầu tiên thành công 🌱

Mọi thắc mắc gấp, chị/anh nhắn lại tin này — tôi hỗ trợ trực tiếp.

Trân trọng,
Founder Easy Creative Hub`;
}

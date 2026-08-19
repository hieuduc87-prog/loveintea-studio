/**
 * Welcome message builder — dùng chung cho:
 *  - POST /api/admin/onboard (tạo shop mới)
 *  - POST /api/admin/stores/[brand]/members (invite member vào shop có sẵn)
 *  - POST /api/admin/stores/[brand]/members {action:'reset'} (user quên password)
 *
 * Founder copy tin nhắn này vào Zalo/Messenger gửi khách. Không cần email service.
 */

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

  const header = scenario === 'reset-password'
    ? `🔑 Mật khẩu tạm MỚI cho ${opts.storeName}`
    : scenario === 'invite-member'
      ? `🎉 Bạn được mời vào shop ${opts.storeName} trên Easy Creative Hub!`
      : `🎉 Chào mừng bạn đến với Easy Creative Hub!`;

  const shopLine = scenario === 'reset-password'
    ? `Link đăng nhập: ${url}`
    : `Shop của bạn: ${opts.storeName}\nLink đăng nhập: ${url}`;

  const loginOptions = opts.tempPassword
    ? `Tài khoản: 📧 ${opts.ownerEmail}

Có 2 cách đăng nhập, chọn 1:
  ✨ CÁCH NHANH — bấm "Đăng nhập bằng Google" trên trang login, chọn account Google
     chính là email này (${opts.ownerEmail}). Vào tức thì, không cần mật khẩu.
  🔑 CÁCH THƯỜNG — dùng email trên + mật khẩu tạm: ${opts.tempPassword}
     Hệ thống sẽ yêu cầu đổi mật khẩu ngay lần đầu.`
    : `Tài khoản: 📧 ${opts.ownerEmail}
Bạn đã có tài khoản trước đây — dùng mật khẩu cũ, hoặc bấm "Đăng nhập bằng Google"
với chính email này.`;

  const planLine = opts.expiresAt && opts.planNote
    ? `\n⏰ Gói ${opts.planNote} — hết hạn ngày ${opts.expiresAt}`
    : '';

  const footer = scenario === 'reset-password'
    ? `\nSau khi vào, hệ thống yêu cầu đổi lại mật khẩu mới của bạn.`
    : `\nSau khi vào: wizard 3 bước tự dẫn dắt bạn setup (đổi mật khẩu → Brand DNA cơ bản → kết nối FB/IG).
Bấm "?" ở góc mỗi màn hình để xem hướng dẫn nhanh, hoặc hỏi chatbot ở góc phải dưới.`;

  return [header, '', shopLine, '', loginOptions + planLine, footer].join('\n');
}

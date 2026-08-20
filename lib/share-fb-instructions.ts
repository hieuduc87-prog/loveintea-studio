/**
 * Hướng dẫn chuẩn cho khách CHIA SẺ QUYỀN Facebook Page + Instagram Business
 * cho Business Portfolio của Easy Creative Hub (thay thế flow OAuth cũ).
 *
 * Vì sao đổi (2026-08-20): OAuth login từng khách gặp CVE, token 60 ngày hết
 * hạn phải xin lại, khách không biết đường "Facebook Login for Business" mới
 * → chuyển sang Business Portfolio share: khách share 1 lần trên Meta Business
 * Suite, ECH có System User token never-expire, không phụ thuộc token khách.
 */

// ID Business Portfolio của Easy Creative Hub — khách sẽ nhập ID này khi share
// quyền Page/IG cho ECH trên Meta Business Suite.
export const ECH_BUSINESS_ID = '247211154665626';
export const ECH_BUSINESS_NAME = 'Easy Creative Hub';

/** Hướng dẫn khách share Page + IG cho ECH (dùng trong welcome message + wizard + docs). */
export const SHARE_FB_INSTRUCTIONS_VI = `🤝 CHIA SẺ FACEBOOK + INSTAGRAM CHO EASY CREATIVE HUB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Để hệ thống đăng bài tự động lên Fanpage + Instagram của shop, bạn share quyền
truy cập cho Business Portfolio của Easy Creative Hub. Làm 1 lần, dùng mãi mãi
(token không hết hạn, không phải xin lại).

📌 ID Business Portfolio của ECH:  ${ECH_BUSINESS_ID}
   (Copy ID này để dán vào bước dưới)

▸ BƯỚC 1 — Vào Meta Business Suite của bạn
   Mở https://business.facebook.com → chọn Business Portfolio của shop bạn
   (nếu chưa có Business Portfolio, bấm "Create a business account" tạo
   trước — miễn phí, 2 phút).

▸ BƯỚC 2 — Chia sẻ FANPAGE
   • Menu trái: Accounts → Pages → click Fanpage của shop bạn
   • Tab "Partners" hoặc "Assign Partners" → bấm "Assign partner"
   • Nhập Business ID: ${ECH_BUSINESS_ID} → "Continue"
   • Chọn các quyền (permissions):
       ✓ Create content
       ✓ Manage Page
       ✓ Send messages (Messenger)
       ✓ Access Page Insights
   • Bấm "Save changes"

▸ BƯỚC 3 — Chia sẻ INSTAGRAM
   • Menu trái: Accounts → Instagram accounts → click account IG của shop
   • Tab "Partners" → "Assign partner"
   • Nhập cùng Business ID: ${ECH_BUSINESS_ID}
   • Chọn quyền:
       ✓ Create content
       ✓ Access Insights
   • Bấm "Save changes"

▸ BƯỚC 4 — Báo cho Easy Creative Hub
   • Sau khi save xong, nhắn tin lại (Zalo/Messenger nơi bạn nhận link đăng nhập)
     với 2 thông tin:
       ① Tên Fanpage (vd "Oliva Pilates Studio")
       ② Tên IG account (vd "@olivapilates.vn")
   • ECH sẽ verify nhận được quyền trong ~2 phút và bật tính năng đăng bài
     tự động cho shop bạn.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❓ NẾU CHƯA CÓ INSTAGRAM BUSINESS
   • Vào app Instagram → Settings → Account → "Switch to Business account"
   • Kết nối với Fanpage Facebook của shop → xong.

❓ FANPAGE ĐÃ CÓ AI KHÁC QUẢN LÝ (agency cũ) → vẫn share song song được, không
   ảnh hưởng access hiện tại của họ.

❓ VƯỚNG Ở ĐÂU: bấm 💬 chatbot góc phải trong app hỏi "làm sao share FB cho ECH"
   hoặc chụp màn hình đang stuck gửi lại tin nhắn Zalo/Messenger.`;

/** Bản ngắn cho wizard modal — 4 bullet không header. */
export const SHARE_FB_SHORT_VI = `1. Mở https://business.facebook.com → chọn Business Portfolio của bạn
2. Accounts → Pages → chọn Fanpage → "Assign Partners" → nhập Business ID: ${ECH_BUSINESS_ID} → chọn quyền Create content + Manage Page + Send messages + Insights
3. Accounts → Instagram accounts → chọn IG → "Assign Partners" → cùng Business ID: ${ECH_BUSINESS_ID}
4. Xong → nhắn lại tên Fanpage + tên IG cho ECH qua Zalo/Messenger để bật tính năng đăng bài.`;

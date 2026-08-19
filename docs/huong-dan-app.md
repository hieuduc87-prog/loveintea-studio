# Hướng dẫn sử dụng Easy Creative Hub — TỔNG QUAN

Đây là tài liệu ngắn gọn cho chatbot trợ giúp — bám sát thao tác thật trong app.

## Đăng nhập lần đầu
1. Vào `https://<slug>.easycreativehub.com` (link admin gửi qua Zalo/Messenger).
2. Đăng nhập bằng email + mật khẩu tạm ĐÃ nhận.
3. Wizard 3 bước tự hiện: đổi mật khẩu → điền Brand DNA cơ bản (tagline + giọng nói) → kết nối Facebook (có thể bấm "Để sau").

## 1. Brand DNA (menu bên trái, mục "Brand DNA")
Nạp "chất" thương hiệu để AI viết đúng giọng. Điền càng kỹ càng chuẩn:
- **Tagline** (1 câu): bạn bán gì cho ai, vd "Trà thảo mộc cho người ngủ ngon".
- **Voice traits** (3-5 tính từ): giọng thương hiệu, vd "ấm áp, chân thật, khoa học".
- **Archetype / Through-line / Compliance**: chi tiết hơn cho AI hiểu văn hoá thương hiệu.
- Có nút "AI Extract DNA" — dán trang web/tài liệu bất kỳ, AI tự trích ra DNA gợi ý.

## 2. Products (menu "Sản phẩm")
- Bấm "+ Thêm sản phẩm" → điền tên, mô tả, ingredients, best moment.
- Upload nhiều ảnh sản phẩm (packshot mặt trước/45°/side/detail + lifestyle).
- **QUAN TRỌNG**: đánh dấu **1 ảnh HERO** (nút ⭐) cho mỗi sản phẩm — đây là ảnh chuẩn vàng mà mọi hệ thống AI tạo ảnh SẼ BÁM để không bịa bao bì. Không có hero → AI dễ vẽ nhầm.

## 3. Content Templates (menu "Content Templates")
Kho ảnh mẫu để AI học phong cách. 
- Bấm "+ Tạo template" → chọn kiểu (1 ảnh / Collection nhiều ảnh / Video) → upload ảnh.
- Sau upload, BẮT BUỘC bấm nút **"AI Analyze"** để Gemini đọc bố cục — nếu không, tạo post từ template sẽ bịa. Hệ thống chặn tạo post nếu template chưa Analyze.
- Từ template → bấm "Tạo post" → chọn sản phẩm → AI sinh 1-N ảnh có cùng phong cách template nhưng CHỦ THỂ là sản phẩm bạn chọn.

## 4. Tạo Content (menu "Tạo Content")
- Chọn sản phẩm → chọn ma trận O3 (persona × pain × RTB) → AI viết caption tiếng Việt/Anh.
- Có nút "Tạo ảnh" đi kèm — AI tạo ảnh sản phẩm dùng hero + prompt bạn nhập.

## 5. Chữ lên ảnh (menu "Chữ lên ảnh")
Chèn text lên ảnh có sẵn (single hoặc carousel 2-5 ảnh).
1. Upload/chọn ảnh nền.
2. Chọn kiểu layout (bottom-headline / top-banner / center-quote / benefit-list / promo-badge).
3. (Tuỳ chọn) chọn sản phẩm để bot bám nội dung sản phẩm.
4. Bấm "✨ Tự động chèn chữ" (AI viết + render) hoặc "Hoặc render tay" (bạn nhập tiêu đề/phụ đề/CTA).
5. Ảnh ra vào **Review & Queue** để duyệt trước khi đăng.

## 6. Video Studio (menu "Video Studio")
Tạo video 15-30s từ ảnh + lồng tiếng.
- Chọn sản phẩm + template → AI dựng storyboard.
- Voice: edge-tts nữ Việt (free) hoặc ElevenLabs (đẹp hơn).
- BGM: chọn từ thư viện hoặc dán link YouTube → hệ tự tách nhạc nền.
- Sau render 1-2 phút, video vào Review & Queue.

## 7. Reel Factory (menu "Reel Factory")
Tạo Reel 10s cho Instagram/TikTok — template `iced_summer` (loveintea) hoặc `product_universal` (mọi brand).
- Chọn sản phẩm → chọn template → chọn `videoType` (product/branding/educate/sale) → chọn số version.
- Mỗi version tốn tiền fal.ai (~$0.5-2.5/video) — kiểm tra hạn mức trước.

## 8. Review & Queue (menu "Review & Queue" trong "PUBLISH")
Duyệt mọi bài AI tạo trước khi đăng.
- Tab All/Draft/Scheduled/Published/Failed.
- Bấm bài để xem, sửa caption, đổi ảnh, chọn kênh (FB/IG) và lịch đăng.
- Nút "Post Now" đăng ngay, "Đặt lịch" đăng theo giờ chọn (giờ VN, hệ tự convert UTC).

## 9. Publisher / Channels (menu "Channels" + "Publisher")
- Kết nối Facebook Page + Instagram Business một lần → đăng tự động sau đó.
- Nếu chưa kết nối: bấm "Đăng nhập Facebook" → chọn Page → xong.
- Nếu token hết hạn: badge "chưa nối FB" xuất hiện trên store → click "Kết nối lại".

## 10. Analytics + Scoreboard (menu "Analytics" + "Scoreboard")
- Analytics: xem lượt reach/engagement/comments từng bài.
- Scoreboard: gom bài theo template, xếp SCALE/HOLD/RETIRE — biết template nào chạy tốt để làm nhiều.

## 11. Cost & P&L (chỉ admin)
Xem chi phí AI tiêu theo tháng, ước tính lãi/lỗ. Khách thường KHÔNG thấy mục này.

## Sự cố hay gặp
- **"Không login được"**: xoá cookie easycreativehub.com, thử lại; hoặc bấm "Đăng nhập bằng Google" nếu account gắn Gmail.
- **"AI tạo ảnh không giống sản phẩm"**: kiểm tra đã đánh HERO cho sản phẩm chưa (menu Products); template đã AI Analyze chưa.
- **"Không đăng được FB"**: token có thể hết hạn — vào Channels bấm "Kết nối lại".
- **"Video render fail"**: hết hạn mức tháng — admin nâng gói ở Platform Console.
- **"Chèn chữ carousel báo lỗi"**: cần ít nhất 2 ảnh, tối đa 5.

## Chatbot này chưa giải quyết được?
Bấm nút "🛎 Không giải quyết được — tạo yêu cầu hỗ trợ" bên dưới → đội kỹ thuật sẽ xem và phản hồi trong 24h. Trong lúc chờ, bạn có thể tiếp tục làm việc.

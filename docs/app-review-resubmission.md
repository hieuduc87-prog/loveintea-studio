# App Review Resubmission Kit — App 1267157968709745
**Submission cũ bị từ chối**: 26/3/2026 (submission_id 1267335605358648) — TẤT CẢ quyền fail vì 1 lý do: screencast không đạt. Use case được Meta xác nhận HỢP LỆ.

## Vì sao lần trước fail (root cause)
Reviewer tìm "quy trình đăng nhập Meta" trong video nhưng app dùng **System User token (server-to-server)** — không có màn hình login cho end-user. Feedback mục 5 yêu cầu: phải KHAI BÁO điều này trong submission. Lần trước không khai báo → fail cả 9 quyền.

## Chiến lược resubmit

### Nguyên tắc 1 — Xin ÍT quyền nhất có thể, chia đợt
Mỗi quyền = 1 video + 1 mô tả. Càng nhiều quyền càng dễ fail dây chuyền.
- **Đợt 1 (posting — cần cho LoveinTea Studio bán khách ngoài)**: `pages_show_list`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `pages_read_engagement` (metrics), `business_management`
- **Đợt 2 (sau khi đợt 1 đậu — cho HLT ads)**: `ads_read`, `ads_management`, `pages_manage_ads`, `leads_retrieval`, Marketing API Access Tier
- **BỎ khỏi draft hiện tại**: các quyền ads đang nằm trong draft "Chưa gửi" — đừng gộp chung đợt với posting. (KHÔNG xóa hẳn nếu HLT ads cần — chỉ tách đợt.)
- **Bỏ hẳn nếu không dùng**: `instagram_manage_messages` (chưa có tính năng reply IG DM trong app).

### Nguyên tắc 2 — Khai báo server-to-server NGAY ĐẦU ghi chú
Paste đoạn này vào ô "Chi tiết" / notes của MỖI quyền (đã viết sẵn tiếng Anh):

```
IMPORTANT — Server-to-server integration: This app is a marketing automation
platform (LoveinTea Studio — https://loveintea.wealthpsy.com). It accesses the
Meta API using Business Manager SYSTEM USER tokens (server-to-server). There is
NO Facebook Login flow shown to end users in the user interface — tokens are
provisioned by the business admin via Business Settings > System Users, as
documented in the screencast. Per your rejection feedback (item 5), we are
disclosing this explicitly so reviewers know the Meta login authentication flow
does not appear in the UI.
```

### Nguyên tắc 3 — Video đúng 5 yêu cầu của Meta
Yêu cầu của reviewer: (1) toàn bộ quy trình đăng nhập Meta — với app này thay bằng demo cấp token system user; (2) người dùng cấp quyền; (3) trải nghiệm toàn diện của use case; (4) UI tiếng Anh + chú thích từng nút; (5) khai báo system user.

## Shot list quay video (5-7 phút, UI ĐỔI SANG TIẾNG ANH, thêm text overlay chú thích)

1. **[0:00] Intro overlay**: "LoveinTea Studio — social content management for SME tea brand. Server-to-server via Business Manager System User token."
2. **[0:20] Token provisioning** (thay cho login flow): business.facebook.com → Business Settings → System Users → chỉ vào system user "autopost" → Assigned Assets (Page + App) → bấm Generate Token → tick các quyền đang xin → overlay: "Admin provisions a System User token — this replaces the end-user Meta Login flow".
3. **[1:30] Dán token vào app**: loveintea.wealthpsy.com → Channels → "Manual / System User token" → paste → bấm Verify & Save → overlay: "App verifies the token against Graph API before storing (AES-256-GCM encrypted)".
4. **[2:00] pages_show_list**: màn hình liệt kê pages sau khi dán user token → overlay "pages_show_list: list managed Pages so the admin selects which Page to connect".
5. **[2:30] pages_manage_posts**: Content Workshop → tạo caption + ảnh → Review & Queue → bấm Publish → mở fb.com/loveinteaoffical thấy bài vừa đăng → overlay "pages_manage_posts: publish the approved post to the connected Page".
6. **[3:30] instagram_basic + instagram_content_publish**: tương tự với IG — chọn platform Instagram → publish → mở instagram.com thấy bài → overlay từng quyền.
7. **[4:30] pages_read_engagement**: mở Dashboard / Analytics → chỉ vào reach/engagement metrics → overlay "pages_read_engagement: read Page post engagement to compute the content scoreboard".
8. **[5:00] business_management**: chỉ vào màn hình multi-brand (mỗi brand 1 Page) → overlay "business_management: resolve Pages/IG assets owned by the business across brands".
9. **[5:30] Kết**: quay lại Dashboard tổng quan → overlay "Full loop: create → publish → measure".

**Lưu ý kỹ thuật**: quay 1 video duy nhất rồi upload cho từng quyền đều được (Meta cho phép), miễn timestamp trong notes: "pages_manage_posts demo at 2:30".

## Việc cần làm TRƯỚC khi quay
1. **Giải quyết cảnh báo trạng thái tài khoản dev**: developers.facebook.com đang chặn tab mới bằng trang "lỗi trạng thái tài khoản nhà phát triển" + Hộp thư thông báo có 5 thông báo chưa đọc → mở đọc, làm theo yêu cầu (thường là xác minh danh tính/2FA). Không xử lý cái này thì resubmit xong cũng có thể bị treo.
2. **Business Verification** (business_id 247211154665626): tab "Xác minh" trong sidebar — quyền Advanced Access yêu cầu business đã verify (GPKD/hóa đơn địa chỉ). Check trạng thái trước khi gửi.
3. Đổi ngôn ngữ UI app + Business Settings sang English khi quay.
4. IG phải được link vào page Loveintea Offical trước (xem MEMORY — 3 bước IG), nếu muốn xin instagram_* trong đợt 1. Nếu IG chưa sẵn sàng → đợt 1 chỉ xin 4 quyền pages_*, đợt 1.5 xin instagram_*.

## Trong lúc chờ review — kinh doanh KHÔNG cần đợi
Mô hình onboarding khách SME hiện tại (đã chạy được ngay, không cần App Review):
1. Khách add Business của mình làm Partner HOẶC mình nhận quyền quản lý Page của khách qua Business Manager
2. Gán Page khách cho system user "autopost" → Generate token
3. Dán token vào app (Channels → Manual token, chọn đúng brand của khách)
→ App Review chỉ cần khi muốn khách TỰ bấm "Connect with Facebook" không qua mình.

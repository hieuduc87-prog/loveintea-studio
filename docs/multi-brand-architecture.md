# 🏛️ QUY HOẠCH KIẾN TRÚC ĐA-BRAND — Easy Creative Hub
> Bản thiết kế hệ thống, không phải danh sách vá lỗi. Mọi kết luận dựa trên audit thật ngày 29/07/2026 (số liệu ở Phần 2).
> Nguyên tắc chủ đạo: **một khách hàng không bao giờ chạm được — và không bao giờ ghi đè được — dữ liệu của khách khác, kể cả khi code có bug.**

---

## PHẦN 1 — VÌ SAO PHẢI QUY HOẠCH LẠI (chẩn đoán gốc)

3 ngày qua có 6 sự cố tenant, **tất cả cùng một mẫu**: hệ thống được sinh ra là **single-tenant (chỉ LoveinTea)** rồi *bồi thêm* multi-tenant. Mỗi chỗ bồi thiếu là một lỗ:

| Sự cố | Biểu hiện với khách | Cơ chế gốc |
|---|---|---|
| Tri thức Gossby rơi vào LoveinTea | nhập xong không thấy đâu | tenant key **có giá trị mặc định** |
| Brand voice dùng chung | upload brand này đè brand kia | dữ liệu nằm ở **key-value không mang tenant** |
| Sản phẩm "không tạo được" | trắng màn hình | màn hình chưa từng chạy với **tenant rỗng** |
| **Token Facebook bị đè** | **đăng bài lên page khách khác** | **luồng OAuth ghi credential toàn cục** |
| Kho ảnh / blog dùng chung (21/07) | thấy ảnh brand khác | bảng thiếu cột tenant |
| Chi phí AI không tách được | không biết khách nào tiêu bao nhiêu | API key **global**, ledger không gắn tenant |

**Kết luận chẩn đoán**: vấn đề không nằm ở 6 chỗ đó, mà ở chỗ hệ thống **cho phép tồn tại thao tác không có chủ**. Chừng nào còn "mặc định về LoveinTea", còn "settings toàn cục", còn "thư mục dùng chung" — thì mỗi tính năng mới lại đẻ ra một lỗ mới. Vá lẻ là đuổi theo triệu chứng.

---

## PHẦN 2 — HIỆN TRẠNG ĐO ĐƯỢC (audit 29/07)

**Đã cách ly đúng** (37 bảng có `brand_id`): posts, products, knowledge_docs, brand_dna, assets, content_templates, video_projects, jobs, image_library, blog_posts, brand_members, brand_fonts…

**Chưa cách ly / rủi ro còn lại:**

| Hạng mục | Hiện trạng | Rủi ro |
|---|---|---|
| `settings` (key-value) | 8 dòng, key toàn cục | 🔴 đã gây 2 sự cố (voice, FB token) |
| `image_jobs` (34 dòng) | không có brand_id | 🟠 lịch sử gen ảnh trộn lẫn |
| `publish_log` (293) | không có brand_id (truy qua post_id) | 🟡 thống kê per-brand phải JOIN |
| Thư mục `data/images/` | **mọi brand chung 1 thư mục** | 🟠 xoá/backup/quota per-brand không làm được |
| `data/video-cache/` | cache theo hash, dùng chung | 🟡 brand này hưởng cache brand kia |
| `FAL_KEY / OPENAI / GEMINI` | **env global** | 🔴 không tính được chi phí per-brand → không thu tiền khách được (bài học **H7 dlsamz**) |
| `getBrandId()` | **có fallback mặc định** cho admin | 🔴 nguồn gốc mọi vụ ghi nhầm |
| Auth users / brands / payment | global | ✅ đúng thiết kế (platform-level) |

---

## PHẦN 3 — HIẾN PHÁP (5 nguyên tắc bất di bất dịch)

**NT1 — Mọi dữ liệu có đúng một trong ba nhãn.**
`PLATFORM` (users, brands, payment, cấu hình hệ) · `TENANT` (mọi thứ khách tạo ra) · `SHARED-INFRA` (cache, model, hạ tầng — không chứa nội dung khách).
Dữ liệu chưa được gán nhãn thì **không được phép tồn tại**.

**NT2 — Không có tenant mặc định.**
Thao tác GHI mà không xác định được chủ → **từ chối và báo lỗi**, tuyệt đối không đoán. (Đây là gốc của 4/6 sự cố.)

**NT3 — Credential của khách thuộc về khách.**
Token FB/IG/Google… lưu per-brand, mã hoá. Không brand nào được rơi về credential toàn cục. Khách chưa nối kênh → chức năng đăng bài **báo lỗi rõ**, không âm thầm dùng kênh người khác (luật H7).

**NT4 — Đường dẫn vật lý mang tên tenant.**
File của khách nằm trong `…/<brandId>/…`. Nhờ đó: xoá khách = xoá thư mục; backup/khôi phục/tính dung lượng theo khách trở thành thao tác một dòng — thay vì bất khả thi như hiện nay.

**NT5 — Chi phí đi kèm chủ sở hữu.**
Mỗi lần gọi AI đều ghi `(brandId, model, số tiền)`. Không đo được thì không bán được, và không phát hiện được khách nào đang đốt tiền bất thường.

---

## PHẦN 4 — KIẾN TRÚC ĐÍCH (5 tầng cách ly)

```
         ┌──────────────── TẦNG 1: DANH TÍNH & QUYỀN ────────────────┐
         │ middleware: resolve tenant → header tin cậy (đã có)       │
         │ + NT2: không resolve được ⇒ 400, không mặc định           │
         └───────────────────────────┬───────────────────────────────┘
                                     │ brandId (bắt buộc, mọi request)
   ┌─────────────┬───────────────────┼───────────────────┬──────────────────┐
   ▼             ▼                   ▼                   ▼                  ▼
TẦNG 2: DỮ LIỆU  TẦNG 3: FILE     TẦNG 4: CREDENTIAL  TẦNG 5: CHI PHÍ   FLOW/JOB
platform.db      data/tenants/     channels(per-brand,  cost_ledger      job có brand_id,
tenants/<b>.db   <brandId>/{img,   AES-256-GCM)         (brand,model,$)  render/publish
(lộ trình P3)    video,library}    env chỉ chứa APP-key                  scope theo brand
```

**Về câu hỏi "DB riêng cho mỗi brand?" — trả lời thẳng:**
Đúng là cách ly mạnh nhất, và **nên là đích đến**, nhưng làm ngay lúc này là sai thời điểm: mọi truy vấn hiện tại đi qua một `getDb()` dùng chung; đổi một phát sang `getDb(brandId)` là đại phẫu toàn bộ mã nguồn trong khi khách đang chạy production. Cách chuyên nghiệp là **strangler pattern**: siết chặt bằng luật + guard trước (chặn ngay hôm nay), tách vật lý dần theo tầng dễ-đến-khó (file → credential → cost → DB). Khi tách DB, chỉ dữ liệu `TENANT` chuyển sang `tenants/<brandId>.db`; `PLATFORM` giữ ở `platform.db`.

---

## PHẦN 5 — LỘ TRÌNH 4 GIAI ĐOẠN (mỗi giai đoạn có tiêu chí nghiệm thu)

### P0 — CẦM MÁU (đã xong hôm nay)
- Chốt chặn brand ở tầng gọi API (bịt 94 điểm cùng lúc) · brand voice per-brand · **vá lỗ hổng đè token FB** · khôi phục brand voice gốc LoveinTea từ backup 09/07.
- *Nghiệm thu*: đã verify trên production — upload brand này không đụng brand kia.

### P1 — LUẬT HOÁ + GUARD TỰ ĐỘNG ✅ ĐÃ XONG 29/07
Mục tiêu: **lỗi cùng loại không thể lọt lần nữa**, kể cả người mới viết code.
1. **Bỏ tenant mặc định**: `getBrandId()` không còn trả về 'loveintea' cho thao tác GHI; thiếu tenant → 400 kèm thông báo.
2. **Guard CI — schema**: script chặn merge nếu có bảng mới thiếu `brand_id` mà không nằm trong allowlist `PLATFORM`.
3. **Guard CI — key-value**: cấm ghi `settings` bằng key không mang tenant (trừ allowlist hệ thống).
4. **Bộ test cách ly mở rộng**: hiện 30 case; bổ sung *ghi-đè chéo* (brand B ghi → brand A phải không đổi) với **dữ liệu thật ở cả hai phía** (luật H3 dlsamz).
5. **Kiểm thử tenant rỗng**: mọi màn hình phải chạy được với brand chưa có dữ liệu (luật G8).
- *Nghiệm thu*: cố tình viết 1 route sai tenant → CI chặn; test suite bắt được vụ brand voice nếu tái diễn.

### P2 — TÁCH VẬT LÝ FILE + CREDENTIAL ✅ ĐÃ XONG 29/07 (phần cốt lõi)
1. `data/tenants/<brandId>/{images,video,library,fonts}` — code đọc qua một hàm `tenantPath(brandId, …)` duy nhất; file cũ giữ nguyên (đọc 2 nơi), file mới ghi vào chỗ mới.
2. Route phục vụ ảnh kiểm tra quyền tenant thay vì public theo tên file.
3. Dọn `settings` FB legacy: LoveinTea chuyển hẳn sang `channels`; xoá đường rơi về credential toàn cục.
- *Nghiệm thu*: xoá một brand test = xoá đúng một thư mục; ảnh brand A không truy cập được bằng session brand B.

### P3 — CHI PHÍ THEO KHÁCH ✅ ĐÃ XONG · TÁCH DB 🟡 đã có backup/restore per-tenant, chuyển đường đọc-ghi để sau
1. `cost_ledger(brand_id, feature, model, usd, at)` — mọi call AI ghi sổ (Reel Machine đã có sẵn cơ chế, mở rộng cho ảnh/content).
2. Bảng điều khiển chi phí per-brand + hạn mức cảnh báo.
3. Tách DB: `platform.db` (users/brands/payment/settings hệ) + `tenants/<brandId>.db` (dữ liệu khách); `getDb(brandId)` thay `getDb()`; migration có kiểm chứng số dòng trước–sau.
- *Nghiệm thu*: backup/khôi phục **một khách** không đụng khách khác; báo cáo "brand X tiêu $Y tháng này" ra số.

### P4 — VẬN HÀNH THEO KHÁCH (liên tục)
Backup theo tenant · quota/hạn mức · nhật ký thao tác theo tenant · quy trình offboard (xuất dữ liệu + xoá sạch).

---

## PHẦN 6 — QUY TẮC CHO MỌI TÍNH NĂNG MỚI (checklist bắt buộc trước khi merge)
1. Dữ liệu tính năng này thuộc nhãn nào (PLATFORM/TENANT/SHARED-INFRA)?
2. Nếu TENANT: bảng có `brand_id` chưa? Đường dẫn file có `<brandId>` chưa? Truy vấn có lọc tenant chưa?
3. Có credential ngoài không? → lưu per-brand, mã hoá, không rơi về toàn cục.
4. Có gọi AI không? → ghi cost ledger kèm brandId.
5. Chạy thử với **brand trống** — không được trắng màn.
6. Thêm 1 case vào bộ test cách ly: brand B thao tác → brand A không đổi.

---

## PHẦN 7 — RỦI RO & CÁCH KIỂM SOÁT
| Rủi ro | Kiểm soát |
|---|---|
| Bỏ tenant mặc định làm vỡ luồng admin đang dùng | Bật theo cờ: giai đoạn đầu chỉ **cảnh báo + log**, sau 1 tuần sạch log mới chuyển sang chặn cứng |
| Đổi đường dẫn file làm mất ảnh cũ | Đọc 2 nơi (mới trước, cũ sau), chỉ dọn khi đã hết truy cập vào chỗ cũ |
| Tách DB làm mất dữ liệu | Migration đối chiếu số dòng từng bảng trước–sau, giữ bản gốc read-only 30 ngày |
| Backup quá thưa (hiện chỉ 14–15/07) | P1 bổ sung backup hằng ngày + kiểm tra khôi phục thử hàng tháng |

---

## PHẦN 8 — VIỆC CẦN FOUNDER QUYẾT
1. **Ưu tiên P1 ngay hay đợi?** (khuyến nghị: làm ngay — rẻ nhất, chặn được cả lớp lỗi).
2. **API key AI**: mỗi khách tự nối tài khoản (họ trả tiền trực tiếp) hay dùng key nền tảng rồi tính tiền lại qua cost ledger? Quyết định này định hình P3.
3. **Cam kết với khách**: có hứa cách ly dữ liệu ở mức hợp đồng không? Nếu có → P3 (DB riêng) là bắt buộc, không phải tuỳ chọn.

---

## PHẦN 9 — ĐÃ THỰC THI (29/07/2026, verify trên production)

| Hạng mục | Trạng thái | Bằng chứng |
|---|---|---|
| Chặn ghi không rõ brand | ✅ | ghi không brand → 400; có brand → chạy; đọc không bị chặn nhầm |
| Guard CI `npm run check:tenant` | ✅ | thêm bảng vi phạm → guard bắt; hoàn nguyên → sạch (258 file) |
| Backup + restore theo brand | ✅ | diễn tập: xoá sạch dữ liệu gossby → restore riêng gossby về đủ, loveintea nguyên vẹn; cron hằng ngày, giữ 14 ngày |
| Vá lỗ hổng đè token FB | ✅ | credential vào `channels` per-brand (mã hoá); settings chỉ mirror legacy |
| Brand voice per-brand + khôi phục bản gốc | ✅ | loveintea 2.301 ký tự (bản 09/07 từ backup); gossby 3.824 — độc lập |
| File theo khách `data/tenants/<brand>/` | ✅ cốt lõi | upload ảnh SP + video/thumbnail Reel ghi vào thư mục khách; `/api/images` đọc 2 nơi nên link cũ không gãy (verify HTTP 200) |
| Sổ chi phí theo khách | ✅ | bảng `cost_ledger` + API `/api/cost/brands`; fal/openai tự ghi kèm mã video |
| Tách DB đọc-ghi trực tiếp | 🟡 để sau | mục tiêu backup an toàn ĐÃ đạt bằng export/restore per-tenant; chuyển `getDb()` → `getDb(brandId)` là đại phẫu, chỉ làm khi số brand tăng hoặc có cam kết hợp đồng |

**Còn nợ (ưu tiên giảm dần)**: di dời file cũ trong `data/images/` về thư mục từng khách (hiện đọc 2 nơi nên không gấp) · hạn mức dung lượng + cảnh báo chi phí · gắn `check:tenant` vào CI của repo · bảng điều khiển chi phí trong UI.

---
*Audit gốc + số liệu: phiên 29/07/2026. Bài học liên quan: `kinh-nghiem-code-chung/laws/LUAT-TONG-QUAT.md` — H3, H7, G7, G8, G9.*

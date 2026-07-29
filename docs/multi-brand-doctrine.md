# HỌC THUYẾT ĐA-BRAND — tổng kết mọi sự cố bằng quy nạp, tái cấu trúc bằng diễn dịch
> Viết 29/07/2026 sau chuỗi ~20 sự cố cách ly tenant. File này là BÀI HỌC + LUẬT,
> không phải trạng thái hệ thống (trạng thái xem `multi-brand-architecture.md` Part 9).

## PHẦN 1 — QUY NẠP: từ 20 sự cố riêng lẻ rút ra 6 định luật

Liệt kê sự cố theo thứ tự thời gian, mỗi cái một dòng, rồi gom cụm:

| # | Sự cố | Lớp |
|---|---|---|
| 1 | brand_voice ghi key `settings` toàn cục → Gossby đè LoveinTea | DB |
| 2 | Token FB OAuth ghi settings chung → connect brand B đè kênh brand A | DB |
| 3 | `image_library`, `blog_posts` không có cột brand_id → mọi store thấy chung | DB |
| 4 | `image_jobs`, `publish_log`, `subscriptions` không có chủ | DB |
| 5 | `getBrandId` thiếu brand → trả `'loveintea'` "cho dashboard cũ chạy" | API |
| 6 | 62 chỗ code `\|\| 'loveintea'` — mỗi chỗ một cái van xả sang loveintea | API |
| 7 | Middleware chỉ validate `?brand=` query, KHÔNG validate brandId trong PATH/BODY | API |
| 8 | Sub-route `[id]/mindmap` không thừa kế guard của `[id]/route.ts` | API |
| 9 | 7 route đọc-theo-ID không lọc brand (audit 124 route ngày 21/07) | API |
| 10 | Mọi ảnh đổ chung `data/images/`, tên file đoán được trên endpoint public | File |
| 11 | Backup toàn-hệ duy nhất → khôi phục 1 khách là đè mọi khách | File |
| 12 | AppShell khởi tạo brand cứng `'loveintea'` → F5 nhảy store mà admin không biết | UI |
| 13 | Preview kênh cứng "Loveintea Offical" + handle `loveintea.official` | UI |
| 14 | User scope brand khác crash cả cây React vì fetch nhầm `?brand=loveintea` → 403 | UI |
| 15 | Phân loại ảnh cứng "(trà/thảo mộc)"; shot-list cứng "lá trà, tách, thìa" | AI |
| 16 | Phân tích template lưu NGUYÊN VĂN thương hiệu gốc → prompt ra lệnh vẽ lại bao bì hãng khác | AI |
| 17 | Khoá `photo` của "Nước pha thành phẩm" TRÙNG giá trị mặc định upload → 7 ảnh chưa phân loại hiện "7/2 đủ" | AI |
| 18 | Không hạn mức: 1 khách trả 199$ có thể đốt 270$/tháng AI mà không ai biết | Tiền |
| 19 | Chi phí (giá vốn) hiện cho tenant xem | Tiền |
| 20 | Guard viết xong không test → luật 4 nằm SAU khối exit, bắt được mà không chặn (29/07) | Guard |

**Quy nạp — 6 định luật (mỗi luật phủ nhiều sự cố, không luật nào phủ một):**

- **L1 — KHÔNG DEFAULT TENANT.** (sự cố 5, 6, 12, 13) Mọi giá trị mặc định mang tên
  một tenant thật là một rò rỉ chưa nổ. Thiếu brand phải fail RỖNG (đọc) hoặc 400
  (ghi) — hệ thống không bao giờ đoán hộ người dùng đang ở store nào.
- **L2 — MỌI DỮ LIỆU PHẢI CÓ CHỦ TỪ LÚC SINH RA.** (1, 2, 3, 4, 10, 11) Bảng không
  brand_id, key settings toàn cục, file trong thư mục chung, backup cả chùm — tất cả
  cùng một bệnh: "dữ liệu vô chủ". Chủ phải nằm TRONG schema/đường dẫn, không nằm
  trong quy ước.
- **L3 — TIN Ở LỚP NÀO, VALIDATE Ở LỚP ĐÓ.** (7, 8, 9) Brand đến từ query, PATH,
  BODY, header — mỗi cửa phải tự soát. Guard của route cha không bảo vệ route con;
  middleware không bảo vệ tham số nó không đọc.
- **L4 — DẪN XUẤT TỪ DỮ LIỆU TENANT MANG DANH TÍNH TENANT.** (15, 16, 17) Phân tích
  AI, prompt, nhãn, mô tả sinh từ nội dung một brand đều nhiễm danh tính brand đó
  (tên hãng, màu, ngành hàng). Dùng lại cho brand khác phải TẨY (strip/bóc nhãn)
  hoặc hạ cấp thành cấu trúc thuần (bố cục, không nội dung).
- **L5 — TIỀN PHẢI CÓ ĐỒNG HỒ THEO TENANT, VÀ GIÁ VỐN LÀ BÍ MẬT.** (18, 19) Mọi
  đường tiêu tiền cần: ghi sổ theo brand + hạn mức đặt-chỗ-trước + trần chi tiêu.
  Khách chỉ thấy SỐ LƯỢNG, không bao giờ thấy USD.
- **L6 — GUARD CHƯA TEST BẰNG VI PHẠM CỐ Ý = ẢO GIÁC AN TOÀN.** (20) Chính guard
  chống default-tenant hôm nay cũng viết sai lần đầu (đặt sau khối exit). Chỉ khi
  cắm vi phạm cố ý mới lộ. Mọi guard mới: PASS trên code sạch + FAIL trên vi phạm
  + PASS lại sau khi gỡ — đủ 3 bước mới tính.

**Meta-quy nạp — vì sao 20 sự cố cùng xảy ra:** hệ thống sinh ra đơn-tenant rồi
đắp đa-tenant lên sau. Mỗi sự cố là một chỗ giả định cũ ("cả hệ là loveintea")
còn sót. Suy ra hệ quả quan trọng nhất: **không thể vá hết bằng cách đợi lỗi nổi
lên — phải quét theo LỚP (schema, route, file, UI, AI, tiền) và xây guard chặn cả
lớp**, vì lỗi cùng lớp có cùng hình dạng.

## PHẦN 2 — DIỄN DỊCH: từ một nguyên lý duy nhất suy ra toàn bộ kiến trúc

**Tiên đề:** *Một thao tác không xác định được chủ (brand) thì không được phép
xảy ra — và điều đó phải do MÁY cưỡng chế, không do người nhớ.*

Diễn dịch xuống từng lớp:

1. **Schema** ⇒ mọi bảng tenant có `brand_id` (guard luật 1 chặn bảng mới thiếu);
   bảng platform phải khai báo TƯỜNG MINH trong `PLATFORM_TABLES` kèm lý do.
2. **API** ⇒ brand chỉ lấy từ header trung gian (`x-brand-id` do middleware phát
   sau khi soát quyền); thiếu brand: đọc → rỗng, ghi → `requireBrand()` 400;
   middleware chặn ghi-không-brand của admin (NT2); brandId trong PATH/BODY phải
   qua `canAccessBrand`/`assertResourceBrand`.
3. **File** ⇒ ghi mới vào `data/tenants/<brand>/<loại>/`, đọc dual-read; tên file
   chứa random không đoán được; backup THEO TỪNG BRAND (`tenant-db.mjs export-all`),
   diễn tập khôi phục 1 brand không đụng brand khác (đã pass 29/07).
4. **UI** ⇒ không placeholder mang tên store; view chỉ mount sau `brandsLoaded`;
   store đang xem ghi nhớ tường minh (localStorage, tiến tới: store trong URL);
   fetch guard tự gắn `?brand=`; mọi nút ghi nên hiện tên store.
5. **AI/prompt** ⇒ bối cảnh sản phẩm/ngành hàng TRUYỀN VÀO prompt (không viết cứng
   ngành); dẫn xuất từ template/nội dung brand khác phải strip tên riêng, hạ thành
   bố cục; lệnh người dùng tuyên bố ưu tiên cao nhất.
6. **Tiền** ⇒ `cost_ledger` ghi mọi call theo brand; `brand_quotas` + `usage_counters`
   đặt chỗ TRƯỚC khi làm, hoàn khi hỏng; trần `cap_usd` là lưới cuối bắt cả đường
   chưa gắn cổng; API giá vốn 403 với tenant.
7. **Guard/CI** ⇒ `tenant-guard-check` 4 luật (bảng thiếu brand_id, settings key lạ,
   credential ghi chung, default-tenant literal) chạy trước deploy; guard mới phải
   qua nghi thức 3 bước của L6.

## PHẦN 3 — CHECKLIST khi thêm bất kỳ tính năng mới nào (dán vào PR)

- [ ] Bảng mới có `brand_id`? (hoặc khai báo PLATFORM kèm lý do)
- [ ] Route đọc brand từ `getBrandId(req)`, ghi có `requireBrand`/`assertResourceBrand`?
- [ ] File mới ghi qua `tenantFilePath()`?
- [ ] UI không hardcode tên/slug/ngành của bất kỳ store nào?
- [ ] Prompt AI nhận bối cảnh sản phẩm từ THAM SỐ, không từ chuỗi cứng?
- [ ] Đường tốn tiền có `reserveQuota` + `recordCost`?
- [ ] `npm run check:tenant` + `npm run test:security` pass?
- [ ] Nếu thêm guard: đã test FAIL bằng vi phạm cố ý chưa?

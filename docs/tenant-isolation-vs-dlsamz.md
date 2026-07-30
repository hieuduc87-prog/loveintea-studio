# Đối chiếu cơ chế cách ly brand: loveintea-studio vs dlsamz (31/07/2026)

> Founder yêu cầu: đọc cơ chế độc lập brand của dlsamz (fork amz-pipeline thành SaaS
> đa-tenant — "bóc tách brand kỹ càng") và soi loveintea-studio còn thiếu gì.
> Nguồn đọc: `/Volumes/SSD/projects/dlsamz` (backend/lib/tenant-context.js,
> db-global.js, middleware/session-tenant.js, CLAUDE.md).

## Mô hình dlsamz (tóm tắt)

1. **DB-per-tenant (cách ly VẬT LÝ)**: mỗi brand một bộ file SQLite riêng
   `data/tenants/<brand>/{fba,app,bots,...}.db`. Query nghiệp vụ KHÔNG cần
   `WHERE brand_id` — mở nhầm brand là bất khả thi về cấu trúc, code cũ
   đơn-tenant dùng lại nguyên vẹn.
2. **AsyncLocalStorage tenant context**: middleware `session-tenant` resolve brand
   từ SESSION (JWT cookie + cookie active-tenant) rồi `runWithTenant(brandId, next)`
   — MỌI tầng dưới (route, helper, lib, worker) gọi `getXxxDb()` là tự mở đúng
   DB của brand trong ngữ cảnh, không truyền brandId bằng tay qua từng hàm.
3. **Global registry tối thiểu**: `global.db` chỉ có `tenants` + `memberships`
   (email↔brand↔role); mọi data nghiệp vụ nằm trong folder tenant.
4. **File per-tenant triệt để**: `tenantDataDir()` — asset/file nào cũng nằm trong
   folder brand; backup/restore/xoá 1 brand = thao tác 1 folder.
5. **Brand không bao giờ đến từ client param** cho user thường (chỉ session);
   slug validate chống path traversal (`^[a-z0-9][a-z0-9_-]{0,63}$`).

## loveintea-studio hiện tại

Shared `studio.db` + cột `brand_id` mọi bảng + brand-guard/middleware x-brand-id +
host-pin domain per-store, bù bằng: tenant-guard CI 4 luật, cross-tenant suite
30 case, quota + cost ledger per-brand, L4 (cách ly tầng AI/prompt/template),
channels AES per-brand, backup per-brand `tenant-db.mjs`.

## THIẾU SO VỚI DLSAMZ (gap thật)

| # | Gap | Hệ quả đã trả giá |
|---|---|---|
| G1 | Cách ly LOGIC (WHERE brand_id) thay vì VẬT LÝ (file riêng) | ~20 sự cố leak (doctrine Phần 1) — mỗi bảng/query mới là một nguy cơ; guard chỉ là cưỡng chế mềm |
| G2 | Không có tenant context xuyên suốt — `getBrandId(req)` phải gọi từng route, brandId truyền tay xuống lib (o3-engine, video, template-generate) | Đã từng quên truyền → route generate không knowledge/rules (0730G); mỗi hàm mới lại phải nhớ |
| G3 | Ảnh/asset vẫn nằm chung `data/images/` (chỉ tên random + serve public) — `data/tenants/<brand>/` mới phủ phần mới | Ảnh đoán tên từng leak (LIT-SEC-0721A); xoá/restore brand phải lọc từng bảng/file |
| G4 | Brand nhận từ `?brand=` (có validate quyền) cho admin đa-brand | Chấp nhận được vì middleware validate + host thắng query, nhưng rộng cửa hơn session-only của dlsamz |

## LOVEINTEA HƠN DLSAMZ (đem cho dlsamz dùng lại)

Quota/cost ledger per-brand (L5) · cross-tenant test suite + tenant-guard CI (L6)
· domain riêng từng store (host-pin, danh tính ở tầng TLS) · cách ly tầng AI:
prompt/template/ma trận/video-template per-brand (L4 — dlsamz chưa có tầng AI)
· Platform Console + provisioning.

## LỘ TRÌNH VÁ GAP (không đập đi xây lại)

- **P1 — ALS context (rẻ, đáng làm sớm)**: middleware đã có `x-brand-id` → bọc
  request trong `AsyncLocalStorage({brandId})`; `getBrandId()` bản không-cần-req
  cho lib sâu; các hàm o3-engine/video thôi truyền brandId bằng tay. Diệt cả lớp
  lỗi "quên truyền brand".
- **P2 — Ảnh per-tenant**: ghi mới vào `data/tenants/<brand>/images/`, route
  `/api/images` check file thuộc brand nào trước khi serve (dual-read ảnh cũ).
- **P3 — DB-per-tenant (cân nhắc khi >10 brand)**: tách các bảng nghiệp vụ nặng
  (posts, image_library, video_projects…) theo mô hình dlsamz `openTenantDb()`;
  bảng platform (auth, tenants, quotas) ở global.db. Làm theo từng cụm bảng,
  dual-read trong lúc chuyển. Hiện 4 brand + guard + suite đang giữ ổn — chưa cháy.

> Kết luận: loveintea không "thiếu đốt" về chức năng cách ly (đã qua 30/30
> cross-tenant + guard CI), nhưng dlsamz đúng là bóc tách **cấu trúc** sạch hơn
> ở tầng DB/file/context. P1+P2 nên làm; P3 là quyết định kiến trúc khi scale.

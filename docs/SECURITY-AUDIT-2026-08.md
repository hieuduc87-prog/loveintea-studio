# 🛡️ Security Audit — loveintea-studio / Easy Creative Hub (2026-08-10, LIT-SEC-0810A)

**Phương pháp:** 6 sub-agent quét 135 route + toàn bộ `lib/` theo 29 rule (OWASP-style) **+ pen-test thật vào prod** (unauth, path traversal, forge webhook, chéo tenant, JWT tamper, leo thang đặc quyền, rate-limit).

## Verdict
Kiến trúc lõi VỮNG (cách ly DB-per-tenant, brand-guard 403 chéo, crypto/password chuẩn, thanh toán 0 CRITICAL/HIGH). Lỗ hổng đều ở **route phụ/mới quên copy pattern** + vài lớp phòng thủ thiếu, không phải lỗi hệ thống. Đã vá **6 CRITICAL + 3 HIGH** (verify live). Còn HIGH/MEDIUM/LOW dưới (Wave 2).

---

## ✅ ĐÃ VÁ + VERIFY LIVE (Wave 1) — commit `5084543`

| ID | Severity | Lỗ | Fix | Verify prod |
|---|---|---|---|---|
| C1 | CRITICAL | `api/auth/facebook/start`+`callback` không kiểm session → attacker vô danh chạy OAuth bằng Page hắn, server ghi token vào settings global → chiếm kênh publish FB | `requireAdminSession()` cả 2 route | anon→401, editor→403 |
| C2 | CRITICAL | `api/kanban/claude-brief` đọc `?brand` client-controlled, mặc định dump card+error log MỌI brand | dùng `getBrandId` tin cậy + `isAllBrands` (như `/api/kanban`) | editor-gossby: 0 rò loveintea |
| C3 | CRITICAL | `api/inbox`(+sync) không gác + không vào brand context → PII Messenger; sync dùng FB page env (loveintea) | `requireAdminSession` + `getBrandId` | (dead endpoint, đã khoá) |
| C4 | CRITICAL | `api/video/projects/[id]/render` render fal.ai vô hạn, zero quota (cost-DoS) | `reserveQuota('video',1)` | build+deploy OK |
| C5 | CRITICAL | `api/video/recipe-batches/[id]/generate` tạo N video zero quota | `reserveQuota('video',versions)` + refund | build+deploy OK |
| C6 | CRITICAL | `next-auth 4.24.14` CVE (getToken uncaught exception) | nâng `4.24.15` | npm audit clean |
| H1 | HIGH | `/api/cost` GET rò COGS+P&L cho editor (khách); PUT sửa đơn giá vốn | gate `requireAdminSession` cả GET+PUT | editor→403 (was 200) |
| H4 | HIGH | `hub/assets/upload` path-traversal ghi file qua `brand_id` client (`../../..`) | bỏ fallback client, `isValidBrandSlug`, sanitize ext | build OK |
| MED | MEDIUM | Thiếu CSP header | thêm CSP (frame-ancestors/object-src/base-uri, script/style unsafe-inline để không vỡ Next) | header có |

**Hạ tầng (P0#5):** ổ đĩa prod đầy 100% (2 tarball ảnh 16.7G cùng-ổ) làm BUILD FAIL — đã xoá tarball (→58%) + **tắt tar ảnh cùng-ổ trong `backup.sh`** (DR vô giá trị + gây full ổ tái diễn). Ảnh cần backup OFFSITE (P0#1).

---

## ⏳ CHƯA VÁ (Wave 2) — cần làm để "chuẩn không thể bị tấn công"

### HIGH
- **H2 — `cap_usd` mù**: `lib/openai-image.ts` + `lib/gemini.ts` không gọi `recordCost` (chỉ `lib/video/fal.ts` ghi sổ) → trần chi phí không đếm tiền ảnh/text. *Fix: thêm recordCost sau mỗi call.*
- **H3 — ~10 route Gemini không rate-limit/quota**: `content/generate`, `text-overlay/auto`, `text-overlay/suggest`, `content-templates/*`, `brands/[id]/dna/extract`, `knowledge/classify`, `learn`. *Fix: enforceRateLimit + reserveQuota('content').*
- **H5 — 19 route trả nguyên `e.message`** ra client (lộ path DB tenant + schema). *Fix: message chung, log server. (2 route đã sửa kèm Wave 1.)*
- **H6 — 7 dependency CVE** (`npm audit`: xlsx, sharp, adm-zip, form-data, postcss, nanoid; next 14 chỉ dev-server CVE — prod chạy `next start` không dính, KHÔNG nâng major 16). *Fix: nâng bản vá non-major từng cái + test.*
- **H7 — flow-builder `[id]/claude-brief`+`image`** chéo brand (đọc workflow/ghi ảnh brand khác, zero guard). *Fix: getBrandId + assertResourceBrand.*
- **H8 — stored prompt-injection** qua ảnh mẫu template (vision output tái dùng làm ngữ cảnh "tin cậy" trong prompt sau). *Fix: đánh dấu untrusted, không cho điều khiển hành động.*

### MEDIUM
- HTML sanitizer regex tự viết (thay bằng thư viện chuẩn).
- `/api/knowledge?brandId=` đọc brand từ query thay vì `getBrandId` (hiện middleware backstop nhưng vi phạm nguyên tắc).
- 2 route serve-ảnh flow-builder/kanban thiếu guard.
- middleware prefix-match không neo path-segment (bẫy route tương lai).

### LOW
- `Math.random()` cho uploadId (`lib/chunk-upload.ts`) → CSPRNG.
- 2 route upload ảnh thiếu magic-byte verify.
- `fulfillOrder` SELECT-rồi-UPDATE chưa atomic (chỉ vỡ khi scale ngang) → `UPDATE ... WHERE status='pending'`.
- Dead code `verifyCassoToken` dùng `===` → xoá.

### Nghiệp vụ (không phải lỗ hổng)
- MoMo không fulfill subscription (`momo_payments` vs `bank_transfers` lệch bảng) → mất doanh thu.

---

## Vận hành bảo mật còn thiếu (SaaS chuẩn)
- **CI security gate** (`npm audit` + `/vbs-scan-security` chặn merge) — nay quét thủ công.
- **Secret manager** thay `.env` phẳng (đặc biệt `TOKEN_ENCRYPTION_KEY` không nằm cạnh data nó mã hoá).
- **Offsite backup** (P0#1) — ảnh + DB, không cùng ổ.
- **Watchdog health độc lập** + uptime alert.
- **Audit log per-tenant** (thao tác khách).
- **Rate-limit login** đã có trong code (agent xác nhận); live 15 lần chưa trip → cần verify ngưỡng thật.

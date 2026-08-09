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

## ✅ ĐÃ VÁ Wave 2 — commit `2c3073f` (LIT-SEC-0810B)

### HIGH (đã vá)
- **H2 — `cap_usd` mù** → ✅ `recordCost` cho gpt-image-2 (`lib/openai-image.ts` 3 điểm: gen/edit/mask) + Gemini text/vision (`lib/gemini.ts` 6 hàm) qua `currentBrandId()` (AsyncLocalStorage, không thread param).
- **H3 — 9 route Gemini không rate-limit** → ✅ `enforceRateLimit` (content/generate, text-overlay auto/suggest, tpl match/analyze/upload, dna/extract, knowledge/classify, learn). *Verify live: spam 25× content/generate → 5×429.*
- **H5 — route lộ `e.message`** → ✅ 6 điểm còn lộ đổi message chung + `console.error` server.
- **H6 — deps CVE** → ✅ `npm audit fix` non-major (form-data/nanoid/postcss/uuid). ⏳ **Deferred (cần kiểm thử)**: sharp (0.33→0.35 minor có thể breaking pipeline ảnh), next (14→16 major, CVE chỉ dev-server nên prod `next start` không dính), xlsx (SheetJS không vá qua npm), adm-zip. → nâng riêng + chạy lại cross-tenant 26/26.
- **H7 — flow-builder chéo brand** → ✅ `canAccessBrand(req, flow.brandId)` cho claude-brief + image + sanitize ext. *Verify live: editor-gossby đọc flow loveintea → 403.*

### MEDIUM (đã vá)
- ✅ `/api/knowledge` GET dùng `getBrandId` thay `?brandId` (đóng IDOR + fix bug trả rỗng prod).

### LOW (đã vá)
- ✅ `uploadId` → `crypto.randomUUID()` (CSPRNG).
- ✅ `fulfillOrder` `UPDATE ... WHERE status='pending'` (idempotent, chống double-fulfill khi scale ngang).
- ✅ Xoá dead code `verifyCassoToken` (dùng `===`).

## ⏳ CÒN LẠI (deferred — cần kiểm thử / kiến trúc, đã ghi nhận)
- **H8 stored prompt-injection** qua ảnh mẫu template — kiến trúc (vision output tái dùng làm ngữ cảnh tin cậy). Cần đánh dấu untrusted + không cho điều khiển hành động. CSP + gate hiện có giảm nhẹ.
- **MEDIUM sanitizer** HTML regex tự viết → thay `isomorphic-dompurify` (CSP `script-src` đã là backstop lớp cuối).
- **MEDIUM** 2 route serve-ảnh (flow-builder/kanban) thiếu brand-check — traversal ĐÃ chặn (`path.basename`); chéo brand cần đoán đúng id+filename (bất khả thi) → rủi ro thấp, hoãn.
- **MEDIUM** middleware prefix-match không neo path-segment (bẫy route tương lai, chưa exploit).
- **Deps major**: sharp/next/xlsx/adm-zip (xem H6).
- **Nghiệp vụ (không phải lỗ hổng)**: MoMo không fulfill subscription (`momo_payments` vs `bank_transfers` lệch bảng) → mất doanh thu.

---

## Vận hành bảo mật còn thiếu (SaaS chuẩn)
- **CI security gate** (`npm audit` + `/vbs-scan-security` chặn merge) — nay quét thủ công.
- **Secret manager** thay `.env` phẳng (đặc biệt `TOKEN_ENCRYPTION_KEY` không nằm cạnh data nó mã hoá).
- **Offsite backup** (P0#1) — ảnh + DB, không cùng ổ.
- **Watchdog health độc lập** + uptime alert.
- **Audit log per-tenant** (thao tác khách).
- **Rate-limit login** đã có trong code (agent xác nhận); live 15 lần chưa trip → cần verify ngưỡng thật.

# 🧭 PROJECT BRIEF — LoveinTea Studio / Easy Creative Hub (ĐỌC ĐẦU MỌI PHIÊN)
> Bản tổng 1-trang. Hook SessionStart tự bơm vào mọi phiên.
> Luật: mọi phiên trước khi kết thúc PHẢI cập nhật "Cập nhật gần nhất".

## Dự án là gì
Marketing OS SaaS đa-tenant (Strategy → Plan → Create → Publish → Measure → Learn) cho các brand F&B/DTC.
Stack: Next.js 14.2 App Router (standalone), SQLite better-sqlite3 (WAL, `data/studio.db`), NextAuth (Google + email/password), gpt-image-2, Gemini 2.5 (flash/flash-lite stable ONLY), edge-tts, sharp, yt-dlp.
Domain: **`<slug>.easycreativehub.com` = domain riêng TỪNG STORE** (middleware pin brand từ host — host thắng query, mâu thuẫn 409; wildcard CNAME + tunnel ingress đã cấu hình, store mới TỰ có domain). **app.** = sảnh chọn store (chọn brand ⇒ điều hướng sang domain store) + **admin.** (Platform Console) + landing. Store thật: loveintea / bazan / rootin / gossby. Token CF quản DNS zone này: `~/.cf_token_fleet`.

## Trạng thái vĩ mô (verify 2026-07-12)
- **Production = Hetzner 178.105.246.16**, Docker container `loveintea-app`, port 3202, data mount `/opt/loveintea/data/` (studio.db + images/). Mac launchd chỉ là standby, KHÔNG serve domain.
- Deploy flow (BẮT BUỘC sau mỗi thay đổi): `npx next build` → commit + push → SSH Hetzner: `cd /opt/loveintea/src && git stash; git pull && docker build -t loveintea-studio:latest . && docker stop loveintea-app && docker rm loveintea-app && docker run -d --name loveintea-app --env-file /opt/loveintea/.env -v /opt/loveintea/data:/app/data -p 3202:3202 --restart unless-stopped loveintea-studio:latest`
- Đã LIVE: multi-tenant isolation server-side (brand-guard, 403 chéo store), FB+IG publish (token per-brand AES-256-GCM trong `channels`), Video Studio v2 (karaoke caption, edge-tts nữ free, BGM library, lịch video định kỳ), text-on-image auto pipeline (reference-driven), Nguồn học (yt-dlp + Gemini analyze), security hardening 42/42 findings (vbsec Jul 9), Cost & P&L gate admin-only.
- Kanban tự-fix: card lưu FILE `data/kanban/<id>/card.json` (không phải DB) — user tạo card kèm screenshot để Claude đọc & làm.

## Việc kế tiếp (ưu tiên)
1. Video P2: 6-layer audio, LUT, SFX layer (blueprint: `docs/video-ai-pipeline-blueprint.md`) — Claude
2. Theo dõi Safe Browsing easycreativehub (đã hết cờ Jul 10; nếu tái phát → revert NEXTAUTH_URL về loveintea.wealthpsy.com) — founder + Claude

## Bẫy sống còn (đọc trước khi làm)
- **Middleware public routes**: matcher PHẢI exclude `api/auth`, `api/webhooks`, `api/images`, `api/payment/webhook`, `api/payment/momo-callback`, login, _next, brand, public — chặn nhầm = FB publish hỏng + payment không fulfill.
- **Posts schema**: cột `platforms` (PLURAL), `scheduled_at` lưu ISO UTC (container UTC — client phải toISOString(), gửi giờ VN là lệch 7h). PATCH dùng column allowlist.
- **Gemini** (cập nhật 2026-08-19): dùng aliases `gemini-flash-lite-latest` (primary, rẻ 3-6x) + `gemini-flash-latest` (fallback). KHÔNG hardcode version cụ thể — 2.0/2.5-flash đã bị Google phế cho account mới (chết 3 lần). Alias `-latest` tự chuyển stable, chống retire. Key format Google có thể đổi (từ `AIzaSy…` → `AQ.Ab8…`) — kiểm bằng call thật, KHÔNG validate bằng regex.
- **Cookie domain**: session + state/pkce/nonce/callback-url đều phải scope `.easycreativehub.com` (csrf giữ `__Host-`); thiếu = "State cookie was missing".
- **AppShell**: user scope brand ≠ loveintea phải chờ `brandsLoaded` gate — init brand hardcode → 403 → crash cả cây React.
- **Ảnh**: nằm `data/images/`, serve qua `/api/images/[filename]`; FB đăng `?w=4096&q=95` (guard <3.9MB).
- **initSchema chạy lazy** ở getDb() đầu tiên — check schema ngay sau boot sẽ thấy MISSING, chờ ~60s scheduler tick.
- Session song song `git add -A` có thể sweep file dở của nhau — check `git show HEAD:file` trước khi hoảng.

## Cập nhật gần nhất (phiên sau ghi đè, giữ ≤5 dòng)



































- [session 2026-08-20] `f1a020f` **GATE template chưa Analyze + backfill is_hero + fix Gemini retire** [LIT-FIX-0819B]: 4 card kanban (Nighty Night bịa lặp 3 lần + chèn chữ carousel + AI Analyze + video Hibiscus giống). Root cause thật: (a) Google phế `gemini-2.5-flash*` cho account mới — chẩn đoán trước "key chết" SAI, key luôn sống; (b) Template Carousel chưa AI Analyze → template-generate không biết role slide → gpt-image-2 vẽ hộp từ ảnh template + text ingredient "Perilla" → BỊA "LoveNoTea Perilla" thay Nighty Night; (c) 6/6 sản phẩm loveintea chưa có `is_hero=1` (luật founder 31/7 chưa thực thi). Fix hệ thống: (1) `lib/gemini.ts` đổi model → aliases `gemini-flash-lite-latest/latest` (Lite primary tiết kiệm 3-6x chi phí), key mới ở `.env` chmod 600; (2) GATE cứng `/api/content-templates/[id]/generate` → 400 `needs_analyze:true` nếu template chưa Analyze; (3) DB: backfill `is_hero=1` cho 6/6 sản phẩm loveintea; (4) Analyze 3 template chưa có. Verify prod: gen lại Nighty Night → hộp tím LoveinTea 100% đúng ref, ingredients flat lay perilla+chamomile+chà là+bạc hà, hook cô gái+eye mask+chai infuser. So sánh trời-đất với post bịa cũ. Bài học (CHRONICLE #33+#34): (a) đọc ERROR BODY đầy đủ, không đoán từ status code; kiểm key bằng behavior không regex. (b) silent-degrade > crash KHÔNG luôn đúng cho gen ảnh — GATE cứng tại nguồn tốt hơn. (c) quy tắc dữ liệu bắt buộc (is_hero) phải có backfill script, không chỉ comment. (d) verify bug lặp phải test ĐÚNG code path user báo. LOOP HỌC HỎI ghi CHRONICLE #33 (Google retire) + #34 (silent-degrade+verify-gate).
- [session 2026-08-19a] `6d59b22` fix(gemini) → aliases -latest + Lite primary tiết kiệm chi phí [LIT-FIX-0819]
- [session 2026-08-12] `de478f5` FIX GỐC P3: getDb() proxy bind lúc EXECUTE thay vì .prepare [LIT-FIX-0812A] — diệt lớp INSERT-mồ-côi-global
- [session 2026-08-10] 6 commit — hotfix DB binding + backup 3-2-1 + audit bảo mật 6 CRITICAL + 8 HIGH vá+verify-live
- [session 2026-07-30] 14 commit — fix(o3-engine) · fix(product-ref) · fix(template-gen) · fix(types) · perf(cost) · docs(brief) · feat(domain)
- [session 2026-07-30b] fix(o3-engine) L4: gỡ HẾT danh tính LoveinTea viết cứng trong caption/image/brief prompt — brand name+voice+compliance+hashtags+palette bơm từ brands/brand_dna, sản phẩm resolve DB-first theo brand_id; ma trận O3 tĩnh (SEGMENTS/RTBS/USP/NARRATIVES hook + bev lock + tag trắng) gate riêng loveintea, brand khác thay bằng dữ liệu sản phẩm; route generate lấy brand từ getBrandId, route image nhận sản phẩm DB (hết 400 Invalid SKU cho brand khác). Test tsx 12/12: gossby (mũ chó) ra đúng nội dung pet-gift, loveintea giữ nguyên bev lock/tag/palette [LIT-FIX-0730G]
- [session 2026-07-29] 17 commit — fix(kanban) · docs(brief) · feat(quota) · fix(orphan) · tools(disk) · SEC(cost) · docs(arch) · feat(tenant) · SEC(fb)
- [session 2026-07-29b] KHOÁ HẠN MỨC theo khách — `brand_quotas`+`usage_counters`, gác 4 route AI (reel ×versions, 2 route ảnh, plan ×số item), 2 lớp: hạn mức đơn vị + trần chi tiêu; `/api/usage` cho khách (CHỈ số lượng) · `/api/admin/quotas` nội bộ. Verified prod: videos=0 → 429, 0 USD tiêu; ảnh 1/1 → lần 2 chặn. Đã đặt: loveintea 20/200/500 trần $80; gossby+bazan+rootin trial 4/40/150 trần $20 [LIT-QUOTA-0729A]
- [session 2026-07-29b] Server: backup 5 dự án (KHÔNG phải git repo — code chỉ có trên server) về `/Volumes/SSD/backups/hetzner-2026-07-29/`, verify sha256 9/9. Xoá wealthpsy-core + behoctiengviet + calorvisor-web; tắt workshophoa (giữ file); giữ bigaicrm đang chạy. Vá dò ảnh mồ côi: quét MỌI file text trong `data/` thay vì chỉ kanban (test 679→678→679). Sửa disk-guard thu hồi 0B (thiếu `-a`, bỏ sót journal). Ổ 96%→86%.
- [session 2026-07-28] 15 commit — feat(reel) · fix(reel) · feat(autofix) · docs(brief)
- [session 2026-07-27] 16 commit — docs(brief) · fix(reel) · feat(reel) · docs(brief)+fix(reel) · test(security) · refactor(reel) · feat(video) · docs(video)

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














































- [session 2026-08-20] 20 commit — docs(brief) · feat(paywall-plans-v1) · feat(fb-connect-2ways) · feat(onboard) · feat(onboard-progress) · feat(welcome-full) · sec(platform-console) · feat(admin-dashboard) · feat(welcome)
- [session 2026-08-20f] 3 commit (`58a8c63`+`aa9a5cd`+`e6fedab`, **LIVE prod ✅**) **[LIT-FIX-0820N]**: User "CHECK FIX ĐI" + "BẤT KỲ LỖI NÀO CŨNG PHẢI FIX Ở CẤP HỆ THỐNG để brand khác về sau không dính lại". 6 card hoa-lang-thang bị kẹt auto_fix (routine tắt Jul 11) — trace từ code base (description trống), fix 5 root cause chung: (1) DELETE handler thiếu ở `/api/products/[id]` → add + brand-guard + cascade product_images. (2) 3 file hardcode `gemini-2.5-flash` bypass MODELS list (Google phế cho account mới): `lib/video/{analyze,recipe-workflow,analyze-reference}.ts` → đổi `gemini-flash-latest` (alias). (3) `fileToText` không parse PDF → install `pdf-parse@1.1.1` (v2 cần canvas browser fail Node) + `fileToTextAsync()` async version + BrandDnaView accept `.pdf`. Gotcha Next standalone tree-shake lazy require → `next.config.mjs`: `serverComponentsExternalPackages + outputFileTracingIncludes`. (4) 4K download frontend không append `?w=4096&q=95` → new `lib/image-url.ts` hdDownloadUrl helper, apply 5 view (ImageStudio/ContentWorkshop/ImageLibrary/Schedule/JobQueue), label đổi "Download 4K". (5) ImageStudio history chỉ giữ React state → useEffect load `/api/image-library?limit=12` khi mount, ảnh bền qua đổi tab. Verify prod 4 subdomain 200, pdf-parse CALL thật OK trong container, DELETE endpoint 307 (route tồn tại, không phải 405). 6 kanban card updated `fixed` với fixResult chi tiết. Áp cho MỌI brand hiện tại + brand mới. Luật mới: KHÔNG hardcode model LLM (dùng aliases), file parser centralize lib/ + async, download qua helper, history load từ API không dựa React state, Next standalone + lazy require phải config force include. CHRONICLE #39.
- [session 2026-08-20e] `9f39985` (18 files 1164+/-70, LIVE + E2E prod ✅) **[LIT-FEAT-0820M]**: 3 lệnh founder sáng — (a) OAuth "hiện tại đã có auth được đâu???" (bug thật: FB_REDIRECT_URI trỏ domain cũ wealthpsy, cookie domain khác + Dev Mode chưa App Review = khách thật fail); (b) rebrand USP "AI+chuyên gia không phải full ai"; (c) ẩn OAuth chỉ share Business + kèm hướng dẫn chi tiết + xây site paywall. **Ship**: (1) Rebrand USP toàn app landing/wizard/welcome/docs → "AI thực thi + Chuyên gia lên plan"; (2) Ẩn nút OAuth wizard, giữ code backend cho App Review sau; (3) Trang public MỚI `/help/share-fb-ig` — hero + so sánh cũ/mới + 4 Step có placeholder screenshot + FAQ 6 câu; (4) DB service_plans (7 gói: trial-social-30 free, combo featured, 5 gói contact) + sales_leads; (5) Public `/plans` SSR + `/plans/[slug]` detail + LeadForm; (6) PlansExitPopup (exit-intent+scroll-idle) + PricingBanner sticky top AppShell WARN≥80% quota; (7) POST `/api/leads` public rate-limit SHA1 IP+salt → tạo kanban card sales-lead brandId=__global__ priority=high + insert sales_leads. Verify prod: `/plans` 200, `/plans/combo-full-monthly` 200, `/help/share-fb-ig` 200, POST leads → 200 + card kanban thật + row sales_leads OK, 7 gói seed count đúng. Gotcha: docker build (không có --load) → image không load vào docker images local → docker run fail. Fix: `docker buildx build --load`. **Luật**: chưa App Review = CẤM lộ nút OAuth khách bấm được (trust erosion); giá gói placeholder text "Liên hệ báo giá" không bịa số; rate-limit public form dùng ip_hash SHA1 không lưu IP thật; kanban card sales-lead phải có `goal` action-oriented (không chỉ tả thông tin). Còn nợ: Admin UI CRUD service_plans + UpgradeModal cắm route 429 + screenshot thật /help + FB OAuth khôi phục khi App Review pass. CHRONICLE #38.
- [session 2026-08-20c] `713881a`+`c69d786` UX CAO CẤP: (1) AUTO-ANALYZE template sau upload — fire-and-forget Gemini ~8s, bug 3-lần-lặp 'quên bấm AI Analyze → gen bịa' CHẶN TẬN GỐC (verified E2E: template mới → 15s → analysis ✓ 3455 chars). (2) `ViewHelpButton` `?` per-view (Brand DNA/Products/Templates) → drawer 420px bên phải step-by-step + tip/warn + FAQ + link chatbot. LUẬT: bug lặp do user quên click → chuyển sang auto-chạy-ngầm thay vì GATE cứng; contextual help > global help (giữ user trong context). Chi tiết CHRONICLE #36.
- [session 2026-08-20d] `a372b21`+`b4c6554` **ADMIN CONSOLE PROFESSIONAL** [LIT-FEAT-0820H]: (1) Tab '📊 Overview' mặc định trong Platform Console — 5 widget (Shops 7/Users 11/Active 30d 6/Cost $41.52/Revenue 0/Profit -1M) + panel alerts + bảng per-shop 8 cột (Gói/Hết hạn/Cost 30d + %cap/Revenue 30d/Members/Alerts/Last activity). Route mới `GET /api/admin/dashboard` (admin-only) tính từ cost_ledger + bank_transfers + brand_quotas + usage_counters. Alerts server-side auto: trial ≤7d, usage ≥80%, cost vượt cap, chưa set gói. (2) Welcome message REUSE cho invite + reset password — extract lib/welcome-message.ts (3 scenario new-shop/invite-member/reset-password), route stores/[brand]/members trả welcomeMessage + storeUrl, UI PlatformConsole hiện welcome panel full-screen sau MỌI thao tác thêm/reset (không mất khi đóng). Data thật: 7 shop (WhiteLotus + Oliva Pilates founder tạo hôm nay). CHRONICLE #37. LUẬT: SaaS đa-brand phải có admin overview 1-màn thấy TẤT CẢ shop; cost_ledger + payments cần brand_id từ đầu; alerts tính SQL server-side (client bỏ lỡ khi tab đóng).
- [session 2026-08-20b] `d41cd46`+`c20b825`+`4ebd310` **ONBOARDING SAAS — VÒNG KÍN TỰ PHỤC VỤ 2 CHIỀU** [LIT-FEAT-0820]: founder LƯỜI, muốn giảm việc tối thiểu khi có khách mới. Đã ship 3/4 phase (P3 đã có sẵn). **P1 wizard founder 60s** — POST `/api/admin/onboard` gộp createStore+inviteToStore+setQuota+welcomeMessage; UI PlatformConsole form 3 field (name+slug+ownerEmail+gói) → panel welcome full-screen textarea + nút Copy toàn bộ tin nhắn tiếng Việt (paste Zalo/Messenger, không cần email service). Gói mặc định trial-30d (30 ảnh, 3 video, 25 content, trần \$10, expires 30 ngày). **P2 wizard khách 3 bước** — `OnboardingWizard.tsx` tự hiện khi must_change_password=1 hoặc brand_dna chưa có tagline: (1) đổi mật khẩu → (2) Brand DNA cơ bản → (3) kết nối FB. Skip mọi bước; localStorage mark khi xong. **P4 chatbot AI** — `HelpChatbot.tsx` nút '?' floating góc phải, `/api/help/ask` gọi Gemini với `docs/huong-dan-app.md` (150 dòng phủ 11 module) + `huong-dan-su-dung-video.md`. Prompt cấm bịa (chỉ trả từ tài liệu). Sau 2 câu chưa giải quyết → nút '🛎 escalate' tự tạo card kanban `type=support` với snapshot hội thoại → routine tick 1h/lần Claude Code fix. VÒNG KÍN: founder 60s → khách wizard tự dẫn → chatbot Q&A → escalate kanban → Claude Code fix — KHÔNG ai phải xử lý thủ công. Verify: POST /admin/onboard trả URL+tempPassword+welcomeMessage OK; chatbot trả 3/3 câu step-by-step chính xác (làm sao gen ảnh / template chưa Analyze / không đăng được FB); escalate tạo card OK. LUẬT: SaaS scale phải THIẾT KẾ CHUỖI TỰ PHỤC VỤ 2 CHIỀU — chiều founder ≤3 field, chiều khách wizard+guide+chatbot trước khi cho escalate; chatbot phải ĐƯỢC PHÉP nói "không biết" + tự đề xuất escalate (cấm bịa = mất niềm tin). CHRONICLE #35.
- [session 2026-08-19a] `6d59b22` fix(gemini) → aliases -latest + Lite primary tiết kiệm chi phí [LIT-FIX-0819]
- [session 2026-08-12] `de478f5` FIX GỐC P3: getDb() proxy bind lúc EXECUTE thay vì .prepare [LIT-FIX-0812A] — diệt lớp INSERT-mồ-côi-global
- [session 2026-08-10] 6 commit — hotfix DB binding + backup 3-2-1 + audit bảo mật 6 CRITICAL + 8 HIGH vá+verify-live
- [session 2026-07-30] 14 commit — fix(o3-engine) · fix(product-ref) · fix(template-gen) · fix(types) · perf(cost) · docs(brief) · feat(domain)
- [session 2026-07-30b] fix(o3-engine) L4: gỡ HẾT danh tính LoveinTea viết cứng trong caption/image/brief prompt — brand name+voice+compliance+hashtags+palette bơm từ brands/brand_dna, sản phẩm resolve DB-first theo brand_id; ma trận O3 tĩnh (SEGMENTS/RTBS/USP/NARRATIVES hook + bev lock + tag trắng) gate riêng loveintea, brand khác thay bằng dữ liệu sản phẩm; route generate lấy brand từ getBrandId, route image nhận sản phẩm DB (hết 400 Invalid SKU cho brand khác). Test tsx 12/12: gossby (mũ chó) ra đúng nội dung pet-gift, loveintea giữ nguyên bev lock/tag/palette [LIT-FIX-0730G]
- [session 2026-07-29] 17 commit — fix(kanban) · docs(brief) · feat(quota) · fix(orphan) · tools(disk) · SEC(cost) · docs(arch) · feat(tenant) · SEC(fb)
- [session 2026-07-29b] KHOÁ HẠN MỨC theo khách — `brand_quotas`+`usage_counters`, gác 4 route AI (reel ×versions, 2 route ảnh, plan ×số item), 2 lớp: hạn mức đơn vị + trần chi tiêu; `/api/usage` cho khách (CHỈ số lượng) · `/api/admin/quotas` nội bộ. Verified prod: videos=0 → 429, 0 USD tiêu; ảnh 1/1 → lần 2 chặn. Đã đặt: loveintea 20/200/500 trần $80; gossby+bazan+rootin trial 4/40/150 trần $20 [LIT-QUOTA-0729A]

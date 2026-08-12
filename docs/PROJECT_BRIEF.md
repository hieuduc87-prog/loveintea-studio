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
- **Gemini**: CHỈ `gemini-2.5-flash` / `gemini-2.5-flash-lite` — preview/2.0 đã chết 2 lần.
- **Cookie domain**: session + state/pkce/nonce/callback-url đều phải scope `.easycreativehub.com` (csrf giữ `__Host-`); thiếu = "State cookie was missing".
- **AppShell**: user scope brand ≠ loveintea phải chờ `brandsLoaded` gate — init brand hardcode → 403 → crash cả cây React.
- **Ảnh**: nằm `data/images/`, serve qua `/api/images/[filename]`; FB đăng `?w=4096&q=95` (guard <3.9MB).
- **initSchema chạy lazy** ở getDb() đầu tiên — check schema ngay sau boot sẽ thấy MISSING, chờ ~60s scheduler tick.
- Session song song `git add -A` có thể sweep file dở của nhau — check `git show HEAD:file` trước khi hoảng.

## Cập nhật gần nhất (phiên sau ghi đè, giữ ≤5 dòng)















































- [session 2026-08-10] 6 commit — docs(brief) · fix(docker) · docs(security) · sec(Wave2) · sec(P0)
- [session 2026-08-12] `de478f5` **FIX GỐC P3: getDb() proxy bind lúc EXECUTE thay vì .prepare** [LIT-FIX-0812A]: 2 card kanban. Blocker a93d659d (tạo Content Template không mở màn upload): root cause `getDb().prepare(INSERT).run(id, getBrandId(req),…)` — proxy bind DB lúc `.prepare` TRƯỚC khi getBrandId (trong .run args) vào context → INSERT rơi GLOBAL rỗng → GET tenant không thấy → UI kẹt. Tồn tại từ P3 split ~2 tuần (mọi create template rơi global, 12 orphan đã dọn). Fix hệ thống: `_dbProxy.prepare()` trả lazy statement, method exec resolve DB lúc GỌI + stmt-cache per-connection (599 prepare, 0 chaining → an toàn) ⇒ diệt CẢ LỚP "getDb trước getBrandId". Verify: create→tenant (global=0), list 54, panel mở, regression login/products OK. Card 90e3eca4 (Nighty Night gen sai packaging) = hệ quả DB bất ổn tuần này (ref lookup fail→bịa); gen lại→đúng 100%. BÀI HỌC: proxy resolve-theo-context phải bind lúc EXECUTE không phải SETUP; verify phải kiểm row LANDS đúng DB, không chỉ "API 200". CHRONICLE #32.
- [session 2026-08-10b] `6acf45c` HOTFIX DB chết toàn cục (better-sqlite3 binding mất) + backup 3-2-1 [LIT-HOTFIX-0810]: nhân viên báo không login = MỌI truy cập DB văng `Could not locate the bindings file`, KHÔNG mất data (file DB nguyên). Root cause: Dockerfile `npm rebuild better-sqlite3 2>/dev/null || true` nuốt lỗi + alpine thiếu build-tools (chỉ chạy nhờ cache); `docker builder prune` dọn ổ xoá cache → rebuild fail âm thầm → ship image thiếu `.node`. Fix: `apk add python3 make g++` + `--build-from-source && test -f .node` fail-loud. Backup dựng 3-2-1: live + backup.sh on-server + OFFSITE auto-pull Mac (launchd 19:30, integrity-check, 21d); thiếu offsite cloud (cần cred). CHRONICLE #31. LUẬT: đừng nuốt lỗi build sống còn; health-check deploy phải chạm endpoint ĐỌC DB.
- [session 2026-08-07] 2 commit — docs(brief) · fix(P3-colshift)
- [session 2026-08-05] 1 commit — fix(reel-QA)
- [session 2026-08-03] 2 commit — fix(scheduler) · fix(reel-render)
- [session 2026-08-01] 1 commit — fix(p3-context)
- [session 2026-07-31] 19 commit — fix(hero-ref) · fix(usage-lock) · fix(tenant-path) · docs(brief) · feat(tenant-db) · feat(mask-lock) · docs(tenant) · fix(product-ref) · fix(fidelity-gate)
- [session 2026-07-31e] **P3 DB-PER-TENANT LIVE** (mô hình dlsamz): mỗi brand 1 file `data/tenants/<brand>/studio.db` (40 bảng nghiệp vụ) + ATTACH global (18 bảng platform) — SQL cũ chạy nguyên; brand context = AsyncLocalStorage (brand-guard enterBrandContext, scheduler/provision runWithBrand), `getDb()` = proxy late-binding; auto-migration boot + 2 backup + bảng cũ `zz_legacy_*`; global giữ bảng tenant RỖNG (thiếu context → 404 fail-closed) + AUDIT cảnh báo dòng lạ; kill-switch `TENANT_DB_SPLIT=0`. Tiện thể fix bug đăng hẹn giờ gãy (publish_log 7 giá trị/8 cột). Test: suite 30/30 + write-test rơi đúng file tenant + E2E prod 4 brand (bazan caption Fine Robusta durian). LƯU Ý VẬN HÀNH: mọi script/tool mở file tenant PHẢI `pragma foreign_keys=OFF`; KHÔNG rm thư mục tenant khi app đang chạy (handle ma); backup = copy folder brand [LIT-P3-0731E]
- [session 2026-07-31d] (data-only) Bazan đủ dây cót: import 8 sản phẩm + 32 ảnh + DNA (voice/colors) từ DLS AutoMedia (`/Volumes/SSD/projects/BigAiAutoMediaPOD/data/dls_automedia.db`) vào prod, verified API 200; chạy lại pipeline Recipe Batch với clip AUTO POST thật (`/Volumes/SSD/donload/template ba zan/`) — Blueberry Iced Latte render 14.8s QA pass, frames verify mắt. Mac gotcha: brew reinstall ffmpeg (thiếu zscale → eq fallback, prod Alpine vẫn đúng màu), Puppeteer cần path Chrome [LIT-BAZ-0731D]
- [session 2026-07-31c] refactor(reel-engine) TÁCH TẦNG Reel Machine chuẩn SaaS: ENGINE (timeline/render/QA/cache) trung lập ngành — template iced_summer chuyển thành DATA riêng của loveintea (BRAND_SEED_TEMPLATES, brand khác không thấy/không mượn được); thêm template builtin `product_universal_v01` (blocks trung lập, mọi chữ ngành là placeholder); ProductProfile v2 category-aware (Gemini classify + anchorNoun/setting/styleBlock, cache v1 tự đúc lại); director/render/QA gates/palette end-card đều đọc từ profile+brand_dna (visionGate/consistencyGate theo anchor, hết "herbal tea reel"/"the glass"); route+UI reel meta-driven (videoTypes/templates/skus theo brand, sku legacy chỉ loveintea). Test 15/15: gossby ra plan universal sạch beverage (profile "pet accessory", anchor "custom dog bandana"), loveintea giữ nguyên iced_summer ruby/glass/ICED [LIT-REEL-0731C]
- [session 2026-07-31b] fix(tenant-map) audit "sát + đồng đều": resolveProduct CHẶN fallback SKU tĩnh cho brand ≠ loveintea (id trùng 'hibiscus' → null); generateO3Content/buildImageEditPrompt/generateBrief gate nốt context/Heritage-Voice tĩnh (brand khác dùng best_moment sản phẩm, usp/context thành tùy chọn); 6 view UI (Workshop/ImageStudio/ImageLibrary/BlogFactory/Queue/Schedule) bỏ SKUS tĩnh → useBrandProducts từ DB theo brand, ma trận O3 + USP/Scene picker chỉ hiện cho loveintea, CTA lọc câu LoveinTea, mọi fetch gắn ?brand=. Test tsx 19/19 + cross-tenant 30/30 + build pass. Reel Machine vẫn là pipeline riêng đồ uống (giới hạn cấu trúc, chưa dùng cho brand khác ngành); bazan/rootin chưa có products/DNA → cần nhập liệu [LIT-FIX-0731B]
- [session 2026-07-30b] fix(o3-engine) L4: gỡ danh tính LoveinTea viết cứng trong caption/image/brief prompt — brand bơm từ brands/brand_dna, sản phẩm DB-first; ma trận O3 tĩnh gate riêng loveintea. Test tsx 12/12 [LIT-FIX-0730G]

# 🧭 PROJECT BRIEF — LoveinTea Studio / Easy Creative Hub (ĐỌC ĐẦU MỌI PHIÊN)
> Bản tổng 1-trang. Hook SessionStart tự bơm vào mọi phiên.
> Luật: mọi phiên trước khi kết thúc PHẢI cập nhật "Cập nhật gần nhất".

## Dự án là gì
Marketing OS SaaS đa-tenant (Strategy → Plan → Create → Publish → Measure → Learn) cho các brand F&B/DTC.
Stack: Next.js 14.2 App Router (standalone), SQLite better-sqlite3 (WAL, `data/studio.db`), NextAuth (Google + email/password), gpt-image-2, Gemini 2.5 (flash/flash-lite stable ONLY), edge-tts, sharp, yt-dlp.
Domain: **app.easycreativehub.com** (tenant app) + **admin.easycreativehub.com** (Platform Console) + landing. Store thật: loveintea / bazan / rootin.

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
- **2026-07-21 [LIT-FIX-0720A]** (`9357dc8`, LIVE): Card 3ba0801d — gallery "Ảnh nền" của Chữ lên ảnh giờ lấy ĐỦ mọi ảnh bài carousel từ `images_json` (trước chỉ ảnh bìa → mất ảnh 2), nới 30→40 ảnh. Verified prod.
- **2026-07-19 [LIT-FIX-0719A]**: Fix 4 kanban card mới: (1) BLOCKER Nguồn học — upload .mp4 lỗi "Too many parameter values" (Gemini trả learnings là MẢNG → better-sqlite3 flatten khi bind; ép string) + link IG bị chặn từ IP server → hỗ trợ cookies `data/yt-dlp/cookies.txt` + lỗi tiếng Việt chỉ cách xử lý; (2) Chữ lên ảnh → nút "Đưa vào Review & Queue" (POST /api/posts nhận imagesJson); (3) carousel ≤5 ảnh text nối tiếp (`/api/content/text-overlay/carousel` + chọn ảnh đánh số trong gallery); (4) reschedule — editor ngày+giờ trong panel Plan & Lịch + prefill giờ ở Review & Queue.
- **2026-07-16 [LIT-FIX-0716A]**: Fix 4 kanban card: (1) schedule bài → defer CẢ FB+IG cho scheduler (hết "IG Post ID undefined" + hết duplicate khi bấm lại; lưu ig_post_id sau publish ngay); (2) banned claim match whole-word (liver ≠ delivers); (3) ghi chú "ko kèm vỏ hộp" thắng role slide khi gen ảnh template; (4) upload font brand headline/sub (bảng brand_fonts + /api/brand/fonts + Brand DNA UI + @font-face render).
- **2026-07-15 [LIT-VID-0715A]** (`32ff99d`): Recipe render **đạt chuẩn final gốc** sau 4 vòng audit→fix trên clip Bazan thật: tonemap **HDR HLG→SDR** (npl=130 — thiếu là màu bệt), nhịp final gốc (hook 5s/bước ~1s/product giữa bước/result cuối clip), classifier siết hook_final + `final_drink_s`, ưu tiên bước nguyên liệu, loudness 2-pass -14 LUFS. Verified YAVG/SAT/LUFS khớp gốc. Memory: `bazan-recipe-workflow.md`.
- **2026-07-14 [LIT-VID-0714A]** (`f412707`): **Recipe Batch workflow** — lô → Gemini phân vai clip → template Bazan → render tiếng thật + grade → nhiều version. UI trong Video Studio.
- **2026-07-12 [LIT-OPS-0712A]**: Cơ chế handoff-phiên (hook inject-brief + PROJECT_BRIEF + luật CLAUDE.md).

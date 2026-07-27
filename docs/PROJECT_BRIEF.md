# 🧭 PROJECT BRIEF — LoveinTea Studio / Easy Creative Hub (ĐỌC ĐẦU MỌI PHIÊN)
> Bản tổng 1-trang. Hook SessionStart tự bơm vào mọi phiên.
> Luật: mọi phiên trước khi kết thúc PHẢI cập nhật "Cập nhật gần nhất".

## Dự án là gì
Marketing OS SaaS đa-tenant (Strategy → Plan → Create → Publish → Measure → Learn) cho các brand F&B/DTC.
Stack: Next.js 14.2 App Router (standalone), SQLite better-sqlite3 (WAL, `data/studio.db`), NextAuth (Google + email/password), gpt-image-2, Gemini 2.5 (flash/flash-lite stable ONLY), edge-tts, sharp, yt-dlp.
Domain: **app.easycreativehub.com** (tenant app) + **admin.easycreativehub.com** (Platform Console) + landing. Store thật: loveintea / bazan / rootin / gossby.

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





- [session 2026-07-27] 14 commit — feat(reel) · fix(reel) · test(security) · refactor(reel) · feat(video) · docs(video)
- **2026-07-27 [LIT-VID-0727A/B/C]** (LIVE, 3 vòng trong ngày): **🧊 Reel Machine hoàn chỉnh** — auto AI video line từ đề bài 5 phiếu (kanban `70dc1102`). **A**: pipeline 7 module (fal.ai + Job Queue + Review & Queue), video HIB đầu $1.99. **B — continuity** (feedback "4 cảnh 4 cái ly"): 1 ảnh HERO/video → mọi cảnh có ly là EDIT giữ nguyên ly (gpt-image-2 edit / FLUX Kontext) + consistency gate 2 mức so hero (cutaway chỉ bắt buộc same_glass); frozen check pixel-diff (dhash báo oan ASMR); verified video 812fe4e1 CÙNG 1 ly 7 cảnh, $1.95. **C — kiến trúc MỞ** (chỉ đạo scale 50 SKU/brand): template = data (`ReelTemplateDef` registry + custom `TEMPLATES/reel_<id>.json` per-brand), product profile đúc từ products (cột thật: ingredients/pitch/theme/color_name — KHÔNG có description) cache BRAND_LIBRARY, **brief matcher** `/api/video/reel/match` (brief tự do → template+product+prompt+missing; format lạ → outline template mới) + UI dropdown sản phẩm + nút Tự khớp brief. Engine switch env: `REEL_IMAGE_ENGINE=openai` (gpt-image-2 medium — founder đã nạp, ăn đứt FLUX về đúng ingredient) / `REEL_VIDEO_ENGINE=hailuo|kling|seedance`. Gotcha mới: docker restart KHÔNG đọc lại --env-file (phải rm+run); cột products không có description. Chi tiết: memory/reel-machine.md.
- **2026-07-23 [LIT-FIX-0723A]** (LIVE+verified): 3 kanban card. df16e755 (IG): `postToInstagram` giờ **poll status_code container tới FINISHED** trước media_publish (single+carousel) → hết fail âm thầm khi đăng IG carousel; dedup gate loại chính bài đang đăng (`id != ?`) → đăng FB xong đăng tiếp IG không bị chặn "trùng 100%" (verified review self=PASS). **Đăng thật lên IG cần founder bấm** (không tự đăng public). cafd98b7: **layout user chọn LUÔN THẮNG** ở carousel/auto/suggest (trước AI ép về bottom-headline) — verified center-quote ra đúng. 438de571: thêm **dropdown chọn sản phẩm** trong Chữ lên ảnh, truyền productId+layout, prompt bơm đủ pitch/theme/ingredients/best_moment/use_cases + ép bám sản phẩm — verified Hibiscus ra "ruby/bright/refreshing". (Công dụng sức khỏe vẫn bị compliance ràng → diễn đạt "theo truyền thống hỗ trợ", đúng quy định.)
- **2026-07-22 [LIT-FIX-0722A]** (`191faf7`, LIVE+verified): 2 kanban card. cba417fb (critical, KHÔNG phải bug): gen ảnh template "400 Billing hard limit" = **tài khoản OpenAI chạm hạn mức chi tiêu** (verified key sống nhưng gen bị chặn) → **founder cần vào platform.openai.com → Settings → Limits tăng monthly budget/nạp credit**; code: `friendlyImageError()` dịch lỗi quota/billing sang tiếng Việt + gộp lỗi trùng 1 dòng (verified job prod). Lưu ý app đang gen `quality:'high'` (tốn ~3-5x). 40b556ba: carousel Chữ lên ảnh sửa được text TỪNG ảnh (kể cả xóa hết) + nút "Render lại ảnh này" (tái dùng /api/content/text-overlay). Verified prod.
- **2026-07-21 [LIT-DOC-0721A]** (`a5c2def`, LIVE+verified): Tab mới **📐 Ra đề tool video** (VideoToolGuideView, group Bắt đầu) — công thức 8 lớp + 5 phiếu A-E copy được + 2 ví dụ + 5 câu hỏi vàng + quy trình ra đề/fix liên tục qua Kanban (card mẫu, card tốt vs tồi). Nguồn: `docs/video-tool-spec-templates.md` — pipeline chuẩn 8 lớp + 5 phiếu ra đề bài (A đề tổng, B input schema, C timeline theo giây, D visual/audio formula, E nghiệm thu) + 2 ví dụ điền sẵn + bản rút gọn 5 câu hỏi vàng. Cho nhân viên tự ra đề tool video.

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
- **2026-07-21 [LIT-DOC-0721A]** (`a5c2def`, LIVE+verified): Tab mới **📐 Ra đề tool video** (VideoToolGuideView, group Bắt đầu) — công thức 8 lớp + 5 phiếu A-E copy được + 2 ví dụ + 5 câu hỏi vàng + quy trình ra đề/fix liên tục qua Kanban (card mẫu, card tốt vs tồi). Nguồn: `docs/video-tool-spec-templates.md` — pipeline chuẩn 8 lớp + 5 phiếu ra đề bài (A đề tổng, B input schema, C timeline theo giây, D visual/audio formula, E nghiệm thu) + 2 ví dụ điền sẵn + bản rút gọn 5 câu hỏi vàng. Cho nhân viên tự ra đề tool video.
- **2026-07-21 [LIT-SEC-0721A]** (LIVE): Audit cách ly tenant 30 route mới sau Jul 9 → fix 3 leak: (1) `POST /api/brands/[id]/dna/extract` thiếu canAccessBrand (brandId từ PATH — middleware chỉ validate ?brand=) → đọc được knowledge_docs brand khác; (2) `POST /api/image/generate` tin brandId từ BODY + product `WHERE id=? OR…` + template `WHERE id=?` không lọc brand; (3) tên file `textovl_<Date.now()>.png` đoán được trên /api/images public → thêm suffix random. Cross-tenant suite 18→20 case, 20/20 pass local.
- **2026-07-21 [LIT-ADM-0721A]** (`28938cf`+, LIVE+verified): UI phân quyền admin — invite hiện **mật khẩu tạm 1 lần + copy** (Team & Access lẫn Platform Console), nút 🔑 Reset MK, panel 🏪 Brand gán user↔store (UI đầu tiên cho `/api/admin/users/[id]/brands`), **enforce must_change_password** (JWT claim + middleware redirect /change-password; đổi xong page tự refresh session rồi về /). Đã clear 2 cờ cũ của hieuduc87+manhson trước khi enforce. Verified full flow bằng credentials login prod.
- **2026-07-21 [LIT-OPS-0721A]** (data-only, prod): Tạo brand **gossby** (Gossby) + brand_dna + brand_members cho `uyenvt@dlsinc.com` (user `dls-uyenvt`, role admin → vốn đã thấy mọi brand; membership để tường minh). Store thật giờ: loveintea/bazan/rootin/gossby.
- **2026-07-21 [LIT-FIX-0720A]** (`9357dc8`, LIVE): Card 3ba0801d — gallery "Ảnh nền" của Chữ lên ảnh giờ lấy ĐỦ mọi ảnh bài carousel từ `images_json` (trước chỉ ảnh bìa → mất ảnh 2), nới 30→40 ảnh. Verified prod.

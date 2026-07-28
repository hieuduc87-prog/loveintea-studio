# 📓 NHẬT KÝ TOÀN TRÌNH — Reel Machine (27–29/07/2026)
> Toàn bộ quá trình xây tool auto sản xuất video AI: mọi cái SAI, nguyên nhân gốc, cách FIX, và LUẬT tổng quát rút ra để tái dùng cho dự án khác.
> Người đọc đích: người xây tool AI-gen tiếp theo (bất kỳ brand/loại content nào).

---

## PHẦN 1 — LỘ TRÌNH THỰC TẾ (cái gì xảy ra, theo thứ tự)

| Mốc | Việc | Kết quả |
|---|---|---|
| 27/07 sáng | Đọc đề bài 5 phiếu A-E (kanban `70dc1102` + Google Doc + 5 video mẫu Drive) → **master plan** 7 module / 5 phase, tái dùng 16 dự án cũ | `docs/video-auto-reel-master-plan.md` |
| 27/07 chiều | Build pipeline v1 (template + fal.ai + render + API + UI) → **video đầu tiên** render thật trên prod | RM-HIBI-2707-1, $1.99 — nhưng "4 cảnh 4 cái ly" |
| 27/07 tối | **Continuity v2** (hero anchor + edit giữ chủ thể + gate), founder nạp OpenAI → đổi engine ảnh gpt-image-2, **kiến trúc mở** (product profile từ DB, template registry, brief matcher) | RM-HIBI-2707-2 cùng-1-ly; RM-PEPP scale SKU |
| 28/07 đêm | **Template composer** (brief → hệ tự sản xuất template, 12 luật code validate) → verify chuỗi brief→template→SKU→video | Template `tra_dem_am_cung_v01` tự đúc; RM-NIGH-2807-2 |
| 28/07 sáng | **Mã video** (claim theo mã) + **Reel Factory console** + card nhân viên đầu tiên (công thức bị bỏ qua) → extractUserElements | RM-HIBI-2807-5 đủ túi trà/dâu/mật ong |
| 28/07 trưa | Founder đổi **Seedance** (nhanh 3×, physics đẹp); **vòng khép kín cloud**: agent API token + auto-deploy watcher + cloud routine 2h | RM-HIBI-2807-6 |
| 28/07 chiều | Feedback "thìa ngoài cốc mà nước xoáy" → **cơ chế nhân-quả vật lý 3 tầng**; re-render đúng 1 scene ($0.96); **LEARNED RULES** — hệ tự học từ fail | Bản chốt thìa-trong-ly |
| 29/07 | Giải thích lỗi IG cũ (vết trước fix 23/07), viết nhật ký này | — |

**Số liệu**: ~30 commit, 15 vòng deploy, 8 video render thật, tổng chi phí AI ~$16 (đo bằng ledger, không đoán), 1 card nhân viên fix trọn vòng, 2 template (1 tự đúc), 3 SKU đã chạy.

---

## PHẦN 2 — SỔ SAI LẦM (mỗi cái: SAI → NGUYÊN NHÂN → FIX → LUẬT TỔNG QUÁT)

### Nhóm A — Hạ tầng / DevOps

**A1. gitleaks chặn commit vì tên biến `REEL_TEMPLATE_KEY`**
- Nguyên nhân: scanner thấy `*_KEY = 'chuỗi'` tưởng secret.
- Fix: đổi `REEL_TEMPLATE_ID`.
- **Luật**: không đặt tên biến chứa KEY/TOKEN/SECRET cho thứ không phải secret.

**A2. File scp lên volume bị EACCES — cả 5 video mẫu không đọc được**
- Nguyên nhân: scp bằng root (mode 600), container chạy uid 1001.
- Fix: `chown -R 1001:65533` + `chmod go+rX`.
- **Luật**: đưa file vào volume container = PHẢI chown theo uid container ngay lúc đưa.

**A3. `docker restart` không ăn env mới**
- Nguyên nhân: `--env-file` chỉ đọc lúc `docker run`.
- Fix: stop + rm + run lại.
- **Luật**: đổi env container = recreate, restart vô dụng.

**A4. Cloudflare tunnel cắt response ~100s (error 524) làm tưởng API chết**
- Nguyên nhân: CF giới hạn thời gian response; server vẫn chạy xong sau đó.
- Fix: API dài → verify bằng file/DB trên server, không tin HTTP response.
- **Luật**: sau proxy có timeout, mọi tác vụ >90s phải async + verify server-side.

**A5. Ổ Mac đầy 100% giữa phiên làm git chết**
- Fix: chỉ xoá cache tái-sinh-được (`.next/cache`, worktree build cũ), không đụng data.
- **Luật** (có sẵn, tái xác nhận): dọn ổ = chỉ nhắm cache regenerable.

**A6. SSH key không thể đưa vào cloud routine → bế tắc deploy từ cloud**
- Fix kiến trúc: **bỏ nhu cầu SSH** — (1) auto-deploy watcher trên server (cron 2': main đổi → pull+build+restart+requeue render dở), (2) agent API token-guard cho mọi thao tác còn lại (đọc card, tra video, ghi kết quả, requeue).
- **Luật**: agent cloud không nên cầm chìa khoá hạ tầng; hãy cho hạ tầng TỰ phản ứng (pull-based deploy) + cấp API hẹp quyền cho agent.

### Nhóm B — FFmpeg / Render

**B1. `colorbalance=ms=` không tồn tại → fail encode**
- Nguyên nhân: đoán tham số (midtone đỏ là `rm`).
- **Luật**: tham số ffmpeg PHẢI test trên đúng binary của môi trường chạy trước khi ship (1 lệnh docker exec là xong — cheapest test first).

**B2. xfade fail "timebase mismatch" khi trộn end card (từ PNG) với clip AI**
- Nguyên nhân: nguồn khác nhau ra timebase khác (1/1000000 vs 1/15360).
- Fix: `settb=AVTB,fps=30` trước/giữa mọi xfade.
- **Luật**: trộn video từ nguồn khác gốc = ép settb + fps trước concat/xfade.

**B3. Re-encode tích luỹ khi ghép tuần tự (generation loss ×7)**
- Fix: ghép trong MỘT filter graph duy nhất (concat trong nhóm + xfade giữa nhóm).
- **Luật**: n bước ghép = 1 lần encode, không encode chồng.

**B4. Frozen-check dhash 8×8 báo oan cảnh chuyển động nhỏ (garnish rơi)**
- Fix: pixel-diff 64×64 grayscale với ngưỡng đo được.
- **Luật**: gate nhị phân thô sẽ oan với tín hiệu nhỏ — đo MỨC thay đổi, đừng so hash.

### Nhóm C — AI Generation (đắt giá nhất)

**C1. "4 cảnh 4 cái ly" — mỗi scene t2i độc lập**
- Nguyên nhân: không có nguồn continuity chung.
- Fix: **HERO ANCHOR** — 1 ảnh hero/video; mọi cảnh có chủ thể là bản EDIT-giữ-nguyên từ hero (gpt-image-2 edit / FLUX Kontext); consistency gate so từng frame với hero; cache key clip gắn hash ảnh nguồn.
- **Luật vàng**: AI gen nhiều cảnh rời = PHẢI có anchor + edit-from-anchor + gate-so-anchor. T2i độc lập từng cảnh là nguồn gốc mọi lệch lạc.

**C2. Khoá cứng chống lệch → giết công thức user (card nhân viên đầu tiên)**
- Nguyên nhân: sau C1 em khoá lệnh edit verbatim theo template → prompt công thức (túi trà, dâu, mật ong) bị bỏ qua hoàn toàn.
- Fix: **extractUserElements** — call Gemini RIÊNG trích element user yêu cầu tường minh (kèm scene phù hợp + cờ inDrink) → chèn có kiểm soát vào lệnh edit + vào hero.
- **Luật**: cân bằng khoá-mở phải là CƠ CHẾ (khung verbatim + khe chèn được kiểm soát), không phải chọn một trong hai. Và: nhét yêu cầu phụ vào 1 call Gemini lớn sẽ bị bỏ qua — tách call riêng cho việc quan trọng.

**C3. Luật cấm đánh nhau với yêu cầu user**
- Ví dụ thật: NEGATIVE "no strawberries" (chống AI bịa fruit) vs công thức có dâu; "no cups" vs canvas "the same tall clear glass"; "drink served HOT" chèn vào cảnh cấm cốc (model sinh người-cầm-bưởi, gate đòi hot-drink trong cảnh không được có cốc).
- Fix: mọi luật cấm có cửa thoát bằng code (`adjustNeg` khi user chỉ định; canvas tự lột mệnh đề chủ thể ở cảnh không chủ thể; serve-note chỉ chèn cảnh có cốc).
- **Luật**: 2 mệnh đề mâu thuẫn trong 1 prompt = generator loạn VÀ gate loạn. Mỗi mệnh đề điều kiện chỉ được chèn đúng nơi áp dụng, và luật cấm phải kèm "unless explicitly specified" thực thi bằng code.

**C4. AI luôn vẽ chữ giả lên props có bề mặt in**
- Thực tế: tag túi trà (2 lần), sách mở — chữ loằng ngoằng giả.
- Fix: `plainify()` — concept nhắc tea bag/tag/label/book/journal/box… tự append "plain and unmarked, no printed text"; sách phải ĐÓNG.
- **Luật**: mọi prop có bề mặt in được phải bị ép "trơn không chữ" NGAY TỪ PROMPT; gate chữ là lớp sau cùng.

**C5. Phi vật lý: thìa khuấy NGOÀI cốc mà nước trong cốc xoáy**
- Fix 3 tầng: (1) PHYSICS_BLOCK mọi prompt ("mọi hiệu ứng phải có nguyên nhân thấy được; dụng cụ phải tiếp xúc vật nó tác động"), (2) extraction bắt mô tả action theo cấu trúc DỤNG CỤ–ĐIỂM TIẾP XÚC–HIỆU ỨNG + user constraints (cấm tay trần), (3) physics gate (implausible_physics → fail).
- **Luật**: mô tả hành động cho AI phải NHÂN-QUẢ tường minh; và phải có gate hỏi đúng câu "hiệu ứng này có nguyên nhân trong khung hình không?".

**C6. Prompt phủ định không ăn với t2i (FLUX)**
- Thực tế: "no cherries" → vẫn ra cherry; FLUX schnell không có negative đúng nghĩa.
- Fix: mô tả DƯƠNG những gì được có ("only the specified fruits") + đổi engine bám prompt hơn (gpt-image-2).
- **Luật**: với t2i, mô tả dương > câu phủ định. Negative chỉ đáng tin ở tầng gate.

**C7. Model/engine là biến số phải A/B bằng số thật**
- Thực tế: FLUX bịa berry, gpt-image-2 đúng ingredient; Hailuo ổn nhưng chậm (3-7'/clip), Seedance nhanh 3× + physics chất lỏng đẹp, giá ngang.
- Fix: engine switch bằng env (`REEL_IMAGE_ENGINE`, `REEL_VIDEO_ENGINE`) + fallback tự động khi engine chết (OpenAI billing) + cost ledger để so công bằng.
- **Luật**: không cãi nhau model nào tốt — switch được + đo thật + fallback tự động. Không phụ thuộc 1 nhà cung cấp (OpenAI hard-limit từng giết pipeline khác giữa chừng).

**C8. API gen bất đồng bộ — timeout & poll**
- Thực tế: Hailuo giờ cao điểm >6' (timeout 360s chết oan); IG container chưa FINISHED mà publish → "Media ID is not available" (bug 23/07).
- Fix: timeout theo đo thực tế (720s) + retry transient tách khỏi retry chất lượng; poll trạng thái tới FINISHED trước khi dùng.
- **Luật**: mọi API bất đồng bộ = poll trạng thái, không đoán thời gian; timeout đặt theo p99 thực tế giờ cao điểm.

### Nhóm D — Cache & Tiền

**D1. Cost ledger — "tính chi phí thực, không đoán" (yêu cầu founder)**
- Fix: đếm TỪNG call engine × đơn giá niêm yết đã verify, ghi vào render log + job result, kể cả khi FAIL.
- **Luật**: pipeline tốn tiền theo call = ledger từ ngày 1; số liệu là gốc của mọi quyết định engine/quality.

**D2. Cache theo hash cứu tiền — nhưng key phải thiết kế đúng**
- Thực tế tốt: fix lỗi chỉ regen scene hỏng ($0.36 thay vì $3); version 2-3 gần free.
- Sai đã trả giá: (1) đổi format key làm mất cache cũ oan; (2) clip pass ở vòng retry cache theo key-strengthen → rerun regen oan → fix bằng **alias về key gốc**.
- **Luật**: cache key = hash(mọi input ảnh hưởng output); biến thể retry thành công phải alias về key chuẩn; đổi format key = có kế hoạch migration.

### Nhóm E — Quy trình & Tổ chức

**E1. Đề bài chuẩn hoá (5 phiếu A-E) là đòn bẩy lớn nhất**
- Đề bài của nhân viên đủ chi tiết đến từng giây → tool xây trong 1 ngày. **Luật**: ép format ra đề trước khi xây bất kỳ tool nào.

**E2. Mã định danh output từ ngày 1**
- `RM-<PROD>-<DDMM>-<n>` gắn vào title/file/log/post → nhân viên claim lỗi bằng mã, bot tra ngược ra plan/log/cost trong 1 query. **Luật**: mọi pipeline sản xuất phải cấp mã cho từng sản phẩm đầu ra ngay từ đầu.

**E3. Gate do CODE quyết, không tin verdict tổng của LLM** (VERIFY-GATE law tái xác nhận)
- Mọi gate trả JSON checklist từng tiêu chí, code quyết pass/fail; gate hỏng ≠ sản phẩm hỏng (cho qua có log). Gate từng báo oan 2 lần (dhash, cutaway) → gate cũng phải được debug như code.

**E4. Verify bằng mắt + số thật, mỗi vòng**
- Mỗi video: extract frames xem tay + LUFS + duration + black-span; mỗi deploy: check SHA/hành vi thật. Exit 0 ≠ đúng.

**E5. Vòng tự học (LEARNED RULES) — thay ghi chép người**
- QA fail → Gemini tổng quát hóa thành luật ≤25 từ → lưu JSON per-brand → tự áp top-8 vào mọi prompt sau (dedupe, cap 30). **Luật**: guard > giấy, và guard tốt nhất là guard TỰ SINH từ lỗi thật.

**E6. Đừng đánh nhau với automation của chính mình**
- Hook auto-update PROJECT_BRIEF ghi đè entry tay 3 lần → chuyển nội dung chi tiết sang memory/docs, để hook làm việc của nó.

**E7. Người review là giai đoạn AUDIT, không phải đích** (triết lý founder)
- Run→learn→fix→loop tự động là mục tiêu; Review & Queue đo độ hội tụ; khi fail-rate ~0 → bật auto-publish (quyết định founder).

---

## PHẦN 3 — QUY TRÌNH CHUẨN CHO DỰ ÁN TOOL AI-GEN TIẾP THEO (checklist tái dùng)

1. **Đề bài**: ép người ra đề theo phiếu A-E (đề tổng / input schema / timeline theo giây / công thức hình-tiếng / nghiệm thu). Không đủ → trả lại đề.
2. **Master plan reuse-first**: quét dự án cũ lấy pattern (orchestration, QA, mixer, prompt formula) — đừng xây lại.
3. **Verify giá + endpoint mọi API AI trước khi code** (trang pricing gốc, ngày verify ghi vào code).
4. **Vertical slice trước**: 1 sản phẩm đầu ra thật end-to-end trên prod, rồi mới UI/scale.
5. **Kiến trúc bắt buộc từ ngày 1**: (a) anchor + edit-from-anchor + gate cho continuity; (b) cache theo hash mọi bước đắt tiền + alias biến thể; (c) cost ledger từng call; (d) mã định danh output; (e) engine switchable + fallback; (f) mọi luật cấm có cửa "unless user specifies" bằng code; (g) prompt không được chứa mệnh đề mâu thuẫn — mệnh đề điều kiện chỉ chèn nơi áp dụng.
6. **Gate nhiều tầng, code quyết**: kỹ thuật (probe/pixel/frozen đo mức) → nội dung (vision checklist JSON) → nhân-quả vật lý → continuity vs anchor. Gate cũng phải được test bằng case sai đã biết.
7. **Vòng vận hành khép kín**: sản phẩm lỗi → claim bằng mã → bot tra ngược → fix → auto-deploy (watcher pull-based, agent không cầm SSH) → verify → ghi kết quả về nơi claim.
8. **Vòng tự học**: mọi gate-fail đúc thành luật máy-đọc-được, tự áp vào prompt sau.
9. **Nhật ký này**: mỗi dự án kết thúc bằng retrospective cùng format (SAI → NGUYÊN NHÂN → FIX → LUẬT).

---
*Chi tiết kỹ thuật từng module: `memory/reel-machine.md` (máy Mac) + `docs/video-auto-reel-master-plan.md`. Mã nguồn: `lib/video/reel-*.ts`, `lib/video/product-profile.ts`, `lib/video/learned-rules.ts`, `app/api/video/reel/*`, `app/api/autofix/`.*

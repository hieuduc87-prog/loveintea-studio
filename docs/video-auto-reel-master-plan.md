# 🎬 MASTER PLAN — Creative Hub Reel Machine (Auto AI Video Line)

> **Mã phiên**: LIT-VID-0727A · Ngày: 27/07/2026
> **Nguồn đề bài**: Kanban card `70dc1102` + Google Doc "[Creative Hub] Đề bài tool video" (Hà Phương – DLS MKT, 22/07) + folder Drive "Video mẫu" (5 reel đối thủ).
> **Mục tiêu cuối**: nhân viên content chọn SKU + loại video + gõ prompt → bấm nút → tool trả 3 bản video 9:16 1080×1920, 10s (8–12s) + thumbnail + caption vào **Review & Queue**. Giống mô hình amz-pipeline: input vào → output ra, người chỉ duyệt.

---

## 1. Đề bài đã nhận (tóm tắt trung thực từ 5 phiếu A–E)

| Mục | Nội dung |
|---|---|
| Kênh / mục tiêu | IG Reels + Facebook, branding, 4 video/tuần, nhân viên content tự bấm |
| Template đầu tiên | **Iced Summer Sensory Reel 10s** (min 8s / max 12s) |
| Video mẫu | 5 reel đối thủ (macro iced drink, ice ASMR, ingredient action, pour over ice) — **chỉ học motion/pacing/ASMR cue, CẤM copy footage/audio/logo/pack** |
| Footage thật | **KHÔNG CÓ** — mọi scene phải AI generate mới; riêng packshot BẮT BUỘC composite từ ảnh approved, không cho AI vẽ lại |
| Input mỗi lần chạy | Prompt (text, bắt buộc) + SKU (tick, tùy chọn) + loại video (Product/Bán hàng/Educate/Branding, bắt buộc) |
| Output | 3 bản MP4 1080×1920 10s + 1 thumbnail + 1 caption → hàng chờ duyệt |
| Timeline 8 block | 0–1.2 MACRO HOOK → 1.2–2.4 ICE IMPACT → 2.4–3.6 INGREDIENT ACTION → 3.6–5.0 BREW/POUR → 5.0–6.3 SUMMER LIFT → 6.3–7.8 FINAL DRINK BEAUTY → 7.8–8.8 RITUAL PAYOFF → 8.8–10.0 PRODUCT CTA |
| Nhịp dựng | Shot 1.0–1.4s (max 1.8s); hard cut 70% / match cut 20% / crossfade 0.3s 10%; gen clip dài 1.5–2× slot để chọn đoạn đẹp |
| Hình | Palette Cotton Cream #FFF8F0 / Heritage Green #1A5632 / Love Coral #E04854 + SKU accent; font Sorean (hook 68–82px) + Lato; safe zone top 250 / bottom 450 / side 90, text zone y=320–1380; tối đa 3 text overlay, ≤20% frame; **AI không được render chữ** — tool overlay bằng font thật |
| Tiếng | ASMR sync theo action (ice clink/pour/slice); không VO mặc định (TTS chỉ khi explain/ad, female US warm 150–165wpm); BGM soft summer chill 0.18–0.25 vs voice, duck -6→-9dB; -14 LUFS TP -1.0; **cấm audio đối thủ** |
| Grade | LOVEINTEA_WARM_FRESH_SUMMER_AI_REF_V01: temp +3..+5, contrast -5..-10, highlights -10..-15, shadows +10..+18, sat -8..-15, grain +5..+10, màu liquid tự nhiên không neon/soda |
| Guardrails | ingredient đúng SKU (bảng 6 SKU NN/HIB/GIN/LBM/PEP/DAN + brewing method), claim blacklist (cure/detox/weight-loss…), anti-AI-look check, **no-competitor-copy check** (giống mẫu → regenerate hoặc đổi ≥3 yếu tố), CTA mềm ("Find your summer blend", không "Buy now/Hurry") |
| 6 loại video (scene order) | Product proof / How to brew / Ingredient story / Lifestyle ritual / **Iced summer** / UGC-style — cùng 1 engine, khác mapping scene |

**Đánh giá đề bài**: đạt chuẩn phiếu A–E của tab "Ra đề tool video", đủ chi tiết để xây. 5 video mẫu đã tải về kiểm tra: 7.2s–21.7s, dọc 720×1280 (1 clip ngang 1276×718, 1 clip 720×900) — dùng làm reference OK.

---

## 2. Kiến trúc — 7 module (tái dùng tối đa kinh nghiệm nội bộ)

```
INPUT: SKU + video_type + prompt + n_versions (UI Video Studio)
  │
  ├─ M0 REFERENCE ANALYZER (chạy 1 lần/template, cache)
  │    5 clip mẫu → Gemini File API → reference_analysis.json
  │    (scene_type, shot_duration, camera_distance, motion, sound_cue, transition)
  │    → motion_dictionary.json (grammar riêng LoveinTea, KHÔNG giữ footage đối thủ)
  │    ♻️ analyze-reference.ts hiện có + checklist skill hubvideo-research
  │
  ├─ M1 SCENE DIRECTOR (Gemini 2.5-flash)
  │    template timeline 8 block + SKU knowledge (products DB + brewing_method)
  │    + motion dictionary + prompt người dùng
  │    → scene plan: mỗi scene 1 prompt i2v theo Master Formula
  │      (Subject→Action→Environment→Camera→Style→Constraints, 60–100 từ,
  │       1 camera move/shot, + QUALITY/NEGATIVE block, cấm chữ trong hình)
  │    ♻️ director.ts pattern + skill video-ai (formula đã test)
  │
  ├─ M2 FOOTAGE FACTORY (fal.ai — FAL_KEY sẵn có)
  │    per scene: t2i FLUX (ảnh khởi tạo đúng brand grade, cùng "hero glass")
  │      → i2v Hailuo 02 ($0.045/s, default) / Kling 2.5 ($0.07/s, premium)
  │      → clip 2–3s cho slot 1.2s (luật gen 1.5–2×)
  │    cache theo (sku, scene_id, prompt_hash) — version 2/3 tái dùng clip body
  │    QA/clip: ffprobe + black/freeze detect + Gemini vision check
  │      (đúng ingredient SKU? có chữ AI? giống competitor? liquid tự nhiên?)
  │    fail → retry 1 lần với negative prompt bổ sung → fail nữa → đổi seed/model
  │    ♻️ quizzlee FLUX pattern + blueprint §4.1 (product fidelity law)
  │
  ├─ M3 ASSEMBLY (ffmpeg — render.ts mở rộng)
  │    chọn đoạn đẹp nhất trong clip (scene detect + motion peak)
  │    hard cut 70% / match cut theo hướng chuyển động / xfade 0.3s (final+CTA)
  │    speed ramp nhẹ ở ice drop & pour; KHÔNG Ken Burns cho scene AI
  │    grade: LUT LOVEINTEA_WARM_FRESH_SUMMER (đồng bộ màu mọi clip AI)
  │    ♻️ render.ts (encode 1080×1920@30, xfade chain, QA gates) + vpcore color_grade
  │
  ├─ M4 END CARD + TEXT OVERLAY (Puppeteer — overlay-template.ts mở rộng)
  │    end card 8.8–10s: composite <SKU>_pack_alpha.png + logo + CTA mềm
  │    text overlay ≤3 lần, Sorean/Lato (brand_fonts đã có upload+@font-face),
  │    safe zone y=320–1380, pill Cotton Cream khi nền rối
  │    ♻️ overlay-template.ts SEEK(ms) + brand_fonts (LIT-FIX-0716A)
  │
  ├─ M5 AUDIO (mixer — vpcore pattern)
  │    SFX ASMR khớp action từng block (bảng SFX theo giây trong Phiếu D):
  │      kho nội bộ (hubframe 27 + yt-uploader 42) + ElevenLabs SFX gen bổ sung
  │      (ice clink, pour, herb rustle — gen 1 lần vào BRAND_LIBRARY, tái dùng)
  │    BGM soft summer chill: kho 475 track yt-uploader → lọc mood
  │    mix: silence base → overlay tuần tự từng lớp (KHÔNG amix>2) → loudnorm -14 2-pass
  │    ♻️ vpcore audio/mixer.py 5 lớp + render.ts sidechain hiện có
  │
  └─ M6 PACKAGING & DELIVERY
       3 versions (khác hook scene / garnish / BGM — body tái dùng cache)
       thumbnail = frame đẹp nhất FINAL DRINK BEAUTY (sharp + Gemini chọn)
       caption theo brand-lang + claim blacklist
       → Job Queue hiện có → posts draft (Review & Queue) → scheduler đăng
       ♻️ jobs API + posts + review flow hiện có — KHÔNG xây mới
```

**Luật sống còn xuyên suốt** (từ đề bài + kinh nghiệm 16 dự án):
1. Packshot/logo/chữ = KHÔNG BAO GIỜ để AI vẽ — composite ảnh thật + font thật (bài học fidelity từ blueprint).
2. Mỗi render phải qua **visual QA extract frame** (frame <15KB = đen = fail) — skill video-composition.
3. Continuity gate: cùng ly, cùng màu trà, cùng ánh sáng giữa 8 scene — Gemini so frame cuối scene N với frame đầu scene N+1.
4. Competitor-copy gate: output so với 5 clip mẫu (Gemini) — giống quá → đổi ≥3 yếu tố (ingredient/surface/light/angle/text/end card) và regenerate.
5. Pipeline resume theo `completedSteps` (content-factory pattern) — retry không gen lại clip đã đạt.

---

## 3. Khung folder input chuẩn (đã chốt từ Phiếu B — làm skeleton ở Phase 0)

```
data/brand-library/<brandId>/           # trên volume /opt/loveintea/data
  PACKSHOTS/<SKU>/<SKU>_pack_alpha.png  # ⚠️ NHÂN VIÊN PHẢI NỘP (6 SKU)
  LOGO/loveintea_logo_primary_green.png # ⚠️ NHÂN VIÊN PHẢI NỘP
  FONTS/                                # Sorean + Lato (brand_fonts đã có sẵn cơ chế upload)
  COLORS/color_palette.json             # seed từ Phiếu D (core + 6 SKU accent)
  INGREDIENTS/ingredient_visual_rules.json  # SKU nào được dùng ingredient nào (seed từ bảng SKU)
  RULES/forbidden_claims.json           # đã có claim guard — trích xuất dùng chung
  RULES/no_competitor_copy.json
  MOTION/<template>_motion_dictionary.json      # M0 tự tạo
  PROMPTS/<template>_scene_prompts_v01.json     # M1 seed + tự học
  PROMPTS/negative_prompt_global.json
  AUDIO/SFX/AI_ASMR/                    # gen 1 lần + kho nội bộ
  AUDIO/BGM/soft_summer_chill/          # lọc từ kho 475 track
  LUT/LOVEINTEA_WARM_FRESH_SUMMER_AI_REF_V01.cube  # build từ thông số grade Phiếu D
  TEMPLATES/endcard_iced_summer_v01.json
  TEMPLATES/text_overlay_iced_summer_v01.json
data/references/<brandId>/iced_summer_reels/    # 5 clip mẫu (đã tải từ Drive)
  REF_*.mp4 + reference_analysis.json           # M0 output
```

---

## 4. Roadmap thực thi (5 phase, mỗi phase có nghiệm thu)

### Phase 0 — Khung input + assets (0.5 buổi) — $0
- Tạo skeleton `data/brand-library/loveintea/` + seed 6 file JSON từ đề bài (palette, ingredient rules, claim, negative prompt, end card, text overlay).
- Copy 5 clip mẫu từ Drive vào `data/references/` trên Hetzner, đặt tên REF_ chuẩn.
- Build LUT .cube từ thông số grade (script ffmpeg curves một lần).
- **Nghiệm thu**: cây thư mục đủ, thiếu gì hiện rõ trong UI (checklist đỏ/xanh).

### Phase 1 — Reference Analyzer + Motion Dictionary + Prompt Library (1 buổi) — ~$0.1
- Mở rộng `analyze-reference.ts`: batch 5 clip → `reference_analysis.json` (đúng field Phiếu B: scene_type, shot_duration, camera_distance, motion, sound_cue, transition).
- Compile `motion_dictionary.json` + sinh `scene_prompts_v01.json` cho 8 block (Gemini, có bảng Reference-to-LoveinTea mapping từ Phiếu D: lemon macro → hibiscus petal, raspberry → ruby tea macro…).
- **Nghiệm thu**: đọc JSON thấy đúng grammar 5 clip; prompt 8 scene đúng Master Formula, không chứa yếu tố nhận diện đối thủ.

### Phase 2 — Footage Factory (1.5 buổi) — ~$5–10 test
- `lib/video/ai-clip.ts`: fal.ai client (FLUX t2i → Hailuo 02 i2v; config Kling 2.5), cache, retry, QA clip (ffprobe + Gemini vision 4 câu hỏi).
- **Test thật 10 clip** với scene HIB đo fail rate (blueprint §7.3 — dự phòng ×1.5–2).
- **Nghiệm thu**: 8/8 scene HIB có clip đạt QA; báo cáo fail rate + cost thực.

### Phase 3 — Assembly + Audio + Overlay + End card (1.5 buổi) — ~$1/video
- Mở rộng `render.ts`: nhánh `ai_reel` (hard cut/match cut/speed ramp, chọn đoạn đẹp, LUT), end card composite, text overlay Sorean/Lato, audio mixer SFX-map-theo-block + BGM + loudnorm -14.
- **Nghiệm thu**: 1 video HIB 10s hoàn chỉnh pass QA gates (pixel/frozen/black/LUFS) + extract 15 frame xem tay + đối chiếu checklist Phiếu C/D từng dòng.

### Phase 4 — UI + Queue + 3 versions + thumbnail + caption (1 buổi)
- VideoStudioView thêm chế độ "🧊 Reel AI theo template": chọn SKU (6) + loại video (6 scene order) + prompt + số bản (1–3) → job queue (đã có) → Review & Queue.
- 3 versions: body dùng cache, chỉ đổi hook/garnish/BGM (chi phí biên ~+$0.3/bản).
- **Nghiệm thu**: nhân viên content tự chạy end-to-end không cần Claude; job resume được khi fail giữa chừng.

### Phase 5 — Guardrail cứng + học (0.5 buổi + liên tục)
- Competitor-similarity gate tự động trước export (luật VERIFY-GATE: code quyết verdict theo checklist, không tin verdict tổng LLM; test lại gate bằng case cố tình copy).
- Nối scoreboard: version nào win (3s retention, reach) → feed lại prompt library qua expert knowledge loop hiện có.
- Nhân bản template: 5 loại video còn lại chỉ là **mapping scene order khác** trên cùng engine + đề bài phiếu mới từ nhân viên (đúng mô hình tab "Ra đề tool video").

**Tổng công**: ~6 buổi. **Chi phí vận hành**: ~$1.2–1.8/video 3 bản (Hailuo) — rẻ hơn SaaS 3–5×, đúng dự toán blueprint.

---

## 5. Việc cần NGƯỜI (gửi lại nhân viên/founder — chặn Phase nào ghi rõ)

| # | Việc | Ai | Chặn |
|---|---|---|---|
| 1 | Nộp **packshot PNG nền trong (alpha)** 6 SKU đã approved vào Drive/BRAND_LIBRARY | Hà Phương | Phase 3 (end card) |
| 2 | Nộp **logo primary green PNG** + file font **Sorean** (kèm xác nhận license dùng video) | Hà Phương | Phase 3 |
| 3 | Chốt SKU pilot: đề bài phần "khác mẫu" ghi **Ginger** nhưng ví dụ chi tiết là **Hibiscus** → đề xuất pilot HIB (hợp iced summer nhất), GIN làm bản 2 | Founder | Phase 2 |
| 4 | Duyệt dùng kho BGM nội bộ 475 track (royalty-free đã scrape) cho video chạy ads hay chỉ organic | Founder | Phase 3 |
| 5 | fal.ai: dùng FAL_KEY hiện có (quizzlee) hay tạo key riêng cho loveintea để tách bill | Founder | Phase 2 |
| 6 | Lưu ý: OpenAI đang **chạm billing hard limit** (card cba417fb 22/07) → pipeline này mặc định dùng FLUX qua fal.ai cho t2i, KHÔNG phụ thuộc OpenAI | — | thông tin |

---

## 6. Rủi ro chính & đối sách

1. **AI vẽ liquid/ice fail cao** → gen 1.5–2× thời lượng + retry có negative prompt + đo fail rate thật ở Phase 2 trước khi cam kết cost.
2. **Continuity giữa 8 scene AI rời nhau** → cùng master still "hero glass" làm gốc i2v + continuity gate; nếu vẫn kém → nâng Kling Element Library (4 ảnh reference, premium).
3. **Output vô tình giống đối thủ** → similarity gate + luật đổi ≥3 yếu tố; motion dictionary chỉ giữ grammar trừu tượng, không giữ mô tả bố cục đặc trưng.
4. **RAM Hetzner khi Puppeteer + ffmpeg song song** → render tuần tự trong job queue, preset draft để preview (quizzlee pattern), theo dõi docker stats.
5. **Chữ AI lọt vào clip** → negative prompt "no text, no letters, no watermark" + Gemini vision check bắt buộc từng clip.

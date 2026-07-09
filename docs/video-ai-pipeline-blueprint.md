# Tuyến Content Video AI — Blueprint nâng cấp (10/07/2026)

> Tổng hợp từ: quét 16 dự án video trên máy + 6 skills + research web 20 nguồn (giá model, SaaS, kỹ thuật edit 2025-2026).
> Mục tiêu: từ ảnh sản phẩm → video short quảng cáo hoàn chỉnh (9:16, 15-35s) hoàn toàn tự động, chi phí ~$1-2.5/video.

---

## 1. Tóm tắt điều hành

- **Loveintea-studio ĐÃ CÓ nền tảng Video Studio v2 tốt** (`lib/video/`): director Gemini storyboard → ffmpeg segments (Ken Burns 3-way, xfade, warm grade) → Puppeteer HTML overlay (hook/caption/CTA) → TTS + BGM ducking frequency-aware → loudnorm -14 → QA gates cứng. **KHÔNG xây lại từ đầu — nâng cấp.**
- Hướng đúng (chuẩn công nghiệp 2026, cách Creatify/Arcads làm bên trong): **HYBRID** — ảnh thật + motion 2.5D cho mọi shot có chữ/logo (fidelity 100%, cost $0) + AI image-to-video chỉ cho 2-3 shot "wow" (rót trà, trân châu rơi, lifestyle).
- 6 nâng cấp giá trị nhất: **(1)** caption karaoke word-by-word, **(2)** TTS tiếng Việt xịn (Azure Neural / ElevenLabs — kèm word timestamps), **(3)** AI i2v qua fal.ai (Hailuo/Kling), **(4)** 3 hook variants/video, **(5)** SFX layer theo nhịp cut, **(6)** 2.5D parallax depth cho ảnh tĩnh.

---

## 2. Hiện trạng Video Studio v2 (đã ship, đang chạy)

| Layer | File | Đã có |
|---|---|---|
| Director | `lib/video/director.ts` | Gemini storyboard từ brief + Brand DNA + clip library; hook frame-0 rules; 4-block Hook/Value/Payoff/CTA; beat grid theo BPM; VO 180wpm; recipe lock từ video mẫu; brand-aware language (`lib/brand-lang.ts`) |
| Reference clone | `lib/video/analyze-reference.ts` | Gemini File API phân tích video viral → VideoRecipe (scenes/pacing/camera/beat) |
| Render | `lib/video/render.ts` | encode segment đồng nhất 1080×1920@30; Ken Burns 3-way (zoom-in/out/punch-in); xfade chain 0.25s; GRADE_VF warm; composite overlay; VO+BGM sidechain duck + EQ 600Hz; loudnorm -14 TP-1; QA (pixel/frozen/black-span/bitrate/LUFS) |
| Overlay | `lib/video/overlay-template.ts` | HTML deterministic `SEEK(ms)`; hook/caption/CTA/badge/progress; safe-zone bottom 340px; XSS-escaped |
| TTS | `lib/video/tts.ts` | OpenAI TTS voice `nova` (chưa tối ưu tiếng Việt, không có word timestamps) |
| Ingest | `lib/video/ingest.ts` + `video_clips` | Kho clip có tag, per-brand |

**Điểm yếu so với chuẩn 2026**: caption theo segment (chưa karaoke từng từ); chỉ zoompan (chưa parallax depth); chưa có shot AI chuyển động (pour/liquid); 1 hook duy nhất/video; chưa có SFX layer; TTS `nova` tiếng Việt trung bình; transition chỉ fade.

---

## 3. Kho tài nguyên nội bộ — lấy gì từ đâu

| Dự án / Skill | Trạng thái | Lấy gì |
|---|---|---|
| **hubframe-farm** | ACTIVE, core render engine | Pattern template HTML + `seekRenderTimeline(t)`; `src/render/renderer.mjs` (Puppeteer chunked capture); **`library/sfx/catalog.json` — 27 SFX** (whoosh/chime/reveal/drumroll) |
| **video-pipeline-core (vpcore)** | ACTIVE, shared lib | `audio/mixer.py` — **mix 5 lớp** VO/BGM/atmos/SFX/stinger (vol_bgm_ducked 0.07, sc_ratio 8); `captions/word_level.py` — **ASS karaoke word-level**; `video/color_grade.py` — signalstats auto-level per-clip; `qa/post_render.py` |
| **bigai-youtube-tonghop** | ACTIVE | `stage7_assembly.py` — FFmpeg filter_complex V4 (dissolve bridges, NVENC fallback); `tools/multi_format_renderer.py` — **smart crop saliency đa format** (Shorts/Reel/Teaser); Remotion components (WordCaption, CounterAnimation, LowerThird — port sang HTML overlay) |
| **content-factory** | ACTIVE | Pattern orchestration `pipeline.ts` — **completedSteps resume** (retry không chạy lại step đã xong); worker-dispatcher (nếu sau này offload render) |
| **aivideoedit** | ACTIVE | Design rules bắt buộc: contrast ≥4.5:1, không vỡ chữ, title-safe 90%, chữ đứng yên ≥0.5s; BrandDNA render config pattern |
| **bigai-shorts** | ACTIVE | Pattern MoviePy đơn giản + Pexels/Pixabay stock search (fallback footage lifestyle miễn phí) |
| **quizzlee-studio** | ACTIVE | 8-step orchestration; SFX anti-repetition (track last 10 IDs); quality presets draft/full (draft 960×540 CRF28 ultrafast để preview nhanh) |
| **yt-uploader** | early | **Kho 475 BGM + 42 SFX** đã scrape |
| **Skill `video-composition`** | — | QA luật cứng: frame <15KB = đen; scene B fade-in TRƯỚC A fade-out 0.5-0.8s; không `amix >2 inputs`; body gradient không #000 |
| **Skill `video-ai`** | — | **Seedance/Kling prompt Master Formula**: Subject→Action→Environment→Camera→Style→Constraints, 60-100 từ, **1 camera move duy nhất/shot**; QUALITY/CHARACTER/NEGATIVE blocks; tránh từ "fast/beautiful/dynamic" |
| **Skill `hubvideo-research`** | — | Checklist reverse-engineer video mẫu (bổ sung cho analyze-reference.ts) |
| KHÔNG dùng | — | hubvideoeditorhyper 3D (overkill), Remotion engine (license company + chậm hơn Puppeteer), OpenMontage agentic (phức tạp), Sora API (sunset 9/2026) |

---

## 4. Research thị trường (07/2026 — verify giá trước khi code)

### 4.1 Image-to-video models (gọi qua **fal.ai** — 1 key nhiều model)

| Model | Giá | Nhận xét cho F&B |
|---|---|---|
| **Hailuo 02/03 (MiniMax)** | $0.045/s 768p (~$0.22/clip 5s) | **Rẻ nhất nhóm khá — default cho test volume** |
| **Kling 2.5 Turbo Pro** | $0.07/s (~$0.35/clip 5s) | Sweet spot chất lượng/giá |
| **Kling 3.0 + Element Library** | ~$0.084-0.336/s | **Text rendering tốt nhất thị trường**; upload 4 ảnh đa góc sản phẩm → consistency đa cảnh. Premium tier |
| Veo 3.1 Lite/Fast | ~$0.03-0.15/s | Có audio native, physics tốt |
| Seedance 1.5 Pro | ~$0.26/clip 5s 720p | **First+last frame** → match cut sản phẩm |
| Tránh | — | Sora (API sunset 24/9/2026), Runway (đắt), Pika (không API pricing) |

**Luật product fidelity**: mọi model đều vẽ hỏng chữ bao bì/logo ở vật thể phức tạp (ly trà sữa = chất lỏng + phản chiếu + topping). → **i2v từ ảnh thật (frame 1 = ảnh gốc 100% đúng), clip 3-5s, camera move nhẹ; shot packaging/branding TUYỆT ĐỐI dùng ảnh thật + motion 2.5D, không cho AI gen.**

### 4.2 TTS tiếng Việt

| Provider | Chất lượng VN | Giá | Word timestamps |
|---|---|---|---|
| **Azure Neural 2** (HoaiMy, NamMinh) | **Tốt nhất 2026**, có expressive styles | ~$16/1M ký tự (≈$0.01/video) | **CÓ** (word boundary events) → karaoke chính xác 100%, khỏi cần Whisper |
| ElevenLabs v3 | Cảm xúc nhất, đôi khi lệch dấu | $0.10/1k ký tự (~$0.05/video) | CÓ |
| OpenAI (hiện tại) | Trung bình | ~$0.015/phút | KHÔNG |
| FPT.AI / Vbee / Zalo AI | Bản địa, đáng test | cần check | — |

### 4.3 Công thức content ad (từ SaaS + platform data)

- Hook quyết định 60-80% performance; user quyết định lướt trong <1.7s. **Độ dài vàng: 21-34s.**
- 3 công thức hook 2026: **Contrarian Claim** ("Đừng mua trà sữa nếu chưa biết điều này"), **Mistake Warning** ("90% người uống trân châu sai cách"), **List Tease** ("3 lý do ly này cháy hàng mỗi chiều"). Hook 10-14 từ + visual motion frame 1.
- Cấu trúc PAS nén: Problem 3s → Agitate+demo 10-15s → Solution+CTA 5-8s. Lời thoại khớp hình **từng giây**.
- **Chiến lược 1 body × 3 hook = 3 ads** (chỉ re-render 3s đầu + VO) — chi phí biên ~0, giá trị test lớn nhất.
- Shot list chuẩn trà sữa (6-9 shot × 1.5-4s): hero (ảnh thật+push-in) → pour/action (AI i2v slow-mo) → macro texture (AI/ảnh) → lifestyle (AI/stock) → packaging (ảnh thật 2.5D) → end card CTA (HTML).
- Safe zone 1080×1920 chạy cả 3 platform: **text trong vùng center, top ≥130px, bottom ≥480px, phải ≥140px**; caption karaoke ở **55-65% chiều cao**.
- Grade F&B: warm tone (thèm ăn), saturation ~1.15 (KHÔNG oversaturate), highlight sáng trên chất lỏng. Trending audio bản quyền: không render vào file — ASMR diegetic (rót/đá) an toàn hơn.
- Nhạc: pool gen sẵn 10 track bằng ElevenLabs Music (~$0.80/phút, license sạch cho ads) hoặc kho 475 BGM có sẵn. Tránh Suno cho ads chạy tiền (kiện tụng training data).
- Caption karaoke: 4-6 từ/màn hình, gap 50-100ms, trắng→vàng/màu brand, ASS `\kf` hoặc GSAP overlay.

### 4.4 Chi phí/video 25s (8 shot)

| Hướng | Cost | Ghi chú |
|---|---|---|
| C — Zero AI-video (chỉ 2.5D motion ảnh) | ~$0.1 | Tier test hook số lượng lớn |
| **B — Hybrid (KHUYẾN NGHỊ)** | **$0.8-2.5 (~20-65K VNĐ)** | 5 shot ảnh thật + 2-3 shot AI (Hailuo/Kling, ×1.5 retry) |
| A — Full AI gen | $2.7-5.7 | Khi cần cinematic toàn bộ |
| So sánh | — | SaaS $2-8/video; UGC người thật ~500K-2tr VNĐ. Tự build rẻ 3-10× ở volume >30 video/tháng |

---

## 5. Kiến trúc đề xuất — "Product Ad Video Line"

```
INPUT: product (ảnh + brief trong DB) + Brand DNA + purpose
  │
  ├─ 1. AD DIRECTOR (nâng cấp director.ts)
  │     → 3 hook variants (Contrarian/Mistake/ListTease) + 1 body PAS + CTA
  │     → shot list 6-9 shot: mỗi shot đánh dấu motion_type:
  │       'still_parallax' | 'still_kenburns' | 'ai_video' | 'clip' | 'end_card'
  │     → shot ai_video kèm prompt theo Master Formula (1 camera move, 60-100 từ)
  │     → LUẬT: shot có logo/bao bì/chữ → BẮT BUỘC still từ ảnh thật
  │
  ├─ 2. FOOTAGE (song song):
  │     • still_parallax: Depth Anything (local/API rẻ) → depth map → layer shift GSAP/WebGL
  │     • still_kenburns: zoompan hiện có (render 4× res chống jitter)
  │     • ai_video: fal.ai — default Hailuo 02, nâng cấp Kling 2.5/3.0; clip 3-5s;
  │       cache theo (product, prompt-hash) để tái dùng
  │     • clip: video_clips library hiện có
  │
  ├─ 3. AUDIO: Azure Neural vi-VN (word timestamps) → karaoke timing chính xác
  │     + BGM pool + SFX theo cut (whoosh -10ms trước cut, catalog 27+42 items)
  │
  ├─ 4. OVERLAY (nâng cấp overlay-template.ts):
  │     karaoke word-by-word + kinetic text + price sticker + end card CTA
  │     safe zone caption 55-65% height
  │
  └─ 5. ASSEMBLY (render.ts hiện có): xfade + punch-in/whip-pan, grade warm,
        mix 4 lớp (VO/BGM/SFX/ambience), loudnorm -14 2-pass
        → QA gates hiện có → assets → posts → scheduler đăng FB/IG
```

## 6. Roadmap

### Phase 1 — Nâng chất render hiện có, $0 chi phí mới (~2-3 buổi)
1. **Karaoke captions**: đổi TTS sang Azure Neural vi-VN (hoặc ElevenLabs) lấy word timestamps → `overlay-template.ts` render word-by-word highlight (SEEK đã sẵn sàng nhận timing). File: `lib/video/tts.ts`, `overlay-template.ts`, `render.ts`.
2. **SFX layer**: copy catalog từ hubframe-farm + yt-uploader vào `data/sfx/`; whoosh trước mỗi xfade, chime khi text pop; anti-repetition (quizzlee pattern). File: `render.ts` (thêm input SFX vào filter_complex — overlay tuần tự, không amix >2).
3. **3 hook variants**: director trả `hooks[3]`; render body 1 lần, re-render 3s đầu + VO 3 lần → 3 file output. File: `director.ts`, `render.ts`, UI VideoStudioView.
4. **Zoompan 4× res** (chống jitter) + transition punch-in cut (ngoài fade).

### Phase 2 — AI footage + parallax (~2-3 buổi, bắt đầu tốn API)
5. **fal.ai client** (`lib/video/ai-clip.ts`): Hailuo 02 default, Kling 2.5 config; prompt builder theo Master Formula + NEGATIVE block; cache clip theo hash; retry 1 lần; QA frame đầu (so sánh ảnh gốc).
6. **Segment source mới `ai_video`** trong director + render (product fidelity gating: chỉ scene không có bao bì/chữ).
7. **2.5D parallax**: depth map (Depth Anything qua fal/replicate hoặc local) → template HTML WebGL displacement → capture như overlay hiện tại.

### Phase 3 — Scale + học (sau)
8. Batch: N sản phẩm × M hook, quality preset draft (960×540 CRF28) để duyệt trước khi render full.
9. Nối scoreboard: hook variant nào win (3s retention, CTR) → feed lại director qua expert knowledge loop hiện có.
10. Premium: Kling 3.0 Element Library (4 ảnh đa góc/sản phẩm); avatar UGC HeyGen ($1/phút) cho format người nói; multi-format smart crop (bigai pattern).

## 7. Nguyên tắc & rủi ro

1. **Không cho AI vẽ bao bì** — mọi shot có chữ/logo dùng ảnh thật.
2. Verify giá trên trang gốc (fal.ai/pricing, Azure portal) trước khi code — giá blog lệch nhanh.
3. Test thật 5-10 clip i2v với ảnh ly trà của brand để đo tỉ lệ fail (ước tính ×1.5-2).
4. Clip AI 3-5s, không gen 10s (degradation tăng theo giây).
5. Không nhúng trending audio bản quyền vào file render.
6. Render trên Hetzner (container đã có chromium + ffmpeg) — theo dõi RAM khi Puppeteer capture; preset draft cho preview.

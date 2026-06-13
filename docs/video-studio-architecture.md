# LoveinTea Video Studio — Kiến trúc (tổng hợp tri thức 6 dự án nội bộ)

Mục tiêu: công cụ tạo **video ngắn 9:16 (Reels/Shorts, 15–45s)** cho mỗi brand từ
**kho clip có sẵn + ảnh AI + video AI (hybrid)**, beat-sync với nhạc, text-on-video
theo brand DNA, phục vụ đúng mục đích post — tích hợp thẳng vào vòng lặp
Plan → Create → Publish → Measure của Studio.

## Tri thức kế thừa (đã được chứng minh ở production)

| Nguồn | Bài học áp dụng |
|---|---|
| **hubvideoeditorhyper** | Render = HTML thuần + Puppeteer screenshot loop + FFmpeg encode. **Hợp đồng determinism**: mọi frame là pure function của `t` (`seekRenderTimeline(ms)`) — không `Math.random()`, không lerp-state, không prevFrame. JPEG frame nhanh hơn PNG 6x (chỉ dùng PNG khi cần alpha). Audio chuẩn: BGM -11 / VO -3 / SFX -6, final -14→-16 LUFS, ducking. |
| **quizzlee-studio** | Fleet render lessons: 1 render 1 process, JPEG, QA bằng cách ĐỌC frame thật (exit 0 ≠ video đúng). Icon/asset pool có semantic tags + accessor guard. |
| **bigai-youtube-tonghop (clip-library)** | Kho clip có não: Gemini Vision autotag (47 trường → bản lite 12 trường cho SME), search 4 lớp (SQL filter → text rerank → editorial score → diversity), script matcher (kịch bản → spec từng segment → footage local). |
| **video-composition skill (DLS brand reel)** | **2-layer compositing**: background track (FFmpeg ghép clip) + overlay HTML trong suốt (text/brand) → composite. Tỷ lệ đẹp: ~70% ảnh / 30% video. DO-NOT: amix >2 input, gap giữa scene, quên loudnorm, dùng campaign clip có text baked-in, frame <15KB = đen. |
| **video-ai skill (Seedance)** | Prompt formula 6 bước: Subject → Action → Environment → Camera → Style → Constraints (60–100 từ, 1 camera move). i2v từ ảnh sản phẩm giữ packaging. ~$1/clip → chỉ dùng cho hero shot. |
| **vpcore (DLS/POD pipeline)** | Pipeline stage hóa S0→S8: script → product DNA → audio mix → keyframe → video gen → assembly (motion guard, color grade) → post (LUT, grain) → captions → tech QA (LUFS/black frames/bitrate). |

## Quyết định kiến trúc

1. **Render tại server Hetzner trong container** (2 vCPU/3.7GB): queue tuần tự 1 video,
   video ngắn 15–45s ⇒ 3–8 phút/video — đủ cho SME vài video/ngày. KHÔNG phụ thuộc
   fleet Win/Mac (sản phẩm thương mại phải tự đứng). Image thêm `ffmpeg + chromium` (apk).
2. **2-layer compositing** (theo DLS):
   - **Background track** — FFmpeg thuần: trim clip nguồn / Ken Burns (`zoompan`) trên ảnh
     AI/ảnh sản phẩm → scale+crop 1080×1920 → concat demuxer. Không seek `<video>` trong
     Puppeteer (chậm, không deterministic).
   - **Overlay track** — HTML trong suốt render bằng Puppeteer (PNG alpha, pure function of t):
     hook text, caption từng segment, badge logo, progress bar — màu/typography đọc từ
     `brand_dna` trong DB (bám nhận diện thương hiệu tự động).
   - Composite + nhạc: `ffmpeg overlay` + BGM `loudnorm I=-16` + `afade out`.
3. **Beat-sync v1**: detect BPM từ BGM (PCM qua ffmpeg → `music-tempo`), điểm cắt segment
   snap vào lưới beat (mỗi segment = bội số nhịp). v2: onset từng beat để flash/pulse overlay.
4. **Hybrid source resolver** — thứ tự ưu tiên cho mỗi segment:
   1. `clip` từ kho brand (match tag spec — subject/mood/motion)
   2. `image` từ DAM/ảnh sản phẩm + Ken Burns
   3. `ai_image` gen mới (gpt-image-2 edit giữ packaging — pipeline ảnh sẵn có) + Ken Burns
   4. `ai_video` Seedance i2v (Phase 3, bật bằng `FAL_KEY`, chỉ hero segment)
5. **Director = Gemini** (lib/gemini đã có fallback OpenAI): nhận brief (mục đích, sản phẩm,
   platform, duration, nhạc) + brand DNA + danh sách tag clip khả dụng → trả `script_json`:
   `{hook, segments[{dur_beats, source_spec, text, anim}], cta}` — compliance neverSay/alwaysSay
   được nhúng vào prompt (như content engine hiện tại).
6. **QA bắt buộc** (bài học quizzlee/DLS): sau render extract 6 frame → frame nào <15KB = đen
   → fail job kèm log; check duration ±5%; chỉ khi pass mới ghi assets + cho publish.

## Data model (SQLite, per-brand như mọi bảng khác)

```sql
video_clips (id, brand_id, url, filename, duration_s, width, height,
             tags_json,        -- {subject, scene, mood, motion, colors[], has_product, has_text, quality, time_of_day, shot}
             source,           -- upload | ai_video
             status, created_at)

video_projects (id, brand_id, title, purpose, product_id, platform, aspect,
                target_duration_s, bgm_url, bpm,
                script_json,      -- director output (storyboard, editable)
                status,           -- draft | queued | rendering | done | failed
                output_url, render_log, error, created_at, updated_at)
```
Video output + clip lưu `data/images/` (đã có serving công khai `/api/images/` — FB/IG fetch được khi publish).

## Pipeline render (S-stages, rút gọn từ vpcore)

```
S1 director   : brief + brand DNA + clip tags → script_json (Gemini, JSON mode)
S2 resolve    : từng segment → file (clip trim | ảnh | gen ảnh AI)
S3 beats      : BPM(bgm) → đổi dur_beats → giây, snap timeline
S4 bg track   : ffmpeg trim/zoompan/scale-crop 1080×1920 → concat → bg.mp4
S5 overlay    : Puppeteer + overlay template (inline HTML, window.PROJECT inject)
                → PNG alpha 30fps → overlay.mov (png codec)
S6 composite  : ffmpeg bg + overlay + BGM(loudnorm -16, fade) → final.mp4 (h264 crf 20)
S7 qa         : extract frames (black check) + duration check
S8 save       : data/images/vid_*.mp4 + assets row + link video_project
```

## Tích hợp vòng lặp Studio
- Tab mới **Video Studio** (group Create): kho clip (upload + autotag), tạo project
  (mục đích/sản phẩm/nhạc/duration), storyboard preview, nút Render, kết quả → tạo post.
- Scheduler hiện có thêm vòng 30s: nhặt project `queued` → render (1 concurrent).
- Phase 2: publish Reels (IG `media_type=REELS`, FB `/videos`) — nối vào ContentQueue +
  metrics video (plays) vào post_metrics.
- Phase 3: Seedance hero segments; SFX events theo beat; LUT grading per-brand.

## Giới hạn đã chấp nhận (v1)
- 1 render đồng thời, 1080×1920@30fps, ≤60s.
- Beat-sync mức cắt-theo-nhịp (chưa onset-flash per beat).
- Chưa có timeline editor kéo-thả — sửa storyboard qua regenerate/JSON (UI đơn giản trước, đúng triết lý "giảm workload": AI làm 95%, người duyệt).

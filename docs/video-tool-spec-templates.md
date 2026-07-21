# 📐 CÔNG THỨC ĐÓNG TOOL VIDEO + BỘ PHIẾU RA ĐỀ BÀI

> Đúc kết từ 6 pipeline đã chạy thật: Quizzlee (quiz autogen 16 loại câu hỏi), Quiz Factory (XLSX thủ công),
> HubVideoEditorHyper (15 template data-video), Video Composition (brand reel HTML/GSAP), Bazan Recipe
> (video công thức từ clip quay thật), Video Studio v2 (viral short-form).
> Mục đích: **bất kỳ nhân viên nào** cũng mô tả được input/output đủ chi tiết để dev (hoặc AI) đóng tool 1 lần là chạy.

---

## PHẦN 1 — CÔNG THỨC BẤT BIẾN

### 1.1. Định luật gốc

> **Mọi tool video = TEMPLATE (cấu trúc cố định, làm 1 lần) + DATA (nội dung thay đổi, nạp mỗi lần).**

- **Template** = thứ giống nhau giữa 100 video: bố cục, timing, font, màu, hiệu ứng, nhạc nền, intro/outro.
- **Data** = thứ khác nhau giữa 100 video: câu hỏi, tên món, clip quay, ảnh sản phẩm, con số.
- Ra đề bài tức là: **mô tả template 1 lần cho thật kỹ + định nghĩa schema của data**. Nếu một thứ "lúc thế này lúc thế kia" mà không có quy tắc → nó chưa phải template, phải hỏi lại người ra đề.

### 1.2. Pipeline chuẩn 8 lớp (mọi tool video đều đi qua, chỉ khác chỗ tự động hay thủ công)

| # | Lớp | Câu hỏi phải trả lời | Ví dụ thực tế |
|---|-----|----------------------|----------------|
| 1 | **INPUT** | Nguồn nội dung là gì? Ai chuẩn bị? Định dạng gì? | Quizzlee: theme keyword. Quiz Factory: file XLSX + folder ảnh. Bazan: folder clip .MOV quay iPhone. |
| 2 | **CONTENT** | Kịch bản/storyboard do AI sinh hay người soạn? Cấu trúc mấy khối? | Quiz: 60% câu "tìm con khác" + 40% câu gia vị. Video Studio: 4 khối Hook/Value/Payoff/CTA. Bazan: hook→bước→product→result. |
| 3 | **ASSETS** | Ảnh/icon/clip lấy từ đâu? Đặt tên & thư mục thế nào? Cache không? | Quiz: FLUX gen icon + cache theo theme. Bazan: clip thật phân loại bằng Gemini. Brand reel: kho asset có tag, tỷ lệ 70% ảnh 30% video. |
| 4 | **VOICE / AUDIO** | Giọng đọc (TTS hay tiếng thật)? BGM? SFX? Chuẩn âm lượng? | Quiz: edge-tts + 27 SFX. Bazan: giữ tiếng ASMR thật, loudnorm -14 LUFS. Video Studio: VO 180 wpm + ducking. |
| 5 | **COMPOSITION** | Mỗi loại cảnh bố cục ra sao? Timing từng giây? Chuyển cảnh kiểu gì? | HTML+GSAP template per loại cảnh; cross-dissolve chồng 0.5-0.8s, KHÔNG để gap đen. |
| 6 | **RENDER** | Tỷ lệ khung? Độ phân giải? FPS? Màu (grade/tonemap)? | 9:16 1080x1920 (social) / 16:9 1920x1080 (YouTube); Bazan phải tonemap HDR HLG→SDR. |
| 7 | **QA** | Kiểm tra tự động những gì trước khi giao? | Frame đen (<15KB / std-dev<30), frame đóng băng, LUFS -14±, bitrate ≥600k, có audio stream, black span ≤2s. |
| 8 | **OUTPUT** | File gì? Metadata gì? Đăng đâu? Dọn file gì sau upload? | MP4 + title/description/tags + 3 thumbnail A/B/C; upload xong XÓA file render, GIỮ asset pool. |

### 1.3. 7 bài học xương máu (nhồi vào mọi đề bài)

1. **Phải có video mẫu.** Không có ≥3 video mẫu đang chạy tốt để "giải phẫu" thì chưa được ra đề. Mọi template tốt đều bắt đầu từ reverse-engineering video thật (HubVideo research: tải video → tách frame 3s/lần → transcribe → đo timing từng cảnh; Bazan: scene-detect final gốc mới ra nhịp hook 4.8s / bước 0.7-1s).
2. **Mô tả bằng CON SỐ, không bằng tính từ.** "Hook hấp dẫn" = vô dụng. "Hook 0–3.5s: shot thành phẩm CÓ chuyển động + tên món 2 dòng, dòng 2 to đậm nghiêng trắng" = làm được.
3. **Quy ước đặt tên file là một phần của đề bài.** Quiz Factory chạy được vì có quy ước cứng `C{N}.1.png`, `T{N}.1.png`. Bazan chạy được vì team quay đặt `SOURCES/RECIPES/<n>. <MÓN>/IMG_*.MOV` (số IMG tăng = thứ tự quay). Không có quy ước → tool không biết ảnh nào vào ô nào.
4. **Exit code 0 ≠ video đúng.** QA phải nhìn bằng mắt máy: extract 10–15 frame tại các mốc chuyển cảnh, check size/độ sáng, đo LUFS. Đề bài phải kèm tiêu chí nghiệm thu đo được.
5. **Nguồn video quay điện thoại phải khai báo.** iPhone quay HLG 10-bit (HDR) — không tonemap thì màu bệt. Rotation metadata, resolution, fps của nguồn phải ghi rõ trong phiếu INPUT.
6. **Âm thanh có chuẩn:** đích -14 LUFS (IG/TikTok) hoặc -16 (YouTube); VO không mix thẳng vào BGM (overlay tuần tự 2-input); BGM ducking khi có giọng nói. Nhạc trending bản quyền KHÔNG render vào file được — chỉ gắn khi đăng native trong app.
7. **Bản draft trước, full sau.** Mọi tool phải có chế độ render nháp (độ phân giải thấp, fps thấp) để duyệt nhanh trước khi render bản đẹp (Quizzlee: draft 960x540/15fps vs full 1080p/30fps).

---

## PHẦN 2 — BỘ PHIẾU RA ĐỀ BÀI (nhân viên điền)

> Quy trình: điền **Phiếu A** trước → dev/AI đọc, xác nhận khả thi → điền tiếp **B, C, D, E** → nghiệm thu theo **E**.
> Điền không được ô nào thì ghi `?` và LÝ DO — đừng bịa. Ô `?` = câu hỏi dev sẽ hỏi lại ngay từ đầu, rẻ hơn sửa tool.

---

### 📄 PHIẾU A — ĐỀ BÀI TỔNG (1 trang, bắt buộc)

```
TÊN TOOL:            (vd: "Tool video công thức đồ uống Bazan")
NGƯỜI RA ĐỀ:         (tên + kênh liên lạc)
NGÀY:

1. VIDEO NÀY ĐỂ LÀM GÌ?
   - Đăng ở đâu:            [ ] TikTok  [ ] Reels/IG  [ ] YouTube  [ ] YouTube Shorts  [ ] Facebook
   - Mục tiêu:              [ ] view/viral  [ ] bán hàng  [ ] branding  [ ] SEO
   - Tần suất cần:          ___ video / ngày|tuần
   - Ai bấm nút chạy tool:  [ ] nhân viên content  [ ] tự động theo lịch

2. VIDEO MẪU (BẮT BUỘC ≥3 link — không có mẫu = trả lại đề)
   - Link 1: ______________  (điểm muốn giống: ______________)
   - Link 2: ______________  (điểm muốn giống: ______________)
   - Link 3: ______________  (điểm muốn giống: ______________)
   - Điểm KHÁC video mẫu (nếu có): ______________

3. INPUT — mỗi lần chạy tool, người dùng đưa vào CÁI GÌ?
   (liệt kê HẾT, kể cả thứ "hiển nhiên". Mỗi dòng: tên — định dạng — ai chuẩn bị — bắt buộc/tùy chọn)
   vd: "Folder clip quay món — .MOV iPhone dọc — nhân viên quay — bắt buộc"
   vd: "Tên món — text — nhân viên nhập tay — bắt buộc"
   vd: "Số bản muốn dựng — 1-3 — nhân viên chọn — mặc định 1"
   - ______________________________________________
   - ______________________________________________
   - ______________________________________________

4. OUTPUT — tool trả ra CÁI GÌ?
   - File video:   tỷ lệ ___ (9:16 / 16:9 / 1:1), độ phân giải ___, thời lượng ___ giây (± bao nhiêu)
   - Số bản/lần chạy: ___
   - Kèm theo:     [ ] thumbnail (mấy bản: ___)  [ ] title/caption  [ ] hashtags  [ ] phụ đề file .srt
   - Giao ở đâu:   [ ] tải về  [ ] tự đăng lên kênh  [ ] đưa vào hàng chờ duyệt (Review & Queue)

5. PHẦN NÀO CỐ ĐỊNH (template) — PHẦN NÀO THAY ĐỔI (data)?
   CỐ ĐỊNH mỗi video:   (vd: intro 20s, font, màu, nhạc nền, cấu trúc hook→bước→kết)
   - ______________________________________________
   THAY ĐỔI mỗi video:  (vd: câu hỏi, clip, tên món, giá)
   - ______________________________________________

6. AI LÀM PHẦN NÀO — MÁY LÀM PHẦN NÀO?
   Người soạn tay:  ______________ (vd: quay clip, gõ tên món)
   AI sinh:         ______________ (vd: caption bước, phân loại clip, giọng đọc)
   Người duyệt lại: ______________ (vd: xem bản draft trước khi render full)
```

---

### 📄 PHIẾU B — MÔ TẢ INPUT CHI TIẾT (schema + quy ước file)

**B1. Bảng schema dữ liệu** — mỗi trường 1 dòng:

| Tên trường | Kiểu | Bắt buộc? | Giá trị mẫu | Ràng buộc / ghi chú |
|------------|------|-----------|-------------|---------------------|
| dish_name | text | ✔ | "Choco Chips Mocha" | ≤30 ký tự, Title Case |
| clips | folder .MOV | ✔ | 8 file | mỗi clip ≥1s, quay dọc |
| versions | số 1–3 | ✖ (mặc định 1) | 2 | |
| bgm | file mp3 / "auto" | ✖ | auto | auto = lấy từ kho BGM |

**B2. Quy ước thư mục & đặt tên file** (nếu input là folder — vẽ cây thư mục MẪU THẬT):

```
(ví dụ chuẩn đã chạy — Quiz Factory)          (ví dụ chuẩn đã chạy — Bazan)
CÂU HỎI TƯƠNG TÁC/C{N}/                       SOURCES/
├── C{N}.1.png   ← ảnh nội dung 1             ├── RECIPES/<số>. <TÊN MÓN>/IMG_*.MOV
├── C{N}.2.png   ← ảnh nội dung 2             │     (số IMG tăng dần = thứ tự quay)
├── T{N}.1.png   ← banner câu hỏi             ├── PRODUCT - BREWING/  ← clip dùng chung cả lô
└── T{N}.2.png   ← banner đáp án              └── COLOR GRADING/      ← ảnh chụp thông số màu
```

Kèm bảng **"file nào vào ô nào"** cho từng loại cảnh (bắt chước bảng per-type mapping của Quiz Factory):

| Loại cảnh | File .1 dùng làm | .2 | .3 | .4 |
|-----------|-------------------|----|----|----|
| (điền)    |                   |    |    |    |

**B3. Khai báo nguồn quay** (nếu input có video/ảnh quay thật):
- Thiết bị quay: ______ (iPhone/Android/máy ảnh) → HDR hay SDR? 10-bit? (iPhone mặc định HLG 10-bit → tool PHẢI tonemap)
- Hướng quay: dọc/ngang, có rotation metadata không
- Chất lượng tối thiểu chấp nhận: độ phân giải ≥ ___, thời lượng clip ≥ ___ s
- Điều CẤM trong clip nguồn: (vd: có logo bên thứ 3, có mặt người lạ, text nướng sẵn trong hình)

---

### 📄 PHIẾU C — CẤU TRÚC VIDEO THEO GIÂY (storyboard timing)

> Đây là phiếu quan trọng nhất. Cách lấy số liệu: mở video mẫu, tua từng cảnh, ghi mốc giây.
> Nếu không tự đo được → yêu cầu dev chạy scene-detect video mẫu rồi cùng ngồi điền.

**C1. Bảng timeline** — mỗi khối 1 dòng, cộng lại = tổng thời lượng:

| Từ giây → giây | Tên khối | Hình gì trên màn | Chữ gì, ở đâu, kiểu gì | Tiếng gì | Chuyển cảnh sang khối sau |
|----------------|----------|-------------------|--------------------------|----------|---------------------------|
| 0 → 3.5 | HOOK | shot thành phẩm CÓ chuyển động | tên món 2 dòng giữa màn: dòng 1 nhỏ nghiêng, dòng 2 to đậm trắng | tiếng thật + BGM | cắt thẳng (hard cut) |
| 3.5 → 6 | ... | | | | |

**C2. Quy tắc nhịp:**
- Khối lặp lại (câu hỏi/bước pha/item): mỗi khối ___ giây; tối đa ___ khối; nếu nguồn nhiều hơn thì (cắt bớt / xoay vòng giữa các bản)?
- Tổng thời lượng đích: ___ s (min ___ / max ___)
- Cảnh sản phẩm/quảng cáo chèn ở đâu: (vd Bazan: chèn GIỮA chuỗi bước, giây 8–10, không để cuối)

**C3. Chuyển cảnh & hiệu ứng (chọn, đừng tự chế):**
- Chuyển cảnh: [ ] hard cut  [ ] cross-fade ___ s  [ ] wipe  [ ] zoom
- Hiệu ứng chữ vào: [ ] fade  [ ] slide  [ ] scale-pop  — thời lượng ___ ms
- Ken Burns (ảnh tĩnh phóng nhẹ 1.0→1.1): [ ] có  [ ] không
- LUẬT CỨNG: 2 cảnh phải CHỒNG lên nhau 0.5–0.8s khi fade, không bao giờ để màn đen trống >0.3s.

---

### 📄 PHIẾU D — CÔNG THỨC HÌNH & TIẾNG (visual + audio formula)

> Điền theo checklist 9 mục (chuẩn HubVideo research). Cách tốt nhất: chụp 5–7 frame video mẫu, dán vào phiếu, chú thích lên frame.

**D1. Hình:**
- Nền: [ ] màu đặc  [ ] gradient  [ ] ảnh  [ ] video — mã màu/nguồn: ______
- Bảng màu: primary #______, accent #______, chữ #______
- Font: tiêu đề ______ (size ___px), chữ thường ______ (___px) — file font ở đâu: ______
- Vùng an toàn: chữ KHÔNG được nằm dưới ___ px đáy màn (mặc định 340px cho 9:16 — tránh UI TikTok/IG che)
- Chữ trên nền sáng: bắt buộc shadow/outline mấy lớp: ______
- Watermark/logo: vị trí ______, xuất hiện từ giây ______
- Màu video (grade): [ ] giữ nguyên  [ ] warm cinematic  [ ] theo bộ số: (vd Bazan: Shadow -10, Whites +4, Blacks -5, Sat +5, Sharpen 12, Clarity 6)

**D2. Tiếng:**
- Giọng đọc: [ ] không  [ ] TTS (giọng: ______, tốc độ ~180 wpm)  [ ] tiếng thật giữ nguyên (ASMR)
- Kịch bản đọc theo mẫu câu nào: (vd: "Number X. [Name]. [Fact].")
- BGM: thể loại ______; nguồn: [ ] kho BGM nội bộ  [ ] file kèm theo; volume so với giọng: ______ (mặc định 0.2–0.25)
- Ducking: BGM tự giảm khi có giọng nói: [ ] có (mặc định CÓ)
- SFX: liệt kê thời điểm + loại: (vd: whoosh mỗi lần chuyển câu, drumroll trước đáp án, chime khi reveal)
- Chuẩn loa: đích **-14 LUFS** (TikTok/IG) hoặc **-16 LUFS** (YouTube) — khoanh 1
- Nhạc trending bản quyền: KHÔNG nhúng vào file — nếu muốn thì ghi rõ "gắn khi đăng trong app"

**D3. Assets cần chuẩn bị sẵn 1 lần (thuộc template):**

| Asset | Nguồn (có sẵn/AI gen/phải làm) | Đường dẫn/link | Ghi chú |
|-------|-------------------------------|-----------------|---------|
| Intro video | | | (vd Quizzlee: intro 20s cố định) |
| Outro | | | |
| Badge/khung/sticker | | | |
| Bộ SFX | | | |
| Kho BGM | | | |
| Font files | | | |

---

### 📄 PHIẾU E — NGHIỆM THU (Definition of Done)

> Tool được coi là XONG khi qua hết bảng này trên **3 bộ input thật khác nhau** (không phải input demo của dev).

**E1. Kiểm tự động (tool phải tự chạy sau mỗi render):**
- [ ] Không frame đen (kiểm 10–15 frame tại mốc chuyển cảnh; frame <15KB hoặc std-dev<30 = fail)
- [ ] Không frame đóng băng bất thường
- [ ] Loudness đúng đích ±1 LUFS; có audio stream; không đoạn câm >2s
- [ ] Bitrate ≥ 600kbps; đúng resolution + tỷ lệ khung
- [ ] Thời lượng trong khoảng min–max của Phiếu C

**E2. Kiểm bằng mắt người (người ra đề duyệt):**
- [ ] Đặt video output CẠNH video mẫu — xem mù không phân biệt được phong cách
- [ ] Chữ đọc được trên điện thoại thật (không bị UI app che, không chìm vào nền)
- [ ] Hook 3 giây đầu: có chuyển động, không logo/intro chậm
- [ ] Tiếng: giọng rõ, nhạc không át, không giật volume giữa các đoạn
- [ ] Chạy thử input "bẩn": thiếu 1 file, tên file sai, clip quá ngắn → tool báo lỗi TIẾNG VIỆT dễ hiểu, không im lặng ra video hỏng

**E3. Vận hành:**
- [ ] Có chế độ render DRAFT nhanh để duyệt trước bản full
- [ ] Render lỗi giữa chừng → chạy lại TIẾP TỤC từ bước fail, không làm lại từ đầu
- [ ] Upload/giao xong → tự xóa file render tạm; KHÔNG BAO GIỜ đụng vào kho asset gốc
- [ ] Có hướng dẫn 1 trang cho người vận hành: chuẩn bị input → bấm gì → lấy output ở đâu → lỗi thường gặp

---

## PHẦN 3 — HAI VÍ DỤ ĐIỀN SẴN (để nhân viên bắt chước)

### Ví dụ 1: Quiz video (kiểu Quizzlee)
- **A**: YouTube, 5 video/ngày, tool tự chạy theo theme. Input = 1 từ khóa theme ("animals") + số câu (10). Output = MP4 16:9 1080p ~3-5 phút + 3 thumbnail + title/desc/tags.
- **Cố định**: intro 20s, 16 loại câu hỏi có sẵn, tỷ lệ 60% câu "tìm con khác" / 40% câu gia vị, SFX catalog, giọng en-US-Guy.
- **Thay đổi**: theme → AI sinh câu hỏi + gen icon (cache lại theo theme).
- **C**: mỗi câu = [hỏi 10s đếm ngược + tick] → [reveal 3s + chime]; drumroll trước đáp án.
- **E**: draft 960x540 duyệt trước; audio -ar 44100 mọi bước mix.

### Ví dụ 2: Video công thức đồ uống (kiểu Bazan)
- **A**: Reels/TikTok 9:16, mẫu = 3 final video của team; Input = folder clip .MOV theo quy ước `RECIPES/<n>. <MÓN>/IMG_*.MOV` + tên món + số bản (1–3). Output = MP4 1080x1920 ~18s, đưa vào hàng chờ duyệt.
- **B3 quan trọng**: iPhone HLG 10-bit → PHẢI tonemap HDR→SDR, không thì màu bệt.
- **C**: 0–3.5s hook thành phẩm + tên món 2 dòng → bước pha cắt nhanh 0.7–1s/bước (ưu tiên cảnh đổ/múc nguyên liệu, tối đa 6 bước) → clip sản phẩm chèn GIỮA (giây 8–10) → 3s cuối thành phẩm KHÔNG chữ.
- **D**: giữ tiếng thật ASMR, không TTS; grade theo bộ số team; -14 LUFS; caption trắng bold giữa màn, shadow 3 lớp.
- **AI làm**: phân loại clip (cảnh nào là hook/bước/sản phẩm), sinh caption bước, sinh 2 dòng tên món. **Người làm**: quay clip đúng quy ước folder, gõ tên món, duyệt draft.

---

## PHẦN 4 — BẢN RÚT GỌN: 5 CÂU HỎI VÀNG

Khi cần ra đề nhanh (tool nhỏ), tối thiểu phải trả lời được 5 câu — thiếu 1 câu là đề chưa đạt:

1. **Video mẫu đâu?** (≥3 link + chỉ rõ muốn giống điểm nào)
2. **Bỏ vào cái gì?** (liệt kê hết input + định dạng + ai chuẩn bị + quy ước đặt tên)
3. **Nhận ra cái gì?** (tỷ lệ khung, độ phân giải, thời lượng, số bản, kèm caption/thumbnail gì, giao ở đâu)
4. **Cái gì cố định — cái gì thay đổi mỗi video?** (template vs data)
5. **Thế nào là ĐẠT?** (tiêu chí đo được: timeline theo giây + chữ đọc được trên điện thoại + chuẩn -14 LUFS + đặt cạnh mẫu không phân biệt được)

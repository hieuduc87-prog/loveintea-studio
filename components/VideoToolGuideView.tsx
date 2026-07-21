'use client';

import { useState } from 'react';

/**
 * VideoToolGuideView — "Ra đề tool video"
 * Đúc kết từ 6 pipeline đã chạy thật (Quizzlee, Quiz Factory, HubVideo,
 * Video Composition, Bazan Recipe, Video Studio v2).
 * Nguồn gốc: docs/video-tool-spec-templates.md — sửa nội dung thì sửa CẢ HAI.
 * Mỗi phiếu có nút copy để dán thẳng vào card Kanban khi ra đề.
 */

const PHIEU_A = `📄 PHIẾU A — ĐỀ BÀI TỔNG
TÊN TOOL:
NGƯỜI RA ĐỀ:            NGÀY:

1. VIDEO ĐỂ LÀM GÌ?
- Đăng ở đâu: TikTok / Reels / YouTube / Shorts / Facebook
- Mục tiêu: view-viral / bán hàng / branding / SEO
- Tần suất cần: ___ video / ngày|tuần
- Ai bấm nút chạy: nhân viên content / tự động theo lịch

2. VIDEO MẪU (BẮT BUỘC ≥3 link — không có = trả lại đề)
- Link 1: ______ (điểm muốn giống: ______)
- Link 2: ______ (điểm muốn giống: ______)
- Link 3: ______ (điểm muốn giống: ______)
- Điểm muốn KHÁC mẫu: ______

3. INPUT — mỗi lần chạy, người dùng đưa vào CÁI GÌ?
(mỗi dòng: tên — định dạng — ai chuẩn bị — bắt buộc/tùy chọn)
- ______________________________________
- ______________________________________

4. OUTPUT — tool trả ra CÁI GÌ?
- Video: tỷ lệ ___ (9:16/16:9/1:1), phân giải ___, dài ___ s (±___)
- Số bản/lần: ___
- Kèm: thumbnail (___ bản) / title-caption / hashtags / .srt
- Giao ở đâu: tải về / tự đăng / hàng chờ duyệt (Review & Queue)

5. CỐ ĐỊNH vs THAY ĐỔI
- Cố định mỗi video (template): ______
- Thay đổi mỗi video (data): ______

6. AI LÀM GÌ — NGƯỜI LÀM GÌ?
- Người soạn tay: ______
- AI sinh: ______
- Người duyệt lại: ______`;

const PHIEU_B = `📄 PHIẾU B — MÔ TẢ INPUT CHI TIẾT
B1. Schema dữ liệu (mỗi trường 1 dòng):
| Tên trường | Kiểu | Bắt buộc? | Giá trị mẫu | Ràng buộc |
| dish_name | text | ✔ | "Choco Chips Mocha" | ≤30 ký tự |
| clips | folder .MOV | ✔ | 8 file | mỗi clip ≥1s |
| ... | | | | |

B2. Quy ước thư mục & tên file (vẽ cây thư mục MẪU THẬT):
(vd Bazan: SOURCES/RECIPES/<số>. <TÊN MÓN>/IMG_*.MOV — số IMG tăng = thứ tự quay)
(vd Quiz: C{N}/C{N}.1.png ảnh 1, T{N}.1.png banner câu hỏi)

Bảng "file nào vào ô nào" cho từng loại cảnh:
| Loại cảnh | .1 dùng làm | .2 | .3 | .4 |

B3. Khai báo nguồn quay (nếu có video/ảnh thật):
- Thiết bị: ______ → HDR hay SDR? (iPhone = HLG 10-bit → tool PHẢI tonemap)
- Hướng quay: dọc/ngang, rotation metadata?
- Tối thiểu: phân giải ≥ ___, clip ≥ ___ s
- CẤM trong clip nguồn: logo bên thứ 3 / mặt người lạ / text nướng sẵn`;

const PHIEU_C = `📄 PHIẾU C — CẤU TRÚC VIDEO THEO GIÂY (quan trọng nhất)
C1. Timeline (mỗi khối 1 dòng, cộng lại = tổng thời lượng):
| Giây → giây | Khối | Hình gì | Chữ gì, ở đâu, kiểu gì | Tiếng gì | Chuyển cảnh |
| 0 → 3.5 | HOOK | thành phẩm CÓ chuyển động | tên món 2 dòng giữa màn | tiếng thật + BGM | hard cut |
| ... | | | | | |

C2. Quy tắc nhịp:
- Khối lặp (câu hỏi/bước/item): ___ s/khối, tối đa ___ khối; dư thì cắt bớt hay xoay vòng?
- Tổng thời lượng đích: ___ s (min ___ / max ___)
- Cảnh sản phẩm/quảng cáo chèn ở giây: ___ (Bazan: chèn GIỮA chuỗi bước, không để cuối)

C3. Chuyển cảnh & hiệu ứng (chọn, không tự chế):
- Chuyển cảnh: hard cut / cross-fade ___s / wipe / zoom
- Chữ vào: fade / slide / scale-pop — ___ ms
- Ken Burns ảnh tĩnh (1.0→1.1): có/không
- LUẬT CỨNG: 2 cảnh chồng nhau 0.5–0.8s khi fade, không màn đen trống >0.3s`;

const PHIEU_D = `📄 PHIẾU D — CÔNG THỨC HÌNH & TIẾNG
D1. Hình:
- Nền: màu đặc/gradient/ảnh/video — mã màu/nguồn: ______
- Bảng màu: primary #____, accent #____, chữ #____
- Font: tiêu đề ____ (___px), chữ thường ____ (___px) — file font ở: ____
- Vùng an toàn: chữ KHÔNG dưới ___px đáy màn (mặc định 340px cho 9:16)
- Chữ trên nền sáng: shadow/outline mấy lớp: ____
- Watermark/logo: vị trí ____, từ giây ____
- Grade màu: giữ nguyên / warm cinematic / bộ số riêng: ____

D2. Tiếng:
- Giọng đọc: không / TTS (giọng ____, ~180 wpm) / tiếng thật ASMR
- Mẫu câu đọc: (vd "Number X. [Name]. [Fact].")
- BGM: thể loại ____; nguồn: kho nội bộ / file kèm; volume so giọng ____ (0.2–0.25)
- Ducking BGM khi có giọng: CÓ (mặc định)
- SFX: thời điểm + loại (whoosh chuyển cảnh, drumroll trước đáp án...)
- Chuẩn loa: -14 LUFS (TikTok/IG) hoặc -16 LUFS (YouTube)
- Nhạc trending bản quyền: KHÔNG nhúng file — chỉ gắn khi đăng trong app

D3. Assets chuẩn bị 1 lần (thuộc template):
| Asset | Nguồn (có sẵn/AI gen/phải làm) | Đường dẫn | Ghi chú |
| Intro / Outro / Badge / SFX / Kho BGM / Font | | | |`;

const PHIEU_E = `📄 PHIẾU E — NGHIỆM THU (Definition of Done)
Tool XONG khi qua hết bảng này trên 3 BỘ INPUT THẬT khác nhau.

E1. Tool tự kiểm sau mỗi render:
[ ] Không frame đen (10–15 frame tại mốc chuyển cảnh; <15KB hoặc std-dev<30 = fail)
[ ] Không frame đóng băng bất thường
[ ] Loudness đúng đích ±1 LUFS; có audio; không câm >2s
[ ] Bitrate ≥600kbps; đúng resolution + tỷ lệ
[ ] Thời lượng trong min–max của Phiếu C

E2. Người ra đề duyệt bằng mắt:
[ ] Đặt cạnh video mẫu — xem mù không phân biệt được phong cách
[ ] Chữ đọc được trên điện thoại thật (không bị UI app che)
[ ] Hook 3s đầu có chuyển động, không logo/intro chậm
[ ] Giọng rõ, nhạc không át, không giật volume
[ ] Input "bẩn" (thiếu file, tên sai, clip ngắn) → báo lỗi tiếng Việt dễ hiểu

E3. Vận hành:
[ ] Có chế độ render DRAFT nhanh để duyệt trước
[ ] Lỗi giữa chừng → chạy lại TIẾP TỤC từ bước fail
[ ] Upload xong tự xóa file tạm; KHÔNG đụng kho asset gốc
[ ] Có hướng dẫn 1 trang cho người vận hành`;

const GOLDEN_5 = `⚡ 5 CÂU HỎI VÀNG (đề bài nhanh cho tool nhỏ — thiếu 1 câu là chưa đạt)
1. VIDEO MẪU ĐÂU? (≥3 link + chỉ rõ muốn giống điểm nào)
2. BỎ VÀO CÁI GÌ? (input + định dạng + ai chuẩn bị + quy ước đặt tên)
3. NHẬN RA CÁI GÌ? (tỷ lệ, phân giải, thời lượng, số bản, caption/thumbnail, giao ở đâu)
4. CÁI GÌ CỐ ĐỊNH — CÁI GÌ THAY ĐỔI mỗi video? (template vs data)
5. THẾ NÀO LÀ ĐẠT? (timeline theo giây + chữ đọc được trên điện thoại + -14 LUFS + đặt cạnh mẫu không phân biệt được)`;

const KANBAN_CARD_MAU = `[ĐỀ BÀI TOOL VIDEO] <tên tool>

VIDEO MẪU: <3 link + điểm muốn giống>
INPUT: <liệt kê + định dạng + quy ước đặt tên>
OUTPUT: <tỷ lệ / phân giải / thời lượng / số bản / giao ở đâu>
CỐ ĐỊNH: <phần template>    THAY ĐỔI: <phần data>
ĐẠT KHI: <tiêu chí đo được theo Phiếu E>

(đính kèm: screenshot video mẫu / frame lỗi / cây thư mục input)`;

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      className="vtg-copy"
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1600); }); }}
    >
      {ok ? '✓ Đã copy' : '📋 Copy phiếu'}
    </button>
  );
}

function Phieu({ id, icon, kicker, title, intro, text }: { id: string; icon: string; kicker: string; title: string; intro: string; text: string }) {
  return (
    <section id={`vtg-${id}`} className="vtg-sec">
      <div className="vtg-sec-head">
        <div className="vtg-sec-icon">{icon}</div>
        <div>
          <div className="vtg-kicker">{kicker}</div>
          <h2>{title}</h2>
        </div>
      </div>
      <p className="vtg-intro">{intro}</p>
      <div className="vtg-prewrap">
        <CopyBtn text={text} />
        <pre>{text}</pre>
      </div>
      <div className="vtg-div" />
    </section>
  );
}

const TOC: { id: string; icon: string; label: string }[] = [
  { id: 'formula', icon: '🧠', label: 'Công thức bất biến' },
  { id: 'pipeline', icon: '🏭', label: 'Pipeline 8 lớp' },
  { id: 'lessons', icon: '🩸', label: '7 bài học xương máu' },
  { id: 'a', icon: '📄', label: 'Phiếu A — Đề bài tổng' },
  { id: 'b', icon: '🗂️', label: 'Phiếu B — Input chi tiết' },
  { id: 'c', icon: '⏱️', label: 'Phiếu C — Timeline theo giây' },
  { id: 'd', icon: '🎨', label: 'Phiếu D — Hình & tiếng' },
  { id: 'e', icon: '✅', label: 'Phiếu E — Nghiệm thu' },
  { id: 'examples', icon: '🧪', label: '2 ví dụ điền sẵn' },
  { id: 'golden', icon: '⚡', label: '5 câu hỏi vàng' },
  { id: 'kanban', icon: '📌', label: 'Ra đề & fix qua Kanban' },
];

export function VideoToolGuideView() {
  const go = (id: string) => document.getElementById(`vtg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="vtg">
      <style>{VTG_CSS}</style>
      <div className="vtg-shell">
        <aside className="vtg-toc">
          <div className="vtg-toc-brand"><span className="vtg-mark">📐</span> Ra đề tool video</div>
          <nav>
            {TOC.map(s => (
              <button key={s.id} onClick={() => go(s.id)} className="vtg-toc-item"><span>{s.icon}</span>{s.label}</button>
            ))}
          </nav>
        </aside>

        <main className="vtg-content">
          <header className="vtg-hero">
            <div className="vtg-hero-mark">📐</div>
            <h1>Ra đề bài tool video</h1>
            <p>
              Đúc kết từ 6 pipeline video đã chạy thật (quiz autogen, quiz XLSX, data-video, brand reel,
              video công thức Bazan, viral short-form). Điền đúng bộ phiếu bên dưới là bất kỳ ai cũng mô tả được
              input/output đủ chi tiết để đóng tool 1 lần là chạy — rồi đẩy đề qua Kanban để AI làm.
            </p>
          </header>

          {/* 1. CÔNG THỨC */}
          <section id="vtg-formula" className="vtg-sec">
            <div className="vtg-sec-head"><div className="vtg-sec-icon">🧠</div><div><div className="vtg-kicker">Nền tảng</div><h2>Công thức bất biến</h2></div></div>
            <div className="vtg-law">
              Mọi tool video = <b>TEMPLATE</b> (cấu trúc cố định, mô tả 1 lần) + <b>DATA</b> (nội dung thay đổi, nạp mỗi lần chạy).
            </div>
            <p className="vtg-intro">
              <b>Template</b> = thứ giống nhau giữa 100 video: bố cục, timing, font, màu, hiệu ứng, nhạc, intro/outro.{' '}
              <b>Data</b> = thứ khác nhau giữa 100 video: câu hỏi, tên món, clip quay, ảnh sản phẩm, con số.
              Ra đề bài tức là <b>mô tả template thật kỹ bằng con số + định nghĩa schema của data</b>.
              Thứ gì "lúc thế này lúc thế kia" mà không có quy tắc → chưa phải template, phải chốt lại trước khi làm tool.
            </p>
            <div className="vtg-div" />
          </section>

          {/* 2. PIPELINE 8 LỚP */}
          <section id="vtg-pipeline" className="vtg-sec">
            <div className="vtg-sec-head"><div className="vtg-sec-icon">🏭</div><div><div className="vtg-kicker">Khung xương</div><h2>Pipeline chuẩn 8 lớp</h2></div></div>
            <p className="vtg-intro">Mọi tool video đều đi qua 8 lớp này — chỉ khác chỗ nào tự động, chỗ nào thủ công. Đề bài phải trả lời được câu hỏi của từng lớp.</p>
            <div className="vtg-tablewrap">
              <table className="vtg-table">
                <thead><tr><th>#</th><th>Lớp</th><th>Câu hỏi phải trả lời</th><th>Ví dụ thực tế</th></tr></thead>
                <tbody>
                  <tr><td>1</td><td><b>INPUT</b></td><td>Nguồn nội dung là gì? Ai chuẩn bị? Định dạng gì?</td><td>Quiz: từ khóa theme. Bazan: folder clip .MOV quay iPhone.</td></tr>
                  <tr><td>2</td><td><b>CONTENT</b></td><td>Kịch bản AI sinh hay người soạn? Cấu trúc mấy khối?</td><td>Short-form: 4 khối Hook/Value/Payoff/CTA. Bazan: hook→bước→product→result.</td></tr>
                  <tr><td>3</td><td><b>ASSETS</b></td><td>Ảnh/icon/clip lấy đâu? Đặt tên thế nào? Cache không?</td><td>Quiz: AI gen icon + cache theo theme. Brand reel: kho asset có tag, 70% ảnh 30% video.</td></tr>
                  <tr><td>4</td><td><b>VOICE/AUDIO</b></td><td>TTS hay tiếng thật? BGM? SFX? Chuẩn âm lượng?</td><td>Quiz: TTS + 27 SFX. Bazan: giữ tiếng ASMR thật, -14 LUFS.</td></tr>
                  <tr><td>5</td><td><b>COMPOSITION</b></td><td>Mỗi loại cảnh bố cục ra sao? Timing từng giây? Chuyển cảnh gì?</td><td>Cross-fade chồng 0.5–0.8s, không bao giờ để màn đen trống.</td></tr>
                  <tr><td>6</td><td><b>RENDER</b></td><td>Tỷ lệ khung? Phân giải? FPS? Màu (grade/tonemap)?</td><td>9:16 1080x1920 social / 16:9 YouTube; iPhone HDR phải tonemap về SDR.</td></tr>
                  <tr><td>7</td><td><b>QA</b></td><td>Tự kiểm những gì trước khi giao?</td><td>Frame đen, frame đóng băng, LUFS, bitrate, có audio, đoạn câm.</td></tr>
                  <tr><td>8</td><td><b>OUTPUT</b></td><td>File gì? Metadata gì? Đăng đâu? Dọn gì sau upload?</td><td>MP4 + title/tags + 3 thumbnail; upload xong XÓA file render, GIỮ kho asset.</td></tr>
                </tbody>
              </table>
            </div>
            <div className="vtg-div" />
          </section>

          {/* 3. BÀI HỌC */}
          <section id="vtg-lessons" className="vtg-sec">
            <div className="vtg-sec-head"><div className="vtg-sec-icon">🩸</div><div><div className="vtg-kicker">Kinh nghiệm trả giá rồi</div><h2>7 bài học xương máu</h2></div></div>
            <ol className="vtg-steps">
              <li><span className="vtg-num">1</span><span><b>Phải có video mẫu.</b> Không có ≥3 video mẫu đang chạy tốt để "giải phẫu" thì chưa được ra đề. Mọi template tốt đều bắt đầu từ mổ xẻ video thật: tách frame, đo timing từng cảnh, transcribe lời đọc.</span></li>
              <li><span className="vtg-num">2</span><span><b>Mô tả bằng CON SỐ, không bằng tính từ.</b> "Hook hấp dẫn" = vô dụng. "Hook 0–3.5s: shot thành phẩm CÓ chuyển động + tên món 2 dòng, dòng 2 to đậm nghiêng trắng" = làm được.</span></li>
              <li><span className="vtg-num">3</span><span><b>Quy ước đặt tên file là một phần của đề bài.</b> Tool chạy được vì có quy ước cứng kiểu <code>C1.1.png</code> hay <code>RECIPES/1. Tên món/IMG_0001.MOV</code>. Không quy ước → tool không biết ảnh nào vào ô nào.</span></li>
              <li><span className="vtg-num">4</span><span><b>Chạy xong không lỗi ≠ video đúng.</b> Phải kiểm bằng "mắt máy": trích frame tại mốc chuyển cảnh, đo độ sáng, đo loudness. Đề bài phải kèm tiêu chí nghiệm thu ĐO ĐƯỢC.</span></li>
              <li><span className="vtg-num">5</span><span><b>Nguồn quay điện thoại phải khai báo.</b> iPhone quay HDR (HLG 10-bit) — không xử lý tonemap thì màu bệt. Hướng quay dọc/ngang, độ phân giải, fps của nguồn phải ghi rõ.</span></li>
              <li><span className="vtg-num">6</span><span><b>Âm thanh có chuẩn:</b> -14 LUFS (TikTok/IG) hoặc -16 (YouTube); BGM tự giảm khi có giọng nói; nhạc trending bản quyền KHÔNG nhúng vào file — chỉ gắn khi đăng trong app.</span></li>
              <li><span className="vtg-num">7</span><span><b>Bản nháp trước, bản đẹp sau.</b> Mọi tool phải có chế độ render draft (phân giải thấp) để duyệt nhanh, đạt rồi mới render full.</span></li>
            </ol>
            <div className="vtg-div" />
          </section>

          {/* PHIẾU A-E */}
          <Phieu id="a" icon="📄" kicker="Phiếu 1/5 · bắt buộc" title="Phiếu A — Đề bài tổng (1 trang)"
            intro="Điền phiếu này TRƯỚC. Dev/AI đọc xong xác nhận khả thi rồi mới điền tiếp B–E. Ô nào không điền được thì ghi dấu ? kèm lý do — đừng bịa; ô ? chính là câu hỏi cần chốt sớm, rẻ hơn sửa tool." text={PHIEU_A} />
          <Phieu id="b" icon="🗂️" kicker="Phiếu 2/5" title="Phiếu B — Mô tả INPUT chi tiết"
            intro="Schema từng trường dữ liệu + cây thư mục quy ước đặt tên file + khai báo nguồn quay. Đây là hợp đồng giữa người chuẩn bị input và tool." text={PHIEU_B} />
          <Phieu id="c" icon="⏱️" kicker="Phiếu 3/5 · quan trọng nhất" title="Phiếu C — Cấu trúc video theo giây"
            intro="Mở video mẫu, tua từng cảnh, ghi mốc giây vào bảng. Không tự đo được thì nhờ dev chạy scene-detect video mẫu rồi cùng điền. Phiếu này quyết định 80% chất lượng tool." text={PHIEU_C} />
          <Phieu id="d" icon="🎨" kicker="Phiếu 4/5" title="Phiếu D — Công thức hình & tiếng"
            intro="Màu, font, vùng an toàn chữ, grade màu + giọng đọc, BGM, SFX, chuẩn loudness. Cách tốt nhất: chụp 5–7 frame video mẫu, chú thích thẳng lên frame rồi đính kèm." text={PHIEU_D} />
          <Phieu id="e" icon="✅" kicker="Phiếu 5/5" title="Phiếu E — Nghiệm thu (Definition of Done)"
            intro="Tool được coi là XONG khi qua hết bảng này trên 3 bộ input thật khác nhau — không phải input demo của dev." text={PHIEU_E} />

          {/* VÍ DỤ */}
          <section id="vtg-examples" className="vtg-sec">
            <div className="vtg-sec-head"><div className="vtg-sec-icon">🧪</div><div><div className="vtg-kicker">Bắt chước theo</div><h2>2 ví dụ điền sẵn</h2></div></div>
            <div className="vtg-excard">
              <h3>Ví dụ 1 — Quiz video (kiểu Quizzlee)</h3>
              <ul>
                <li><b>A:</b> YouTube, 5 video/ngày, tự chạy theo theme. Input = 1 từ khóa theme ("animals") + số câu (10). Output = MP4 16:9 1080p 3–5 phút + 3 thumbnail + title/desc/tags.</li>
                <li><b>Cố định:</b> intro 20s, 16 loại câu hỏi, tỷ lệ 60% câu "tìm con khác" / 40% câu gia vị, bộ SFX, giọng TTS.</li>
                <li><b>Thay đổi:</b> theme → AI sinh câu hỏi + gen icon (cache theo theme).</li>
                <li><b>C:</b> mỗi câu = [hỏi 10s đếm ngược + tick] → [reveal 3s + chime]; drumroll trước đáp án.</li>
                <li><b>E:</b> có draft 960x540 duyệt trước bản full.</li>
              </ul>
            </div>
            <div className="vtg-excard">
              <h3>Ví dụ 2 — Video công thức đồ uống (kiểu Bazan)</h3>
              <ul>
                <li><b>A:</b> Reels/TikTok 9:16; mẫu = 3 final video của team. Input = folder clip .MOV theo quy ước <code>RECIPES/&lt;n&gt;. &lt;MÓN&gt;/IMG_*.MOV</code> + tên món + số bản (1–3). Output = MP4 1080x1920 ~18s → hàng chờ duyệt.</li>
                <li><b>B3:</b> iPhone HLG 10-bit → PHẢI tonemap HDR→SDR, không thì màu bệt.</li>
                <li><b>C:</b> 0–3.5s hook thành phẩm + tên món 2 dòng → bước pha cắt nhanh 0.7–1s/bước (ưu tiên cảnh đổ/múc nguyên liệu, tối đa 6) → clip sản phẩm chèn GIỮA (giây 8–10) → 3s cuối thành phẩm KHÔNG chữ.</li>
                <li><b>D:</b> giữ tiếng thật ASMR, không TTS; grade theo bộ số team; -14 LUFS; caption trắng bold giữa màn, shadow 3 lớp.</li>
                <li><b>AI làm:</b> phân loại clip, sinh caption bước, sinh tên món 2 dòng. <b>Người làm:</b> quay đúng quy ước folder, gõ tên món, duyệt draft.</li>
              </ul>
            </div>
            <div className="vtg-div" />
          </section>

          {/* 5 CÂU HỎI VÀNG */}
          <section id="vtg-golden" className="vtg-sec">
            <div className="vtg-sec-head"><div className="vtg-sec-icon">⚡</div><div><div className="vtg-kicker">Bản rút gọn</div><h2>5 câu hỏi vàng</h2></div></div>
            <p className="vtg-intro">Tool nhỏ cần đề nhanh? Tối thiểu trả lời được 5 câu này — thiếu 1 câu là đề chưa đạt.</p>
            <div className="vtg-prewrap">
              <CopyBtn text={GOLDEN_5} />
              <pre>{GOLDEN_5}</pre>
            </div>
            <div className="vtg-div" />
          </section>

          {/* KANBAN */}
          <section id="vtg-kanban" className="vtg-sec">
            <div className="vtg-sec-head"><div className="vtg-sec-icon">📌</div><div><div className="vtg-kicker">Vòng lặp làm việc</div><h2>Ra đề & fix liên tục qua Kanban</h2></div></div>
            <p className="vtg-intro">
              Đề bài không gửi qua chat/Zalo — <b>đẩy hết vào bảng Kanban</b> (mở từ menu, đường dẫn <code>/kanban</code>).
              Mỗi card là 1 đề bài hoặc 1 lỗi cần fix. AI đọc card (kèm ảnh đính kèm) và tự làm; bạn chỉ cần viết card cho đúng chuẩn.
            </p>
            <ol className="vtg-steps">
              <li><span className="vtg-num">1</span><span><b>Tạo card ở cột "Cần làm"</b> — tiêu đề ngắn gọn kiểu <i>"[ĐỀ BÀI TOOL VIDEO] Tool video công thức trà"</i> hoặc <i>"[FIX] Video quiz: chữ bị UI TikTok che"</i>. Dán nội dung Phiếu A (hoặc 5 câu hỏi vàng) vào phần mô tả.</span></li>
              <li><span className="vtg-num">2</span><span><b>Đính kèm ảnh</b> — bắt buộc với mọi card: screenshot video mẫu, frame bị lỗi (ghi rõ ở giây thứ mấy), cây thư mục input. AI đọc được ảnh trong card — 1 ảnh đúng chỗ đáng giá hơn 10 dòng mô tả.</span></li>
              <li><span className="vtg-num">3</span><span><b>Kéo card sang "🤖 Auto Fix"</b> (hoặc bấm nút đẩy tất cả card "Cần làm" + "Fix lỗi" sang Auto Fix). AI sẽ nhận card, chuyển sang "⚙️ Đang fix" khi bắt đầu làm.</span></li>
              <li><span className="vtg-num">4</span><span><b>Chờ kết quả</b>: card sang <b>"✅ Đã fix"</b> = AI làm xong, vào kiểm theo Phiếu E; card sang <b>"❌ Fix lỗi"</b> = AI làm không được, đọc ghi chú trong card xem thiếu thông tin gì, bổ sung rồi đẩy lại Auto Fix.</span></li>
              <li><span className="vtg-num">5</span><span><b>Kiểm xong kéo sang "Đã xong"</b> → quản lý duyệt lần cuối sang "Duyệt ✓". CHƯA đạt thì đừng kéo — tạo card fix mới mô tả cụ thể chỗ sai (xem bước 6).</span></li>
              <li><span className="vtg-num">6</span><span><b>Vòng lặp cải tiến:</b> mỗi lần video ra chưa giống mẫu → tạo card MỚI, mô tả đúng khác biệt: <i>"giây 3–5 chữ vào chậm hơn mẫu ~0.5s"</i>, <i>"màu bệt hơn mẫu, xem 2 frame đính kèm"</i>. Mỗi card 1 vấn đề — card gộp 5 vấn đề sẽ fix sót.</span></li>
            </ol>
            <div className="vtg-prewrap">
              <CopyBtn text={KANBAN_CARD_MAU} />
              <pre>{KANBAN_CARD_MAU}</pre>
            </div>
            <div className="vtg-note vtg-tip"><b>💡 Card tốt vs card tồi:</b> Tồi: <i>"video xấu, sửa lại đi"</i>. Tốt: <i>"So với mẫu (link), hook đang dài 6s — mẫu chỉ 3.5s; chữ tên món nằm sát đáy bị UI TikTok che, cần nâng lên ≥340px (ảnh đính kèm khoanh đỏ)"</i>. Card tốt = fix 1 lần trúng; card tồi = 3 vòng đi lại.</div>
            <div className="vtg-note vtg-warn"><b>⚠️ Lưu ý:</b> Card thuộc brand đang chọn — chuyển đúng brand trước khi tạo. Đề bài lớn (tool mới) cứ tạo card Phiếu A trước; AI sẽ hỏi lại các ô ? ngay trong card thay vì làm bừa.</div>
          </section>

          <footer className="vtg-foot">Easy Creative Hub · Đúc kết từ 6 pipeline video sản xuất thật · Bản đầy đủ: docs/video-tool-spec-templates.md</footer>
        </main>
      </div>
    </div>
  );
}

const VTG_CSS = `
.vtg { background:#f6f7f9; color:#1e2230; height:100%; overflow-y:auto; font-family:'Be Vietnam Pro',system-ui,sans-serif; }
.vtg-shell { display:grid; grid-template-columns:250px 1fr; max-width:1120px; margin:0 auto; }
.vtg-toc { position:sticky; top:0; align-self:start; height:100vh; overflow-y:auto; padding:22px 14px; border-right:1px solid #e6e8ee; background:#fff; }
.vtg-toc-brand { font-weight:800; font-size:15px; display:flex; align-items:center; gap:8px; margin-bottom:14px; color:#111; }
.vtg-mark { width:26px; height:26px; border-radius:8px; display:grid; place-items:center; color:#fff; font-size:14px; background:linear-gradient(135deg,#f59e0b,#ef4444); }
.vtg-toc nav { display:flex; flex-direction:column; gap:2px; }
.vtg-toc-item { text-align:left; font-size:13px; color:#4a5060; padding:8px 10px; border-radius:8px; border:none; background:none; cursor:pointer; display:flex; gap:8px; align-items:center; line-height:1.3; }
.vtg-toc-item:hover { background:#fdf1e3; color:#c2410c; }
.vtg-content { padding:0 26px 60px; min-width:0; }
.vtg-hero { padding:40px 0 24px; }
.vtg-hero-mark { width:54px; height:54px; border-radius:15px; display:grid; place-items:center; color:#fff; font-size:26px; background:linear-gradient(135deg,#f59e0b,#ef4444); box-shadow:0 10px 30px rgba(245,158,11,.35); margin-bottom:16px; }
.vtg-hero h1 { font-size:34px; font-weight:900; letter-spacing:-.02em; }
.vtg-hero p { margin-top:10px; color:#5a6070; font-size:16px; line-height:1.6; max-width:640px; }
.vtg-sec { padding:26px 0; }
.vtg-sec-head { display:flex; align-items:center; gap:14px; }
.vtg-sec-icon { width:46px; height:46px; border-radius:13px; display:grid; place-items:center; font-size:23px; background:#fff; border:1px solid #e6e8ee; box-shadow:0 2px 10px rgba(30,34,48,.05); flex-shrink:0; }
.vtg-kicker { font-size:11.5px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#ea580c; }
.vtg-sec h2 { font-size:22px; font-weight:800; letter-spacing:-.01em; }
.vtg-intro { margin-top:12px; color:#4a5060; font-size:15.5px; line-height:1.65; }
.vtg-intro code, .vtg-steps code, .vtg-excard code { background:#eef0f5; border-radius:5px; padding:1px 5px; font-size:.9em; }
.vtg-law { margin-top:16px; border-radius:14px; padding:18px 20px; font-size:17px; line-height:1.6; background:linear-gradient(135deg,#fff7ed,#fef2f2); border:1px solid #fdba74; color:#7c2d12; }
.vtg-steps { margin-top:16px; display:flex; flex-direction:column; gap:10px; list-style:none; padding:0; }
.vtg-steps li { display:flex; gap:12px; align-items:flex-start; font-size:15px; line-height:1.55; color:#2b3040; }
.vtg-num { flex-shrink:0; width:26px; height:26px; border-radius:50%; display:grid; place-items:center; font-size:13px; font-weight:800; color:#fff; background:linear-gradient(135deg,#f59e0b,#ea580c); }
.vtg-note { margin-top:16px; border-radius:12px; padding:13px 16px; font-size:14px; line-height:1.55; }
.vtg-tip { background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46; }
.vtg-warn { background:#fffbeb; border:1px solid #fde68a; color:#92400e; }
.vtg-div { margin-top:30px; height:1px; background:#e6e8ee; }
.vtg-tablewrap { margin-top:16px; overflow-x:auto; border:1px solid #e6e8ee; border-radius:12px; background:#fff; }
.vtg-table { width:100%; border-collapse:collapse; font-size:13.5px; }
.vtg-table th { text-align:left; padding:10px 12px; background:#faf5ef; color:#7c2d12; font-size:12px; letter-spacing:.04em; text-transform:uppercase; border-bottom:1px solid #e6e8ee; white-space:nowrap; }
.vtg-table td { padding:10px 12px; border-bottom:1px solid #f0f1f4; vertical-align:top; line-height:1.5; color:#2b3040; }
.vtg-table tr:last-child td { border-bottom:none; }
.vtg-prewrap { position:relative; margin-top:16px; }
.vtg-prewrap pre { background:#1e2230; color:#e6e8ee; border-radius:12px; padding:18px 16px; font-size:12.5px; line-height:1.6; overflow-x:auto; white-space:pre-wrap; font-family:'SF Mono',Menlo,Consolas,monospace; }
.vtg-copy { position:absolute; top:10px; right:10px; z-index:1; font-size:11.5px; font-weight:700; padding:6px 10px; border-radius:8px; border:1px solid rgba(255,255,255,.25); background:rgba(255,255,255,.1); color:#fff; cursor:pointer; }
.vtg-copy:hover { background:rgba(255,255,255,.22); }
.vtg-excard { margin-top:16px; border:1px solid #e6e8ee; border-radius:14px; background:#fff; padding:18px 20px; }
.vtg-excard h3 { font-size:16px; font-weight:800; margin-bottom:10px; }
.vtg-excard ul { list-style:none; display:flex; flex-direction:column; gap:8px; padding:0; }
.vtg-excard li { font-size:14px; line-height:1.6; color:#2b3040; padding-left:16px; position:relative; }
.vtg-excard li::before { content:'·'; position:absolute; left:2px; font-weight:900; color:#ea580c; }
.vtg-foot { margin-top:40px; padding-top:20px; border-top:1px solid #e6e8ee; color:#9aa0ad; font-size:13px; }
@media (max-width:820px) { .vtg-shell { grid-template-columns:1fr; } .vtg-toc { display:none; } }
`;

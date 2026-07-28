# CLAUDE.md — loveintea-studio

## Handoff phiên (BẮT BUỘC)
1. `docs/PROJECT_BRIEF.md` = ngữ cảnh chuẩn — hook tự bơm mỗi phiên. Verify số THẬT trước khi khẳng định trạng thái; KHÔNG tin docs cũ.
2. Trước khi kết phiên có thay đổi trạng thái: cập nhật "Cập nhật gần nhất" trong PROJECT_BRIEF (≤5 dòng) + commit + push.
3. Mã phiên: `LIT-<AREA>-<MMDD><seq>` (vd `LIT-FIX-0712A`). PREFIX = LIT (LoveinTea Studio). Gắn mã vào mỗi dòng cập nhật để truy vết phiên.

## LEARNING LOOP (BẮT BUỘC)
Sau MỌI sự cố/sai lầm/fix đáng nhớ: (a) root cause 1 dòng; (b) tổng quát hoá thành luật bỏ chi tiết dự án;
(c) append vào /Volumes/SSD/projects/kinh-nghiem-code-chung/projects/loveintea-studio/CHRONICLE.md;
(d) luật áp được ≥2 dự án → thêm vào laws/LUAT-TONG-QUAT.md;
(e) guard chặn được bằng code → xây NGAY + TEST bằng case thật (guard chưa test = ảo giác an toàn);
(f) cd kho kinh nghiệm → git add -A && git commit && git push NGAY.
⚠️ KHÔNG commit secret/password/token vào repo này — redact trước (gitleaks hook sẽ chặn).
TRƯỚC khi xây pipeline/hệ mới: đọc laws/LUAT-TONG-QUAT.md (đặc biệt section G cho AI-gen media) + grep playbooks/ theo domain.

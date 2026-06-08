# LoveinTea Studio — IA v2.1 & Flow từng màn hình

> Bản đồ thông tin tái cấu trúc quanh **vòng kín**: (Validate) → Brain → Plan → Create → Review → Publish → Engage → Learn → (về lại Brain).
> Mục tiêu: biến app từ *nhà máy đăng bài* thành *cỗ máy học* — mỗi vòng đăng làm vòng sau thông minh hơn.
>
> **File này = bản IA cấp màn hình.** Đọc cùng: `loveintea-studio-detail-spec.md` (đào sâu Plan/Create/Learn + state machine + master-prompt) · `loveintea-studio-casestudy-vietnat.md` (cổng validate đầu nguồn) · `loveintea-studio-flowmap.html` (visual). Xem `README` cho thứ tự đọc.
>
> **Cập nhật v2.1 (đồng bộ với các lượt sau):** thêm (a) **Theme Validation Gate** đứng trên Brief Builder; (b) **mode** (Click/Trust/Hybrid) trên Post Object — chọn bộ KPI chấm bài; (c) **campaign_stage** (validate→own→scale) bọc ngoài state machine cell-level; (d) cổng **social-credibility** trong Review Desk.

---

## 0. Năm nguyên tắc xương sống

1. **Brain 3 lớp** — Playbook (tĩnh) · Scoreboard (kết quả gần đây) · Rules Engine (wisdom đúc kết). Mỗi lần sản xuất chỉ đọc Rules + 10 entry Scoreboard gần nhất.
2. **Brief là điểm hội tụ** — không bài nào được sản xuất khi chưa có brief khai báo *một purpose + một ô variable*. Đây là thứ giết sự lặp lại.
3. **Copy và visual chạy hai track** — đọc cùng một brief, sản xuất riêng, hội tụ lại ở Review và ở post cuối.
4. **Review là cổng cứng** — không qua compliance + anti-AI + dedup thì không vào queue. AI pre-screen, người chốt.
5. **Learn khép vòng** — Analytics ghi verdict về Scoreboard và đề xuất rule; người duyệt; Rules Engine đổi → Plan/Create vòng sau đổi theo.
6. **Hai granularity bù nhau** — *campaign/theme* (Theme Validation Gate → stage validate→own→scale) bọc ngoài *cell/angle* (state machine Discovery→Harvest→…→Scale). Validate hướng TRƯỚC khi commit cell.
7. **Mode quyết thước đo** — mỗi angle mang mode Click/Trust/Hybrid; verdict chấm bằng bộ KPI của đúng mode (đo Trust bằng KPI Click = lỗi #1). Chi tiết ở detail-spec §3.
8. **Ba field kỷ luật nhận thức** (từ case study Vietnat) — mọi validation/brief mang: `reframes-locked` · `reverse-if` (điều kiện làm luật sai) · `what-this-does-NOT-prove` (giới hạn của chính nó).

---

## 1. Post Object — dữ liệu một bài mang theo suốt vòng đời

Đây là "hộ chiếu" của mỗi bài. Mọi màn đọc/ghi một phần của nó. Chính `variable_cell` + `rule_version` cho phép Analytics nói được *"bài thắng vì lý do gì"*.

```
Post {
  id, slot_id, brief_id, theme_id, status   // draft → in_production → in_review → queued → scheduled → published → measured
  mode                                       // click | trust | hybrid — chọn bộ KPI chấm bài
  campaign_stage                             // validate | own | scale (granularity theme)
  purpose                                    // educate | prove | demonstrate | social_proof | story | promote | mood
  variable_cell { segment, rtb, usp, format, context }
  copy   { hook, body, cta, hashtags, alt_text }
  visual { asset_ids[], refs_used[], logo_tag_ok, format_specific }
  attributes { person, mechanism, headline_type, motion, text_density }  // vector L4 cho attribute loop
  review { compliance_pass, anti_ai_pass, dedup_pass, social_cred_pass, reviewer, notes }
  schedule { channel[], time }
  results { reach, saves, shares, profile_visits, link_ctr, comments }
  verdict { value: WIN|LOSE|NEUTRAL, why }
  rule_version                               // bộ rule đang hiệu lực lúc sản xuất
}
```

---

## 2. BRAIN — bộ nhớ (4 màn)

### 2.1 Brand DNA → Playbook  *(đổi dây)*
- **Mục đích:** nguồn sự thật tĩnh — voice file, visual playbook, copy playbook, compliance gate, variable library. Nếu output nào mâu thuẫn file này, file này thắng.
- **Đọc:** —
- **Làm (người):** cập nhật quý/khi đổi SKU; chỉnh variable library (segment · RTB · USP · format · context).
- **Ghi:** Playbook (đọc bởi mọi màn Plan/Create/Review).
- **Kế tiếp:** Brief Builder, Content Workshop, Image Studio đều đọc từ đây.
- *Đổi dây:* gom 5 phần đang rời rạc về một nơi; thêm mục **compliance gate** với danh sách "VOICE never / VISUAL never / ALWAYS" (claim liver/detox đụng FDA structure/function).

### 2.2 Rules Engine  *(mới)*
- **Mục đích:** ≤30 rule đúc kết, có phân loại CRITICAL / IMPORTANT / EXPERIMENTAL / RETIRED, có version + changelog.
- **Đọc:** Scoreboard (để đề xuất rule mới).
- **Làm (người):** duyệt/bác đề xuất rule do Analytics đẩy lên; bump version.
- **Ghi:** rule_version hiện hành (mọi lần sản xuất dán version này vào Post).
- **Kế tiếp:** Brief Builder + Content Workshop + Image Studio đọc rule mỗi lần chạy.

### 2.3 Scoreboard  *(mới)*
- **Mục đích:** 50–100 post gần nhất + verdict WIN/LOSE/NEUTRAL + trường "tại sao" bắt buộc + baseline.
- **Đọc:** Analytics (ghi vào), Inbox (tín hiệu định tính).
- **Làm:** chủ yếu tự động ghi; người chỉ sửa verdict khi cần.
- **Ghi:** dữ liệu cho Rules Engine đề xuất rule.
- **Kế tiếp:** 10 entry gần nhất được Create đọc mỗi lần chạy; full đọc khi review quý.

### 2.4 Theme Validation Gate  *(mới — từ case study Vietnat)*
- **Mục đích:** cổng đầu nguồn, đứng TRÊN Brief Builder. Validate một Big Idea/series *trước khi* commit cell nào — tránh tiêu tiền sản xuất cho hướng chưa được xác nhận.
- **Đọc:** Playbook, Scoreboard (hướng tương tự đã thắng/thua?), competitor intel.
- **Làm (người + AI):** điền **Theme Validation Brief** (template ở case-study §4): Verdict → reframes-locked → staged plan → reverse-if thresholds → **what-this-does-NOT-prove** → caveats.
- **Ghi:** theme đã validate (gắn `theme_id` + `campaign_stage = validate`) → mở slot cho Brief Builder.
- **Kế tiếp:** không pass = không sinh cell. Pass → Brief Builder. Đây cũng là **đích của nhánh ESCAPE** khi state machine stuck (detail-spec §1.2 tầng business) — quay lên đây re-validate hướng, không regen thêm.

---

## 3. PLAN — pre-flight (2 màn)

### 3.1 Calendar & Strategy  *(đổi dây — tách phần "lập kế hoạch" khỏi Schedule)*
- **Mục đích:** cadence của kênh — số post/tuần, tỉ lệ format (feed/carousel/reel/story), khung giờ, beat chiến dịch theo tháng.
- **Đọc:** Playbook (through-line, pillar), Scoreboard (giờ/format nào đang thắng).
- **Làm (người):** chốt lịch tháng → sinh ra các *slot trống* (ngày/giờ/kênh/format mong muốn), chưa có nội dung.
- **Ghi:** danh sách slot.
- **Kế tiếp:** mỗi slot → Brief Builder.
- *Khác Schedule cũ:* Schedule chỉ còn là nơi *xem & dời* bài đã duyệt; việc *quyết đăng gì, nhịp nào* chuyển về đây.

### 3.2 Brief Builder  *(mới — mảnh ghép quan trọng nhất)*
- **Mục đích:** biến một slot trống thành một brief có chủ đích.
- **Đọc:** Playbook (variable library), Rules Engine, 10 entry Scoreboard gần nhất.
- **Làm (người/AI gợi ý):** chọn **một purpose** + **một ô variable** (segment · RTB · USP · format · context); hệ thống chặn trùng ô với các slot gần kề (tránh 5 bài "after dinner" giống nhau).
- **Ghi:** Post.brief_id, purpose, variable_cell, rule_version.
- **Kế tiếp:** brief fork sang Content Workshop (copy) **và** Image Studio (visual).

---

## 4. CREATE — generate (5 màn)

### 4.1 Content Workshop  *(giữ — đổi nguồn đọc)*
- **Mục đích:** track copy. Sinh caption theo brief.
- **Đọc:** brief, copy playbook, Rules Engine.
- **Làm (AI + người):** hook (one line, kiêm SEO) → USP bridge (claim-safe) → một CTA + hashtag layer. Theo skeleton đúng purpose, không một-khung-cho-tất-cả.
- **Ghi:** Post.copy.
- **Kế tiếp:** Review Desk (sau khi visual track xong).

### 4.2 Image Studio  *(giữ — ép reference-anchoring)*
- **Mục đích:** track visual. Sinh ảnh theo brief.
- **Đọc:** brief, visual playbook, Rules Engine, ảnh sản phẩm thật từ Image Library.
- **Làm (AI + người):** nạp ref sản phẩm thật (không để AI bịa sản phẩm/logo); ONE white logo tag; warm grade; **ảnh đúng format** (không crop 4:5 thành reel).
- **Ghi:** Post.visual (asset_ids, refs_used, logo_tag_ok, format_specific).
- **Kế tiếp:** Review Desk.

### 4.3 Image Library  *(giữ)*
- **Mục đích:** kho ảnh có tag (sản phẩm, scene, format, logo-tag-ok).
- **Đọc/Ghi:** Image Studio lấy ref vào, ghi asset mới ra.
- **Kế tiếp:** nguồn ref cho mọi job visual.

### 4.4 Job Queue  *(giữ)*
- **Mục đích:** chạy bất đồng bộ các job gen ảnh/video; retry; log lỗi.
- **Đọc:** hàng job từ Image Studio.
- **Ghi:** trạng thái job, asset hoàn tất về Library + Post.
- **Kế tiếp:** khi xong → Post sẵn sàng cho Review.

### 4.5 Blog Factory  *(giữ)*
- **Mục đích:** track kênh **pull/SEO** (bài dài), tách khỏi track social push.
- **Đọc:** brief (biến thể long-form), Playbook, từ khóa.
- **Ghi:** bài blog (có schema/SEO).
- **Kế tiếp:** Review Desk (gate dùng chung) → publish kênh web.

---

## 5. REVIEW — cổng cứng (1 màn)

### 5.1 Review Desk  *(mới — dựng từ nút duyệt sẵn có)*
- **Mục đích:** chốt chất lượng trước khi vào queue. Không qua = không đăng.
- **Đọc:** Post (copy + visual), compliance gate, anti-AI checklist.
- **Làm:** AI pre-screen 4 cổng — **compliance** (claim FDA, "never say"), **anti-AI** (da nhựa, chữ méo, tĩnh chết), **dedup** (trùng purpose/ô/caption với slot gần kề), **social-credibility** (từ Vietnat: "một derm/người am hiểu có stitch-debunk câu này không?" — gác độ tin, không chỉ keyword) — người bấm duyệt.
- **Ghi:** Post.review (pass/fail + reviewer); status → queued (đạt) hoặc trả về Create (không đạt).
- **Kế tiếp:** đạt → Content Queue; không đạt → Content Workshop / Image Studio (kèm note lý do).

---

## 6. PUBLISH — execute (3 màn)

### 6.1 Content Queue  *(giữ)*
- **Mục đích:** chứa bài đã duyệt, chờ gán slot.
- **Đọc:** Post status=queued.
- **Ghi:** —
- **Kế tiếp:** Schedule.

### 6.2 Schedule  *(đổi dây — chỉ còn xem & dời)*
- **Mục đích:** gán bài đã duyệt vào slot từ Calendar; xem lịch; dời.
- **Đọc:** Content Queue, slot từ Calendar & Strategy.
- **Ghi:** Post.schedule (channel, time); status → scheduled → published; **dán lineage** (brief_id, rule_version) lên bài đã đăng.
- **Kế tiếp:** sau đăng → Analytics theo dõi; Inbox nhận tương tác.
- *Khác bản cũ:* không còn chứa post "Test..." hay nội dung chưa duyệt — mọi thứ vào đây đều đã qua Review Desk.

### 6.3 FB Setup  *(giữ)*
- **Mục đích:** kết nối token/quyền FB+IG.
- **Đọc/Ghi:** cấu hình kênh.
- **Kế tiếp:** Schedule dùng để đẩy bài.

---

## 7. ENGAGE — post-publish (1 màn)

### 7.1 Inbox & Comments  *(giữ — thêm 1 dây)*
- **Mục đích:** trả lời comment/inbox theo voice.
- **Đọc:** Playbook (voice, reply CTA library).
- **Làm (AI gợi ý + người):** trả lời; **gắn cờ tín hiệu** (câu hỏi lặp, phản đối, hiểu nhầm USP).
- **Ghi:** đẩy tín hiệu định tính về Scoreboard (làm giàu trường "tại sao").
- **Kế tiếp:** Scoreboard → Rules Engine.

---

## 8. LEARN — khép vòng (1 màn)

### 8.1 Analytics  *(đổi dây — hết là ốc đảo)*
- **Mục đích:** đo + quy nhân-quả + đẩy bài học ngược vào Brain.
- **Đọc:** kết quả từ FB/IG, Post.lineage.
- **Làm:** auto-suggest verdict (WIN/LOSE/NEUTRAL) theo baseline **của đúng mode** (Click vs Trust dùng bộ KPI khác — detail-spec §3.1); người xác nhận + điền "tại sao"; roll-up theo `attributes` vector (bias 70% attribute thắng + 30% explore); sau ≥5 entry mới → check pattern → **đề xuất rule** (kèm field `reverse-if`).
- **Ghi:** Post.results + verdict → Scoreboard; đề xuất rule → Rules Engine (chờ người duyệt).
- **Kế tiếp:** Rules Engine cập nhật → Brief Builder vòng sau đọc rule mới. Vòng khép.

---

## 9. Skill nào cấp "bộ não" cho màn nào

| Màn | Skill trong thư viện |
|---|---|
| Brand DNA → Playbook | `brand-system`, `brand-graphic-design`, `brand-image-builder` |
| Rules Engine + Scoreboard + Brief Builder | `o3-performance-content`, `agent-pipeline-architect` |
| Calendar & Strategy | `marketing-strategy`, `mkt-campaign-plan` |
| Content Workshop | `ecom-copywriting` |
| Image Studio + Library | `brand-image-builder` (visual playbook) + Higgsfield |
| Blog Factory | `ecom-seo-growth` |
| Review Desk | `marketing:brand-review` + compliance gate của `brand-image-builder` |
| Inbox & Comments | `ecom-copywriting` (reply), `koc-influencer-planner` (khi mở rộng KOC) |
| Analytics | `analytical-report` + Win Score của `o3-performance-content` |
| Toàn bộ orchestration | `agent-pipeline-architect` (thiết kế) · `system-thinker` (meta) |

---

## 10. Rollout đề xuất (đừng build cùng lúc)

- **Phase 0 (tuần 0):** Theme Validation Brief template + 3 field kỷ luật nhận thức (reframes-locked · reverse-if · what-this-does-NOT-prove). *Rẻ nhất, chặn sản xuất sai hướng.*
- **Phase 1 (tuần 1–2):** Scoreboard + Rules Engine + nối Analytics → Scoreboard. *Bật vòng kín.*
- **Phase 2 (tuần 3–4):** Brief Builder + tách Calendar & Strategy khỏi Schedule. *Diệt lặp lại.*
- **Phase 3 (tháng 2):** Review Desk 4 cổng (thêm social-credibility) + lineage trên Post. *Chặn bài lỗi/claim rủi ro.*
- **Phase 4 (tháng 3+):** Research/Intel feed (competitor + trend qua Claude in Chrome) nuôi Playbook; campaign-stage wrapper; mở rộng KOC.

> Giới hạn cần nói thẳng: vòng Học chỉ có nghĩa sau ~15–20 post đủ data để có baseline; trước đó Rules chạy bằng best-practice ngành. AI review không thay được mắt người cho visual — Review Desk là pre-screen + người chốt, không full-auto.

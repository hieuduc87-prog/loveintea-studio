# LoveinTea Studio — Bộ thiết kế hệ thống automation (README / index)

> Đây là điểm vào của cả bộ. Hệ thống = một **cỗ máy content vòng kín** cho LoveinTea (trà thảo mộc Việt, bán US, IG + FB), biến app "nhà máy đăng bài một chiều" thành "cỗ máy học".
> Ngày đồng bộ: 2026-06-08.

---

## 1. File map — đọc gì, khi nào

| File | Vai trò | Đọc khi |
|---|---|---|
| **README.md** | Điểm vào + kiến trúc 1 trang + rollout (file này) | Đầu tiên |
| **loveintea-studio-flowmap.html** | **Visual** — setup cứng · master flow · kanban · 7 detail flow. Mở trình duyệt. | Muốn nhìn tổng thể nhanh |
| **loveintea-studio-IA-v2.md** *(v2.1)* | IA cấp **màn hình** — 7 nhóm, Post Object (data model), đọc/làm/ghi từng màn | Khi build từng màn |
| **loveintea-studio-detail-spec.md** | Đào sâu **Plan / Create / Learn** + state machine + escape-trap + audit-on-upload + master-prompt (bản trà) | Khi build logic vận hành |
| **loveintea-studio-casestudy-vietnat.md** | **Theme Validation Gate** + 3 field kỷ luật nhận thức + cross-validation | Khi build tầng thượng nguồn |

**Nguồn (do bạn cung cấp, hệ chỉ đọc):** `social-growth-playbook-2026.md` · `loveintea-brand-application.md` · `brand-voice.md` v1.1 · `content-library.md` §14 · Communication Direction · gói Ads Creative (`00_brand_truth` / `01_master_skill` / `02_prompt_writing`).

**Thứ tự đọc lần đầu:** README → flowmap.html (nhìn) → IA-v2 (màn hình) → detail-spec (logic) → case-study (thượng nguồn).

---

## 2. Kiến trúc một trang

**Spine vòng kín, hai granularity bù nhau:**

```
(thượng nguồn, cấp THEME)        (cấp CELL/ANGLE, băng chuyền)
Theme Validation Gate  →  Plan  →  Create  →  Review  →  Publish  →  Engage  →  Learn ─┐
   ↑ reframes-locked         (allocation   (copy‖visual) (4 cổng)   (IG/FB)   (inbox)  (KPI    │
     reverse-if               + brief)                                                  theo   │
     what-NOT-prove                                                                     mode)  │
        └───────────────── ESCAPE khi stuck ──────────────── Win Score + Rules + Allocation ◄─┘
```

**Bốn tầng nền (Brain) — đọc mỗi vòng, không bao giờ test:** Playbook (Identity Lock: tag trắng · màu · voice · claim-safe) · Scoreboard (verdict gần đây + "tại sao") · Rules Engine (≤30 rule, mỗi rule có `reverse-if` + version) · Theme Validation Gate (validate hướng trước khi commit cell).

**Băng chuyền cell (state machine):** `Explore → Discovery → Harvest → Exploit → Breakout → Scale` (+ `Retire/Refresh`). Đơn vị chạy = **angle** (`variable_cell`), không phải post. Mỗi angle mang **mode** (Click/Trust/Hybrid) quyết bộ KPI chấm nó.

**Bọc ngoài (campaign-stage):** ① Validate cheap → ② Own whitespace → ③ Scale & defend.

**Năm điều khoá (cross-validate qua Vietnat — generalize, đáng khoá):**
1. Vòng kín có Learn, không một chiều.
2. Brief là điểm hội tụ trước sản xuất.
3. Review là cổng cứng (4 lớp: compliance · anti-AI · social-credibility · dedup/continuity).
4. Hai track copy/visual riêng, hội tụ ở brief + asset.
5. Bằng chứng tỉ lệ với cam kết — vào Discovery rẻ, lên Scale/Critical-rule đắt.

---

## 3. Mapping sang app hiện có

| Nhóm vòng | Màn trong app | Trạng thái |
|---|---|---|
| Brain | Brand DNA→Playbook · Rules Engine · Scoreboard · Theme Validation Gate | 1 đổi dây, 3 mới |
| Plan | Calendar & Strategy · Brief Builder | 1 đổi dây, 1 mới |
| Create | Content Workshop · Image Studio · Image Library · Job Queue · Blog Factory | giữ |
| Review | Review Desk | mới (4 cổng) |
| Publish | Content Queue · Schedule · FB Setup | 1 đổi dây |
| Engage | Inbox & Comments | giữ + 1 dây |
| Learn | Analytics | đổi dây (nối ngược Brain) |

---

## 4. Rollout (đừng build cùng lúc)

- **Phase 0:** Theme Validation Brief + 3 field kỷ luật. *Rẻ nhất, chặn sản xuất sai hướng.*
- **Phase 1:** Scoreboard + Rules Engine + nối Analytics→Scoreboard. *Bật vòng kín.*
- **Phase 2:** Brief Builder + tách Calendar khỏi Schedule + slot allocation §4.8. *Diệt lặp lại.*
- **Phase 3:** Review Desk 4 cổng + lineage trên Post + mode-split KPI ở Learn. *Chặn lỗi/claim.*
- **Phase 4:** Research/Intel feed nuôi Playbook · campaign-stage wrapper · lane paid (Advantage+) · mở rộng KOC.

> Ưu tiên thứ tự hơn vẻ ngoài: dựng Brief Builder/Review trước khi có Scoreboard/Rules thì app đẹp hơn nhưng vẫn "tĩnh". Phase 1 rẻ mà bật toàn bộ giá trị về sau.

---

## 5. Caveat thành thật (gộp)

- **Ngưỡng số là default ngành** (baseline×1.3/×3, ~50 event/tuần) — thay bằng baseline thật sau **15–20 post**. Trước đó Rules chạy bằng best-practice.
- **AI review không thay mắt người** cho visual — Review Desk là pre-screen + người chốt.
- **Cross-validation Vietnat là cross-category, chưa cross-context** (hai brand đều DTC Việt/US/founder-led) — đủ để khoá nguyên tắc, không đủ tuyên bố phổ quát.
- **HEX màu nước per-SKU** trong master-prompt là gợi ý — điền chính xác từ ảnh sản phẩm thật.
- **Tier SKU + RTB score + USP phrasing** (mục ⚠️ trong brand-application) là giả định chưa validate — chốt theo sales data thật.
- Content fix được hook/message/funnel, **không fix được** vấn đề offer/giá/PMF — phân biệt rõ ở detail-spec §1.2 tầng 4.

---

## 6. Changelog

- **2026-06-08 — bản đồng bộ đầy đủ.**
  - IA → v2.1: thêm Theme Validation Gate (Brain), `mode`/`theme_id`/`campaign_stage`/`attributes` vào Post Object, cổng social-credibility (Review), Phase 0 rollout.
  - Flow map → v1.1: thêm node Validate (master), band campaign-stage (kanban), detail 3.7 Theme Gate, Review 4 cổng, nhánh ESCAPE.
  - Thêm detail-spec (Plan/Create/Learn sâu + master-prompt bản trà) và case study Vietnat.
- Lượt trước: state machine (đơn vị = angle), mode-split, two-lane organic/paid, slot allocation §4.8.

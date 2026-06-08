# LoveinTea Studio — Detail Spec v3
### Đào sâu 3.1 Plan · 3.2 Create · 3.4 Learn + tích hợp gói Ads Creative 4-Layer

> Bổ sung chi tiết cho ba block còn mỏng trong flow map, và hấp thụ gói skill `00_brand_truth` / `01_master_skill` / `02_prompt_writing`.
>
> **Hai đối chiếu phải nhớ:**
> 1. Gói skill gốc là **paid-ads + template coffee**. L2 thinking chain + L1 guardrails + HARD LOCK prompt áp cho **cả organic lẫn paid**; vòng L4 attribute (CPC/cheap-click) chỉ áp cho **lane paid** — lane organic dùng filter tương đương *sends+saves per reach*.
> 2. Ratio: gói nói "1:1 cho feed ads" — đúng cho **static feed ad**; còn format chủ đạo vẫn theo playbook (**Reels 9:16 first**, 4:5 phụ, không crop).

---

## 1. ĐÀO SÂU 3.1 — PLAN: gate prove, thoát bẫy, audit khi upload plan

### 1.1 "Ai prove thì đi tiếp" — gate bằng bằng chứng phân tầng

Nguyên tắc một câu: **bằng chứng tỉ lệ với cam kết.** Càng đòi nhiều slot/tiền/độ bền (rule Critical) thì bar bằng chứng càng cao. Không gì lên cấp bằng khẳng định — chỉ bằng data đúng giai đoạn.

| Chuyển | Cái gì phải prove | Bằng chứng (theo mode) | Sàn mẫu | Ai quyết |
|---|---|---|---|---|
| `seed` → Discovery | Đây là *giả thuyết hợp lệ* | Defensible rationale + predicted Win Score + claim-safe + chưa bão hoà + mới so Concept Log | Không cần data | AI brief + người |
| `harvest` → Exploit | Angle thật sự cộng hưởng | **Click:** sends/reach + non-follower reach + completion ≥ baseline×1.3 · **Trust:** saves/reach + comment chất lượng ≥ baseline×1.3 | ≥2 post · ≥ cửa sổ thời gian · ≥ reach tối thiểu | Win Score + người |
| `isolate` → Breakout | Một *execution* bứt phá thật (không may rủi) | post ID ≥ baseline×3 **VÀ** sàn tuyệt đối (saves/sends thật, không chỉ %) **VÀ** qua cheap-click / cheap-engage filter | 1 post ID + reach đủ đọc | Auto-flag + người |
| `scale` → Paid | Đáng đổ tiền | Breakout giữ ≥7 ngày **hoặc** người duyệt chi → vào paid; rồi prove tiếp = thoát learning (~50 event/tuần) + CPC/CPA dưới ngưỡng | ~50 event/tuần/campaign | Người (chi tiền) |
| Rule mới → Critical | Đáng thành luật cố định | **Lặp lại thắng qua ≥N cell** (không 1 lần) + Pearson correlation dương | ≥3 cell độc lập | Người duyệt Rules |

> Hệ quả: Discovery vào rẻ (giả thuyết là đủ) — nên cứ test rộng. Scale và Critical-rule đắt — đòi data lặp lại. Đây là cái chống "thấy 1 post viral rồi all-in" trên account nhỏ.

### 1.2 Làm đúng công thức mà KHÔNG cải thiện — stuck detector + thang chẩn đoán

**Định nghĩa stuck (trigger nhánh ESCAPE, không chạy chu kỳ thường nữa):** ≥3 chu kỳ liên tiếp mà (a) không angle nào đạt WIN **và** (b) xu hướng KPI leading không cải thiện.

**Thang chẩn đoán — đi từ rẻ đến đắt, DỪNG ở tầng fail đầu tiên** (đừng sửa tầng dưới khi tầng trên hỏng):

| # | Tầng | Dấu hiệu fail | Sửa gì |
|---|---|---|---|
| 1 | **HOOK** | non-follower reach / 3s-rate thấp; organic: sends+saves/reach thấp; paid: CPC đắt | **Đổi CONCEPT** (chạy lại L2 thinking chain) — KHÔNG sửa execution |
| 2 | **MESSAGE** | chú ý có (reach/3s ổn) nhưng không save/comment/profile-visit | Đổi **RTB / mechanism / proof-stack**, giữ hook |
| 3 | **FUNNEL** | engagement tốt + click rẻ (đúng người) nhưng không ATC/order | Sửa **landing / offer / retarget** — *ngừng* đốt thêm creative |
| 4 | **BUSINESS** | mọi tầng trên ổn vẫn không bán | Vấn đề **offer / giá / product-market-fit** — content KHÔNG fix được → **escalate** |

> Tầng 4 là điều thành thật nhất hệ thống phải nói được: phân biệt *content problem* vs *business problem*. Nếu hook đúng người mà vẫn không mua, content đã làm xong việc của nó — đừng tiếp tục regen.

**Khi stuck toàn portfolio (không phải 1 angle):**
1. **Dừng iterate execution** — crank thêm biến thể = Originality penalty + lãng phí.
2. **Chạy lại Explore SOP 6.5** tìm *mechanism* thật mới (không clone visual đối thủ).
3. **Chất vấn giả định Brand Truth** — các mục ⚠️ (tier SKU, RTB score, USP phrasing) là *giả định chưa validate*. Stuck là tín hiệu nên test lại **chính giả định**, không test thêm execution của giả định sai.
4. **Inject plan mới** như nguồn giả thuyết tươi (→ 1.3).

### 1.3 Audit khi plan mới được upload — rủi ro, vi phạm, và cách "vào" để thoát bẫy

Plan mới (như chính 4 file vừa upload) là cách hợp lệ để phá local-optimum **khi stuck** — nhưng phải qua audit và vào có kiểm soát, không ghi đè data đã thắng bằng niềm tin.

**Checklist audit (một số = FLAG, một số = BLOCK):**

| Điểm kiểm | Rủi ro / vi phạm | Hành động |
|---|---|---|
| **Compliance FDA** | health claim liver/detox/heart/cure/giảm cân | **BLOCK** |
| **Identity Lock (§7.1)** | plan đề xuất test/đổi tag·màu·voice·typography | **REJECT** — không bao giờ test |
| **Mode-mixing** | đo Trust bằng KPI Click; trộn Click+Trust trong 1 cell | FLAG (lỗi #1) |
| **Giả định = sự thật** | tier SKU chưa có sales data, RTB score, USP phrasing trình bày như đã chốt | FLAG "assumed → must validate" |
| **Saturation / Originality** | angle nhiều đối thủ đã làm; crank biến thể của 1 concept | FLAG (penalty Andromeda/Originality) |
| **Lane confusion** | đẩy volume test cao lên profile organic | FLAG → off-grid paid |
| **Product-proof thiếu** | brief không ép §D (sản phẩm visible, đọc được, tag trắng) | FLAG "đẹp nhưng không bán / không ra brand" |
| **Attribution naivety** | hứa ROAS nhân-quả khi attribution mờ | FLAG → dùng blended/MER |
| **Stat reliability** | hành động trên outlier 1 post; account nhỏ; thiếu sàn tuyệt đối | FLAG |
| **Scope honesty** | kỳ vọng content fix vấn đề offer/giá/sản phẩm | FLAG (out of scope — xem 1.2 tầng 4) |

**Cách plan mới VÀO hệ (đây là phần nối vòng học để thoát bẫy):**
1. Mọi claim mới/đổi → vào Rules Engine ở **tier Experimental**, allocation thấp, **lấy từ test budget — KHÔNG cắt slot của proven winner**.
2. **Đối chiếu Scoreboard:** chỗ plan mâu thuẫn data đã có (plan bảo làm X, Scoreboard cho thấy X-type LOSE) → **FLAG xung đột**, không silently overwrite.
3. Claim Experimental phải **prove theo 1.1** mới lên Important/Critical và mới được surplus slot.
4. → Plan mới = kênh inject giả thuyết tươi khi bí, nhưng bị gate bằng bằng chứng. Đây là cách thoát bẫy mà không đập vỡ những gì đã học.

---

## 2. ĐÀO SÂU 3.2 — CREATE: loại content, logic chọn, thứ tự check, master-prompt

### 2.1 Taxonomy content — ba trục độc lập (O3 V2)

Đừng gộp. Một angle = chọn độc lập trên ba trục:

**Trục FORMAT (container, vai trò CỐ ĐỊNH — playbook 4.4):**

| Format | Việc | KPI đo nó | Đo bằng reach? |
|---|---|---|---|
| Reel B-roll / talking-head | reach / discovery | completion · sends/reach · non-follower reach | Có |
| Carousel | save / chiều sâu / convert warm | saves/reach · swipe-through · comment chất lượng | Một phần |
| Static | **anchor nhận diện** (≤1/tuần) | vai trò cohesion 9-tile | **KHÔNG** |
| Story | mô liên kết · test nhanh · hỏi đáp | replies · sticker taps · sequence completion | Không |
| FB Group post | community / MSI | comment ≥10 từ · share · dwell | Không |
| Video 60s+ (FB) | heritage/origin depth | watch time | Một phần |
| Broadcast | core fans / loyalty | open · response | Không |

**Trục MECHANISM (L3 menu — chọn 1/creative):** testimonial · transformation (CHỈ mood/energy) · visual metaphor · proof/transparency · comparison (KHÔNG nêu tên) · ritual demo · heritage/origin · humor/nhân hoá · benefit-direct (risk policy cao nhất).

**Trục MODE → recipe:** Click = recipe 5.1 (craving hook, proof nhẹ, Reel B-roll) · Trust = recipe 5.2 (doubt hook, proof xếp lớp, Carousel) · Hybrid = theo funnel-stage (cold→Click, warm→Trust).

### 2.2 Logic chọn — cho một brief, chọn gì

Brief mang: purpose + variable_cell + mode + channel + funnel-stage. Chọn theo thứ tự:
1. **Mode + funnel-stage → recipe** (Click cold / Trust warm / Hybrid theo stage).
2. **Recipe → format ưu tiên** (Click→Reel; Trust→Carousel) — nhưng tuân **format-ratio governor**: cửa sổ thiếu loại nào thì slot tới ưu tiên loại đó.
3. **Mechanism từ menu**: hợp mode (Trust→proof/testimonial/transformation; Click→metaphor/ritual/humor) + **diversity** (max 30% cùng mechanism/batch) + **Concept Log** (không lặp SKU×mechanism×device).
4. **Visual device** (split-punchline · mid-action hero · ingredient grid · icon-pair · monochrome SKU world · footer signature) — chọn theo scroll-stop cần + chưa dùng gần đây.
5. **Channel → register/độ dài**: IG ngắn/craving; FB dài + conversation-starter (kết bằng câu hỏi mời comment).
6. **Diversity constraint batch ≥8:** max 40% cùng format · max 30% cùng mechanism · min 2 creative/SKU · 1–2 con/batch có MẶT NGƯỜI · không trùng (SKU × mechanism × device).

### 2.3 Thứ tự check — pipeline chuẩn, fail cổng nào quay lại cổng đó (KHÔNG đẩy tiếp)

```
1. L2 THINKING CHAIN (B1→B5)         concept TRƯỚC pixel
     gate: concept MỚI (Concept Log) + headline từ B3 (pain/moment), KHÔNG từ B1 (liệt kê tác dụng)
2. PRE-FLIGHT IMAGE Q1–Q5            who/when · problem state · outcome state · show-not-tell · scroll-stop
3. COMPOSE PROMPT                    reference-first + 5-component + 9 phần + HARD LOCKS (2.4)
4. HALLUCINATION (5) + ANTI-PATTERN (5)
5. PASS³                             Product-ID 1.5s · Benefit signaled · Scroll-stop   → fail = rewrite prompt
6. GEN → L1 QC 7 điểm                product-proof §D từng ảnh · tag trắng · ratio · compliance · palette · composite logo nếu lỗi · premium bar  → fail = regen/composite
7. CAPTION PRE-FLIGHT Q1–Q5 → caption template
8. → REVIEW DESK (cổng 3 lớp) → Content Queue
```

Quy tắc: concept fail → về bước 1; ảnh fail QC → regen/composite (đừng cố regen 5 lần text nhỏ — composite asset thật đè). Không "để tạm rồi đăng".

### 2.4 MASTER-PROMPT skill — bản LoveinTea (instance của `02_prompt_writing`)

**§D Product-proof non-negotiables — bản trà (đổi từ coffee):**
1. **Túi trà pyramid PHẢI thấy** trong mọi creative, kể cả lifestyle — không cốc/ly trống.
2. **Lá thật bung trong nước nóng** (whole-leaf bloom) — chứng minh Uconv "real whole leaves, in one tea bag".
3. **MỘT tag trắng logo LoveinTea**, đọc rõ — AI render lỗi → **composite tag thật đè** (không bao giờ đỏ/kraft).
4. **Màu nước đúng đặc trưng từng SKU** (bảng HARD LOCK dưới).
5. **Claim-safe**: theme/moment, không liver/detox/heart.

**Per-SKU BEVERAGE HARD LOCK (⚠️ HEX gợi ý — điền chính xác từ ảnh sản phẩm thật, Brand Truth §C/§I):**

| SKU | Màu nước (HEX gợi ý) | Vessel | Cue |
|---|---|---|---|
| Hibiscus | deep ruby `#9E1B32` | tall clear glass + đá, backlit | iced / màu / Click |
| Ginger | warm amber `#C8841E` | clear glass mug, steam | 3pm reset |
| Dandelion | pale gold `#D9B85A` | clear glass, slow-morning light | clean ritual |
| Peppermint | light green-gold `#BFCF7A` | clear glass | after-meal |
| Lemon Balm | soft yellow-green `#C7D17E` | clear glass, ánh chiều dịu | calm |
| Nighty Night | warm amber-brown `#A86B2E` | ceramic/clear mug, dim evening | sleep/wind-down |

**HARD LOCK clauses (copy-paste, đã điền hướng trà):**
- **PYRAMID-BAG + TAG LOCK:** "preserve the pyramid tea bag shape and the single white LoveinTea logo tag exactly as reference; tag text must remain legible — if not, increase size, never redraw."
- **SATURATION LOCK:** màu bao bì/tag VIVID, không nhạt theo nền; tag trắng không bị ám màu nền.
- **MIN-SIZE 30%:** túi/tag chiếm ≥30% chiều dài khung; front-facing.
- **STRICT PROPS LIST:** chỉ props liệt kê; **no random flowers/candles/books** (bẫy wellness flat-lay).
- **BEVERAGE COLOR + VESSEL:** theo bảng per-SKU; cấm "a cup of tea" chung chung / "empty mug".
- **ANTI-FLAG:** "NO supplements, NO pills, NO dropper/serum props, NO medical implications" — **rất quan trọng** vì tea+wellness dễ dính health-claim classifier.

**Reference-first:** mọi prompt có sản phẩm → đính ảnh túi pyramid thật + tag trắng (§I) đứng TRƯỚC text (edit-mode Nano Banana/Gemini).

**Policy patterns đặc biệt cho trà:** từ "detox/sleep aid/calm cure" trong text-overlay → đẩy xuống caption mềm hoá; dropper/supplement props → bỏ; wellness ritual flat-lay → top-down chỉ khi toàn nguyên liệu thật + sản phẩm có label.

> Nên tách thành file `02b_prompt_writing_loveintea.md` nếu muốn dùng như skill độc lập trong Project.

---

## 3. ĐÀO SÂU 3.4 — LEARN: tách theo mục tiêu, content type, O3 insight, KPI

### 3.1 KPI tree — theo MỤC TIÊU (40/30/20/10) × CONTENT TYPE × MODE

| Pillar / mục tiêu | Mode | Leading (mỗi post) | Mid | Lagging (cohort) |
|---|---|---|---|---|
| **Reach/Craving 40%** | Click | 3s-rate · watch time · sends/reach · non-follower reach | CTR · tap-to-buy | CPA · ROAS (paid) |
| **Trust/Proof 30%** | Trust | saves/reach · comment chất lượng · profile visit · returning | ATC · CVR (trễ) | CVR · review velocity · LTV |
| **Connection/Ritual 20%** | Cả hai | sends · shares · story replies · sticker taps · FB MSI (comment ≥10 từ) | — | retention follower |
| **Convert/Offer 10%** | — | link taps / CTR | ATC | orders · ROAS |

**Overlay theo content type (đo đúng vai trò — đừng đo nhầm):**
- Reel → completion + sends/reach + non-follower reach.
- Carousel → saves/reach + swipe-through + comment chất lượng.
- **Static → vai trò cohesion 9-tile, KHÔNG đo reach** (reach thấp là bình thường — đừng kill một static vì reach thấp).
- Story → replies + sticker taps + sequence completion.
- FB Group → MSI (comment dài, share, dwell).
- Broadcast → open + response.

> Lỗi #1 lặp lại ở tầng đo: đo Trust bằng KPI Click, hoặc đo Static bằng reach. Mỗi format×mode một bộ thước.

### 3.2 O3 attribute loop — học theo *thuộc tính*, không chỉ theo post

**Tag mọi launch bằng vector 5 chiều (L4):** `person y/n · mechanism · headline-type · motion · text-density`.

Vòng:
1. Launch tagged → đọc kết quả per post (theo KPI mode ở 3.1).
2. **Roll-up theo attribute** ("person=yes sends/reach $X vs no $Y") → batch sau **bias 70% attribute thắng + 30% explore mới**.
3. **Win Score correlation:** Pearson predicted-vs-actual sau mỗi wave → update weight **±10% max** (overfit guardrail).
4. **Concept Log:** visual đã dùng KHÔNG lặp.

### 3.3 Filter chẩn đoán — hook đúng người hay không (map vào thang 1.2)

- **Lane paid — cheap-click filter:** click rẻ (< ngưỡng) = hook đúng người → dồn cải tiến vào *funnel* (creative-landing alignment, benefit cụ thể hơn). Click đắt = hook sai → **thay concept, đừng tốn công sửa**.
- **Lane organic — sends+saves per reach filter** (tương đương): cao = hook+message đúng người → đẩy `expand`/`isolate`. Thấp dù reach cao = thay concept.

### 3.4 Quy nhân-quả qua lineage — "lever nào tạo kết quả"

Post Object mang `brief_id · variable_cell · rule_version · attribute vector` → Learn trả lời được **vì sao thắng**, không chỉ *post nào* thắng:
- Thắng vì **Reason-To-Attention** (hook/scroll-stop)? → nhân hook winner sang angle khác.
- Vì **Reason-To-Believe** (proof xếp lớp)? → nhân proof-stack.
- Vì **RTB fit** (đúng segment × driver)? → tăng allocation segment/angle đó.

→ Learn ghi ngược cả ba: **Win Score weights + Rules Engine + Slot Allocation** (winner attribute/SKU/angle thêm slot chu kỳ sau). Đây là chỗ phân biệt correlation với causation.

---

*Đọc cùng `loveintea-studio-flowmap.html` (visual) và `social-growth-playbook-2026.md` + `loveintea-brand-application.md` (nguồn). Mọi ngưỡng số là default ngành — thay bằng baseline thật sau 15–20 post.*

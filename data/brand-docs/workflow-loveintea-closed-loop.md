# Workflow: LoveinTea Closed-Loop Content Engine

Quy trình content khép kín cho LoveinTea — học từ performance để cải tiến, không phải nhà máy content một chiều. 7 nhóm chức năng: Brain → Plan → Create → Review → Publish → Engage → Learn, với Learn vòng lại Brain (Scoreboard + Rules Engine).

Category: process
Last updated: 2026-06-08T00:00:00.000Z

## Steps

### Start (start)

### Brain - Playbook (step, manual)
Lớp tham chiếu TĨNH — luật bất biến của brand. Brand DNA, brand-voice.md (v1.1), visual playbook, khung O3 One.One.One, chuẩn tag (1 tag trắng logo LoveinTea — KHÔNG đỏ, KHÔNG kraft). Mọi bước sau phải tuân.
Input: brand-voice.md, visual-playbook, o3-framework, tag-standard
Output: Bộ quy chuẩn brand & visual áp xuống toàn pipeline
Assigned to: Brand Owner
Time: tham chiếu (static)

Notes: Thay đổi hiếm và có version riêng. Đây không phải bước "chạy" — là nguồn ràng buộc cho Plan, Brief Builder và Review Desk.

### Brain - Scoreboard (ai_step, ai)
Tổng hợp performance gần đây theo từng angle / variable_cell, gắn verdict: SCALE / HOLD / RETIRE. Áp absolute saves floor (không chỉ baseline-multiple) vì account nhỏ → outlier 1 post không đáng tin.
Tool: LoveinTea Studio (Analytics)
Assigned to: System
Time: < 5 giây

**Prompt:**
```
Bạn là performance analyst của LoveinTea.
Input: dữ liệu post 30 ngày gần nhất, gắn theo lineage (brief_id, rule_version, angle, variable_cell, channel).

Cho mỗi angle/variable_cell:
- Tính saves, reach, ER theo channel (FB vs IG riêng).
- So với baseline VÀ với absolute saves floor (min_sample_size = N posts).
- Gán verdict: SCALE (vượt floor + baseline), HOLD (chưa đủ sample), RETIRE (dưới floor sau đủ sample).
- Angle NEUTRAL: chỉ cho 1 retry, sau đó RETIRE.

Output JSON: [{angle, variable_cell, channel, saves, verdict, evidence_n}]
KHÔNG kết luận khi sample < min_sample_size — trả HOLD.
```

*Prompt Notes:*
• Threshold số hiện là default placeholder — chốt lại khi có dữ liệu Scoreboard thật.
• Saves floor là tuyệt đối, không phải bội số baseline.

### Brain - Rules Engine (step, manual)
≤ 30 rule có version. Mỗi rule sinh từ một learning có bằng chứng (từ Learn). Rule cũ bị thay phải ghi lý do + giữ lịch sử version.
Input: Rule đề xuất từ Learn, verdict từ Scoreboard
Output: Bộ rule version hiện hành (rule_version) cho Brief Builder dùng
Assigned to: Brand Owner
Time: 10-20 phút / lần review

Notes: Quá 30 rule → phải retire rule yếu nhất trước khi thêm. Versioned để Post Object truy được rule_version nào tạo ra post nào.

### Plan (step, manual)
Lập content calendar phủ ràng buộc đa dạng O3. Mỗi slot phải có Channel (FB/IG), Funnel-stage, Seasonal/Campaign. Tối thiểu 2 cell mỗi RTB × Segment. Cân bằng emotion/proof (~30% proof, KHÔNG để ~50%). CTA chỉ 1–2 trên mỗi 9 tile.
Input: Verdict SCALE/HOLD/RETIRE từ Scoreboard, quy chuẩn từ Playbook
Output: Lịch slot có đủ trục (channel, funnel, season, RTB×Segment)
Assigned to: Content Manager
Time: 30-60 phút / tuần

Notes: Cần ~120 cell cho 6 tháng phủ (không phải ~12). IG = brand/discovery; FB = community/trust/conversion — slot phải tách rõ ý đồ theo kênh.

### Brief Builder (ai_step, ai)
Điểm HỘI TỤ. Mỗi slot khai báo ĐÚNG 1 purpose + 1 variable_cell trước khi sản xuất. Sinh brief từ slot + rule_version hiện hành + Playbook. Brief mang lineage để truy nhân quả về sau.
Tool: LoveinTea Studio
Assigned to: System
Time: < 2 giây

**Prompt:**
```
Bạn là brief builder của LoveinTea.
Input: 1 slot (channel, funnel_stage, season, RTB, segment), rule_version hiện hành, Playbook.

Sinh 1 brief với ĐÚNG:
- 1 purpose (mục tiêu duy nhất của tile này)
- 1 variable_cell (biến được test trong tile này)
Gắn: brief_id, rule_version, channel, format, RTB, segment.

Ràng buộc:
- Copy phải claim-safe (FDA structure/function): KHÔNG liver/detox/heart/cure.
- Dùng theme/moment language, không hứa hiệu quả sức khỏe.
- Tag: 1 tag trắng logo LoveinTea.

Output JSON: {brief_id, purpose, variable_cell, rule_version, channel, format, copy_direction, visual_direction}
```

*Prompt Notes:*
Brief KHÔNG được mang >1 purpose hoặc >1 variable_cell — nếu slot mơ hồ thì trả lại Plan, không tự đoán.

### Create - Copy (ai_step, ai)
Track COPY (tách riêng track Visual). Viết theo brand voice, claim-safe. Typography KHÔNG render ở bước này — set trong design sau.
Tool: LoveinTea Studio
Assigned to: System + Content Creator
Time: 30-60 giây

**Prompt:**
```
Bạn là copywriter của LoveinTea — Timeless Remedies. Voice: Warmly Wise, Cheerfully Simple, Proudly Vietnamese.
Input: brief (purpose, variable_cell, channel, copy_direction).

Viết copy cho 1 tile:
- Đúng 1 purpose của brief.
- Claim-safe: mô tả khoảnh khắc / nghi thức / cảm giác, KHÔNG hứa chữa bệnh hay tác dụng cơ quan.
- Có CTA chỉ khi brief đánh dấu (1–2 / 9 tile).
- Tiếng Anh cho thị trường US.

Negative: structure/function claim, "detox/liver/heart", superlatives y khoa, text dài quá format.
Output: {headline, body, cta?}
```

*Prompt Notes:*
• Nếu brief không bật CTA → để trống cta.
• Mọi claim nghi ngờ sẽ bị Review Desk chặn — viết an toàn ngay từ đầu.

### Create - Visual (step, manual)
Track VISUAL (tách riêng track Copy). Gọi sub-workflow "Image Generation — Product Photos". Bắt buộc đa dạng context: không chỉ "pretty brewing still" — luân phiên unboxing, origin, prep, macro, gift; nhiều format. Typography set trong design sau generate.
Tool: LoveinTea Studio → Workflow "Image Generation — Product Photos"
Input: brief (visual_direction, variable_cell)
Output: Ảnh approved từ Image Library (có metadata SKU/USP/scene)
Assigned to: Content Creator
Time: 5-15 phút

Notes: Link sang sub-workflow ảnh. Tag chuẩn 1 tag trắng logo. Nếu output trùng angle/visual đã đăng → đổi context (Review Desk sẽ dedup).

### Review Desk (decision, manual)
CỔNG CỨNG trước publish — không phải check mềm. 3 kiểm phải PASS cả ba:
1) FDA claim safety — loại mọi structure/function claim.
2) Anti-AI quality — không artifact AI, không lặp "pretty brewing still", visual feel thật.
3) Dedup — không trùng angle/visual đã đăng.
Input: Copy draft + Visual draft (cùng brief_id)
Output: PASS → Publish; FAIL → quay lại track tương ứng kèm feedback cụ thể
Assigned to: Content Manager
Time: 3-5 phút

Notes: Checklist:
✅ Không claim sức khỏe (theme/moment language)
✅ Không giống AI / không lặp khuôn cũ
✅ Không trùng post đã đăng
✅ Tag trắng đúng chuẩn
✅ CTA ≤ 1–2/9 tile
FAIL claim/copy → trả Create - Copy. FAIL visual/dedup → trả Create - Visual.

### Publish (step, manual)
Đăng FB/IG đúng format Meta. Gắn Post Object mang LINEAGE: brief_id + rule_version → để Analytics attribute nhân quả (không phải tương quan).
Input: Cụm copy + visual đã PASS
Output: Post live + Post Object {post_id, brief_id, rule_version, channel, published_at}
Assigned to: Content Manager
Time: 5 phút

Notes: IG = brand/discovery; FB = community/trust/conversion. Lineage là bắt buộc — thiếu brief_id/rule_version thì không attribute được ở Learn.

### Engage (step, manual)
Quản lý cộng đồng sau đăng: trả lời comment, DM, tương tác. Thu tín hiệu định tính (objection, câu hỏi lặp) làm input cho Learn.
Input: Post live
Output: Tương tác + tín hiệu định tính ghi nhận
Assigned to: Community Manager
Time: liên tục theo ngày

Notes: FB ưu tiên depth (trust/conversion); IG ưu tiên reach/discovery. Câu hỏi lặp = gợi ý angle mới cho Plan.

### Learn (ai_step, ai)
Phân tích performance theo lineage → attribute NHÂN QUẢ về brief/rule, không tương quan. Đẩy verdict về Scoreboard, đề xuất rule mới (versioned) về Rules Engine. Áp absolute saves floor + min sample size TRƯỚC khi hành động.
Tool: LoveinTea Studio (Analytics)
Assigned to: System
Time: < 10 giây

**Prompt:**
```
Bạn là learning engine của LoveinTea.
Input: Post Objects (post_id, brief_id, rule_version, channel) + metrics (saves, reach, ER, comments) + tín hiệu định tính từ Engage.

Nhiệm vụ:
1. Attribute kết quả về brief_id + rule_version (nhân quả, theo lineage — KHÔNG suy luận tương quan rời rạc).
2. Chỉ kết luận khi reach min_sample_size; nếu chưa đủ → HOLD.
3. Áp absolute saves floor trước khi đề xuất SCALE/RETIRE.
4. Angle NEUTRAL: 1 retry rồi RETIRE.
5. Đề xuất tối đa vài rule mới (versioned), mỗi rule kèm bằng chứng. Nhớ trần ≤30 rule.

Output JSON:
{scoreboard_updates: [...], proposed_rules: [{rule_text, evidence, replaces_rule_version?}]}
```

*Prompt Notes:*
• Không hành động trên outlier 1 post — account nhỏ, statistically unreliable.
• Threshold số là default placeholder → tinh chỉnh khi Scoreboard có dữ liệu thật.

### Cycle Complete (end)
1 chu kỳ khép kín. Learning đã nạp lại Brain (Scoreboard + Rules Engine) cho vòng kế tiếp.

## Flow

- Start → Brain - Playbook: Bắt đầu
- Brain - Playbook → Brain - Scoreboard: Quy chuẩn sẵn sàng, kéo performance gần đây
- Brain - Playbook → Brain - Rules Engine: Quy chuẩn sẵn sàng, nạp rule hiện hành
- Brain - Scoreboard → Plan: Verdict SCALE/HOLD/RETIRE đã có
- Brain - Rules Engine → Brief Builder: rule_version chốt
- Plan → Brief Builder: Slot đã lên lịch (đủ trục O3)
- Brief Builder → Create - Copy: Brief ready (1 purpose + 1 cell)
- Brief Builder → Create - Visual: Brief ready (1 purpose + 1 cell)
- Create - Copy → Review Desk: Copy draft xong
- Create - Visual → Review Desk: Visual draft xong
- Review Desk → Publish: PASS cả 3 cổng
- Review Desk → Create - Copy: FAIL claim/quality (revise copy)
- Review Desk → Create - Visual: FAIL visual/dedup (revise visual)
- Publish → Engage: Đã đăng + gắn Post Object (lineage)
- Engage → Learn: Thu metrics + tín hiệu định tính
- Learn → Brain - Scoreboard: Cập nhật performance + verdict (vòng lặp)
- Learn → Brain - Rules Engine: Đề xuất rule mới versioned (vòng lặp)
- Learn → Cycle Complete: Chu kỳ kết thúc

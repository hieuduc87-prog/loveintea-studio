#!/usr/bin/env bash
# GUARD > GIẤY: chặn tái phát 2 lớp bug đã fix root (LIT-FIX-0822B).
# Fail build nếu vi phạm. Chạy trong npm run build hoặc pre-commit hook.
set -euo pipefail

fail=0    # hard-fail (guard 1 + 3 — hardcode = phải sửa NGAY)
warn=0    # soft-warn (guard 2 — 15 file backlog audit)

# GUARD 1 — LAYOUTS whitelist tập trung (fix #A LIT-FIX-0822A):
# 3 route text-overlay từng hardcode `const LAYOUTS = ['bottom-headline', ...]`
# → add layout mới trong lib silent fallback. Từ nay CHỈ dùng import từ lib.
echo "== GUARD 1 — LAYOUTS hardcode ban =="
LAYOUT_HARDCODE=$(grep -rn "const LAYOUTS *= *\[" app/api/content/text-overlay/ 2>/dev/null \
  | grep -v "= *LAYOUT_IDS" | grep -v "^Binary" || true)
if [ -n "$LAYOUT_HARDCODE" ]; then
  echo "❌ HARDCODED LAYOUTS array found — dùng import LAYOUT_IDS từ lib/text-overlay.ts:"
  echo "$LAYOUT_HARDCODE"
  fail=1
else
  echo "✅ Không hardcode LAYOUTS"
fi

# GUARD 2 — Tenant table query phải bọc runWithBrand (fix #H LIT-FIX-0822A):
# Tenant tables (không PLATFORM) query getDb().prepare mà KHÔNG có runWithBrand nearby
# → chạy ngoài request context = sai DB. Trong lib/ (helper reusable, không phải route)
# là nguy cơ cao nhất.
echo
echo "== GUARD 2 — Tenant queries in lib/ không có runWithBrand nearby =="
TENANT_TABLES="brand_dna|brand_fonts|products|product_images|content_templates|video_projects|video_clips|assets|briefs|content_rules|scoreboard|post_metrics|inbox_messages|audiences|variables|knowledge_docs|overlay_references|post_tags|blog_posts|batch_runs|image_library|image_jobs"
# Grep FROM/UPDATE/INSERT/DELETE các tenant table trong lib/ (không phải db.ts + tenant-context.ts)
UNSAFE=$(grep -rEn "(FROM|UPDATE|INSERT INTO|DELETE FROM) ($TENANT_TABLES)\b" lib/ 2>/dev/null \
  | grep -v "^lib/db.ts:" \
  | grep -v "^lib/tenant-context.ts:" \
  | grep -v "^lib/text-overlay-render.ts:" \
  || true)
# Với mỗi match: check file có runWithBrand hoặc chạy inside route handler
FILES=$(echo "$UNSAFE" | grep -oE "^lib/[^:]+" | sort -u)
for f in $FILES; do
  # Skip nếu file có runWithBrand (đã bọc context) hoặc là file cần audit đặc biệt
  if ! grep -q "runWithBrand\|enterBrandContext" "$f" 2>/dev/null; then
    echo "⚠️  $f — query tenant table không import runWithBrand. Backlog audit LIT-FIX-0822B."
    warn=$((warn+1))
  fi
done
if [ $warn -eq 0 ] || [ -z "$FILES" ]; then
  echo "✅ Mọi tenant query trong lib/ đều bọc runWithBrand"
else
  echo "→ $warn file cần audit dần các phiên sau (không block build hôm nay)"
fi

# GUARD 3 — LLM model hardcode ban (LIT-FIX-0820N #2):
# Không hardcode gemini-1.x/2.x version — luôn dùng alias -latest.
echo
echo "== GUARD 3 — Gemini model hardcode ban =="
GEMINI_HARDCODE=$(grep -rEn "['\"]gemini-[12]\.[0-9]" lib/ app/ 2>/dev/null \
  | grep -v ".worktrees" | grep -v ".next" | grep -v node_modules \
  | grep -v "// " | grep -v "^lib/gemini.ts:" || true)
if [ -n "$GEMINI_HARDCODE" ]; then
  echo "❌ HARDCODED Gemini model version — dùng alias -latest hoặc import MODELS từ lib/gemini.ts:"
  echo "$GEMINI_HARDCODE"
  fail=1
else
  echo "✅ Không hardcode Gemini version"
fi

echo
if [ $fail -ne 0 ]; then
  echo "❌ GUARD FAILED — hardcode ban (guard 1/3) — sửa trước khi commit"
  exit 1
fi
if [ $warn -gt 0 ]; then
  echo "⚠️  GUARD PASS with $warn warnings (guard 2 tenant-context backlog — audit dần)"
else
  echo "✅ Tất cả 3 GUARD pass sạch"
fi

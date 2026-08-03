#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# backup-db.sh — sao lưu TOÀN BỘ SQLite (global + mọi tenant) an toàn khi đang chạy.
#
# Vì sao KHÔNG dùng `cp`: SQLite ở chế độ WAL giữ dữ liệu vừa ghi trong file
# -wal riêng. Copy mỗi studio.db lúc app đang chạy sẽ ra bản thiếu giao dịch
# cuối, hoặc hỏng hẳn — và chỉ phát hiện đúng lúc cần phục hồi, tức là quá muộn.
# `sqlite3 .backup` dùng API sao lưu online, ra bản nhất quán.
#
# Vì sao có verify: backup KHÔNG ĐỌC ĐƯỢC thì bằng không có backup, mà tệ hơn —
# nó cho cảm giác an toàn giả. Mỗi file sao xong đều bị mở ra kiểm tra ngay.
#
# Dùng:
#   ./scripts/backup-db.sh                       # sao vào /opt/loveintea/backups
#   BACKUP_DIR=/mnt/x ./scripts/backup-db.sh     # đổi đích
#   ./scripts/backup-db.sh --verify-only <thư mục>   # kiểm lại một bản đã sao
#
# Cron trên server (3h sáng mỗi ngày, giữ 14 bản):
#   0 3 * * * /opt/loveintea/src/scripts/backup-db.sh >> /var/log/lit-backup.log 2>&1
# ─────────────────────────────────────────────────────────────────────────────
set -Eeuo pipefail

DATA_DIR="${DATA_DIR:-/opt/loveintea/data}"
BACKUP_DIR="${BACKUP_DIR:-/opt/loveintea/backups}"
KEEP="${KEEP:-14}"            # giữ bao nhiêu bản gần nhất
MIN_FREE_MB="${MIN_FREE_MB:-2048}"

ok() { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
er() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; }

command -v sqlite3 >/dev/null || { er "thiếu sqlite3 (apk add sqlite / apt install sqlite3)"; exit 1; }

# ── Kiểm một file backup có đọc được và có dữ liệu không ────────────────────
verify_db() {
  local f="$1"
  local integrity
  integrity="$(sqlite3 "$f" 'PRAGMA integrity_check;' 2>&1 | head -1)"
  [[ "$integrity" == "ok" ]] || { er "$(basename "$f"): integrity_check = $integrity"; return 1; }
  # File đọc được nhưng RỖNG cũng là backup hỏng — sao chép đúng một cái vỏ.
  local tables
  tables="$(sqlite3 "$f" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo 0)"
  [[ "$tables" -gt 0 ]] || { er "$(basename "$f"): 0 bảng — backup rỗng"; return 1; }
  echo "    $(basename "$f"): ok, ${tables} bảng, $(du -h "$f" | cut -f1)"
  return 0
}

if [[ "${1:-}" == "--verify-only" ]]; then
  target="${2:?cần đường dẫn thư mục backup}"
  fail=0
  while IFS= read -r -d '' f; do verify_db "$f" || fail=1; done \
    < <(find "$target" -name '*.db' -print0)
  [[ $fail == 0 ]] && ok "Bản sao đọc được toàn bộ" || { er "Có file hỏng"; exit 1; }
  exit 0
fi

# ── Đủ chỗ trống chưa ───────────────────────────────────────────────────────
# Backup làm đầy ổ rồi giết luôn app đang chạy là cách tự gây sự cố kinh điển.
mkdir -p "$BACKUP_DIR"
free_mb="$(df -Pm "$BACKUP_DIR" | awk 'NR==2{print $4}')"
need_mb="$(du -sm "$DATA_DIR" 2>/dev/null | cut -f1 || echo 0)"
if (( free_mb < MIN_FREE_MB || free_mb < need_mb * 2 )); then
  er "Thiếu chỗ: còn ${free_mb}MB, dữ liệu ${need_mb}MB. Dọn bớt bản cũ trước."
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="${BACKUP_DIR}/${STAMP}"
mkdir -p "$DEST"
echo "=== Sao lưu → ${DEST} ==="

count=0
fail=0

backup_one() {
  local src="$1" name="$2"
  [[ -f "$src" ]] || return 0
  # .backup an toàn với WAL và với app đang ghi song song.
  if sqlite3 "$src" ".backup '${DEST}/${name}'" 2>/dev/null; then
    verify_db "${DEST}/${name}" || fail=1
    count=$((count + 1))
  else
    er "sao ${name} thất bại"; fail=1
  fi
}

# 1. DB global (bảng platform: users, brands, thanh toán, hạn mức, sổ chi phí)
backup_one "${DATA_DIR}/studio.db" "global.studio.db"

# 2. DB từng tenant (P3 DB-per-tenant)
if [[ -d "${DATA_DIR}/tenants" ]]; then
  for d in "${DATA_DIR}/tenants"/*/; do
    [[ -d "$d" ]] || continue
    brand="$(basename "$d")"
    [[ "$brand" == .* ]] && continue
    backup_one "${d}studio.db" "tenant.${brand}.studio.db"
  done
fi

if (( count == 0 )); then
  er "KHÔNG sao được file nào — DATA_DIR=${DATA_DIR} có đúng không?"
  rmdir "$DEST" 2>/dev/null || true
  exit 1
fi

# 3. Ảnh: chỉ ghi lại kích thước, KHÔNG sao mỗi ngày (hàng chục GB).
#    Ảnh mất thì tạo lại được; DB mất thì mất khách. Ưu tiên đúng thứ.
du -sh "${DATA_DIR}/images" 2>/dev/null > "${DEST}/images-size.txt" || true

echo "$(git -C "$(dirname "$0")/.." rev-parse --short HEAD 2>/dev/null || echo unknown)" > "${DEST}/git-rev.txt"

# ── Dọn bản cũ ──────────────────────────────────────────────────────────────
mapfile -t old < <(find "$BACKUP_DIR" -maxdepth 1 -mindepth 1 -type d | sort -r | tail -n +$((KEEP + 1)))
for d in "${old[@]:-}"; do [[ -n "$d" ]] && rm -rf "$d" && echo "    dọn bản cũ: $(basename "$d")"; done

if (( fail == 0 )); then
  ok "Xong: ${count} DB, tổng $(du -sh "$DEST" | cut -f1), giữ ${KEEP} bản gần nhất"
else
  er "Xong nhưng CÓ FILE HỎNG — kiểm tra ngay, đừng tin bản sao này."
  exit 1
fi

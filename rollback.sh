#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# rollback.sh — quay prod về ảnh :previous NGAY, không build lại.
#
# Dùng khi bản mới qua được health check nhưng hỏng ở tầng nghiệp vụ (sai giá,
# đăng nhầm store, mất tính năng) — thứ máy không tự phát hiện được.
#
# Không build lại là CỐ Ý: lúc prod đang hỏng, cần đường về ngắn nhất (~10 giây),
# không phải chờ vài phút build. Ảnh cũ đã nằm sẵn trên server.
#
# LƯU Ý: rollback chỉ lùi CODE. Nó KHÔNG lùi được migration DB — nếu bản mới đã
# đổi schema, phải phục hồi từ backup data/ (xem scripts/backup-db.sh).
# ─────────────────────────────────────────────────────────────────────────────
set -Eeuo pipefail

SSH_HOST="${SSH_HOST:-root@178.105.246.16}"
DATA_DIR="${DATA_DIR:-/opt/loveintea/data}"
ENV_FILE="${ENV_FILE:-/opt/loveintea/.env}"
IMAGE="${IMAGE:-loveintea-studio}"
CONTAINER="${CONTAINER:-loveintea-app}"
PORT="${PORT:-3202}"
HEALTH_URL="http://127.0.0.1:${PORT}/api/health/live"

ok() { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
er() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; }

if ! ssh -o ConnectTimeout=15 "$SSH_HOST" "docker image inspect ${IMAGE}:previous >/dev/null 2>&1"; then
  er "Không có ảnh ${IMAGE}:previous trên server — không thể quay về."
  echo "  Ảnh còn trên server:"
  ssh "$SSH_HOST" "docker images ${IMAGE} --format '  {{.Tag}}  {{.CreatedSince}}'"
  exit 1
fi

echo "Sẽ quay prod về ${IMAGE}:previous."
read -r -p "Chắc chưa? [y/N] " a
[[ "$a" == "y" || "$a" == "Y" ]] || { echo "Huỷ."; exit 0; }

# Bản đang chạy thành :failed để còn dò lỗi sau — đừng vứt bằng chứng đi.
ssh "$SSH_HOST" "docker tag ${IMAGE}:latest ${IMAGE}:failed 2>/dev/null || true"
ssh "$SSH_HOST" "docker rm -f ${CONTAINER} >/dev/null 2>&1 || true"
ssh "$SSH_HOST" "docker run -d --name ${CONTAINER} \
  --env-file ${ENV_FILE} \
  -v ${DATA_DIR}:/app/data \
  -p ${PORT}:${PORT} \
  --restart unless-stopped \
  ${IMAGE}:previous"

for i in $(seq 1 20); do
  if ssh "$SSH_HOST" "curl -fsS -m 5 ${HEALTH_URL}" >/dev/null 2>&1; then
    ok "Đã quay về bản trước — prod khoẻ sau $((i * 2))s"
    echo "  Bản hỏng giữ ở ${IMAGE}:failed — dò lỗi: ssh ${SSH_HOST} docker logs ${CONTAINER}"
    exit 0
  fi
  sleep 2
done

er "Quay về rồi mà vẫn KHÔNG khoẻ — phải vào server xử lý tay NGAY."
ssh "$SSH_HOST" "docker logs --tail 60 ${CONTAINER} 2>&1 || true"
exit 1

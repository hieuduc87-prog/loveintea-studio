#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh — deploy loveintea-studio lên Hetzner, CÓ ĐƯỜNG LÙI.
#
# Bản cũ của file này deploy lên launchd trên Mac — trong khi prod thật đã là
# Docker trên Hetzner từ lâu. Script deploy sai đích còn tệ hơn không có script:
# nó khiến người ta tin là đã deploy.
#
# Vì sao có rollback: flow cũ chép tay 6 lệnh SSH, trong đó `docker rm` xoá
# container CŨ TRƯỚC khi biết container MỚI có sống hay không. Build hỏng =
# mất luôn bản đang chạy, và không còn gì để quay về. Script này giữ ảnh cũ
# gắn thẻ :previous, kiểm tra sức khoẻ bản mới, hỏng thì TỰ ĐỘNG quay về.
#
# Dùng:
#   ./deploy.sh              # deploy HEAD của nhánh hiện tại
#   ./deploy.sh --dry-run    # in ra các bước, không đụng vào prod
#   ./rollback.sh            # quay về bản trước, thủ công
# ─────────────────────────────────────────────────────────────────────────────
set -Eeuo pipefail

SSH_HOST="${SSH_HOST:-root@178.105.246.16}"
SRC_DIR="${SRC_DIR:-/opt/loveintea/src}"
DATA_DIR="${DATA_DIR:-/opt/loveintea/data}"
ENV_FILE="${ENV_FILE:-/opt/loveintea/.env}"
IMAGE="${IMAGE:-loveintea-studio}"
CONTAINER="${CONTAINER:-loveintea-app}"
PORT="${PORT:-3202}"
HEALTH_URL="http://127.0.0.1:${PORT}/api/health/live"
HEALTH_RETRIES="${HEALTH_RETRIES:-30}"   # 30 × 2s = 60s cho container ấm máy
DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

c()  { printf '\033[1;36m%s\033[0m\n' "$*"; }
ok() { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
er() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; }

remote() {
  if [[ $DRY_RUN == 1 ]]; then echo "    [dry-run] ssh $SSH_HOST '$*'"; return 0; fi
  ssh -o ConnectTimeout=15 "$SSH_HOST" "$@"
}

# ── 0. Cổng gác TRƯỚC KHI đụng vào prod ──────────────────────────────────────
# Deploy code chưa qua kiểm tra là cách nhanh nhất biến một lỗi nhỏ thành sự cố
# prod. Chạy local, nhanh, và fail-loud.
c "=== [0/6] Kiểm tra trước khi deploy ==="
npm run typecheck
npm run check:tenant
npm test
ok "typecheck + tenant guard + test đều xanh"

if [[ -n "$(git status --porcelain)" ]]; then
  er "Cây làm việc còn thay đổi chưa commit — commit hoặc stash trước khi deploy."
  git status --short
  exit 1
fi

REV="$(git rev-parse --short HEAD)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
c "=== Deploy ${BRANCH}@${REV} → ${SSH_HOST} ==="

# ── 1. Đẩy code lên ──────────────────────────────────────────────────────────
c "=== [1/6] Push + pull trên server ==="
if [[ $DRY_RUN == 0 ]]; then git push -u origin "$BRANCH"; fi
remote "cd ${SRC_DIR} && git fetch origin ${BRANCH} && git reset --hard origin/${BRANCH}"
ok "server đang ở ${REV}"

# ── 2. Giữ đường lùi TRƯỚC khi build ────────────────────────────────────────
# Gắn thẻ ảnh đang chạy thành :previous. Đây là toàn bộ lý do rollback khả thi —
# làm sau khi build là quá muộn, vì :latest lúc đó đã bị ghi đè.
c "=== [2/6] Gắn thẻ bản đang chạy → :previous ==="
remote "docker image inspect ${IMAGE}:latest >/dev/null 2>&1 \
  && docker tag ${IMAGE}:latest ${IMAGE}:previous \
  && echo '  đã giữ bản cũ làm :previous' \
  || echo '  chưa có :latest (lần deploy đầu) — không có đường lùi'"

# ── 3. Build ảnh mới ────────────────────────────────────────────────────────
c "=== [3/6] Build ảnh mới ==="
remote "cd ${SRC_DIR} && docker build --build-arg GIT_REV=${REV} -t ${IMAGE}:${REV} -t ${IMAGE}:latest ."
ok "build xong: ${IMAGE}:${REV}"

# ── 4. Đổi container ────────────────────────────────────────────────────────
start_container() {
  local tag="$1"
  remote "docker rm -f ${CONTAINER} >/dev/null 2>&1 || true"
  remote "docker run -d --name ${CONTAINER} \
    --env-file ${ENV_FILE} \
    -e GIT_REV=${REV} \
    -v ${DATA_DIR}:/app/data \
    -p ${PORT}:${PORT} \
    --restart unless-stopped \
    ${IMAGE}:${tag}"
}

c "=== [4/6] Khởi động container mới ==="
start_container "latest"

# ── 5. Kiểm tra sức khoẻ THẬT ───────────────────────────────────────────────
# "Container đang chạy" KHÔNG có nghĩa là app sống: nó có thể boot rồi crash,
# hoặc sống mà DB không mở được. Hỏi /api/health/live — nó kiểm DB và vòng nền.
c "=== [5/6] Kiểm tra sức khoẻ (tối đa $((HEALTH_RETRIES * 2))s) ==="
healthy=0
if [[ $DRY_RUN == 1 ]]; then
  echo "    [dry-run] bỏ qua health check"; healthy=1
else
  for i in $(seq 1 "$HEALTH_RETRIES"); do
    if ssh "$SSH_HOST" "curl -fsS -m 5 ${HEALTH_URL}" >/dev/null 2>&1; then
      healthy=1; ok "app trả lời khoẻ sau $((i * 2))s"; break
    fi
    sleep 2
  done
fi

# ── 6. Hỏng thì TỰ ĐỘNG quay về ─────────────────────────────────────────────
if [[ $healthy == 0 ]]; then
  er "Bản mới KHÔNG khoẻ — đang quay về :previous"
  remote "docker logs --tail 60 ${CONTAINER} 2>&1 || true"

  if remote "docker image inspect ${IMAGE}:previous >/dev/null 2>&1"; then
    start_container "previous"
    sleep 8
    if ssh "$SSH_HOST" "curl -fsS -m 5 ${HEALTH_URL}" >/dev/null 2>&1; then
      er "ĐÃ QUAY VỀ bản trước — prod đang chạy code CŨ. Sửa rồi deploy lại."
    else
      er "QUAY VỀ CŨNG HỎNG — prod đang sập, phải vào server xử lý tay NGAY."
    fi
  else
    er "KHÔNG CÓ :previous để quay về — prod đang sập."
  fi
  exit 1
fi

c "=== [6/6] Dọn ảnh cũ ==="
remote "docker image prune -f --filter 'until=168h' >/dev/null 2>&1 || true"

ok "DEPLOY XONG — ${BRANCH}@${REV} đang chạy"
echo "   Quay về bản trước:  ./rollback.sh"

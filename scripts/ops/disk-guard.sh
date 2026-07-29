#!/bin/bash
# GUARD CHỐNG ĐẦY Ổ — bản gốc, deploy tới /opt/loveintea/disk-guard.sh (cron `37 * * * *`).
#
# Sự cố 29/07 lần 1: ổ còn 515MB → deploy fail.
# Sự cố 29/07 lần 2: guard CHẠY nhưng thu hồi 0B — `docker builder prune -f` chỉ xoá
#   cache mồ côi, còn 4.3GB cache đang được image dùng lại thì phải có `-a`; journal
#   715MB thì guard không đụng tới. Guard chạy mà không thu hồi = ảo giác an toàn.
#
# Nguyên tắc: CHỈ dọn thứ TÁI SINH ĐƯỢC. Không bao giờ đụng data khách
# (data/tenants, data/images, studio.db) — hết chỗ thì báo người, không tự xoá.
USED=$(df / | awk 'NR==2{print $5}' | tr -d '%')
LOG=/opt/loveintea/disk-guard.log
if [ "$USED" -ge 85 ]; then
  echo "[$(date -u +%FT%TZ)] Ổ ${USED}% — dọn cache tái sinh được" >> $LOG
  docker builder prune -af >> $LOG 2>&1
  docker image prune -f >> $LOG 2>&1
  journalctl --vacuum-size=100M >> $LOG 2>&1
  rm -rf /opt/loveintea/data/video-tmp/* 2>/dev/null
  # cache clip AI: giữ 14 ngày (tái tạo được nhưng tốn tiền thật nên giữ lâu)
  find /opt/loveintea/data/video-cache -type f -mtime +14 -delete 2>/dev/null
  AFTER=$(df / | awk 'NR==2{print $5}' | tr -d '%')
  echo "[$(date -u +%FT%TZ)] còn ${AFTER}%" >> $LOG
  if [ "$AFTER" -ge 90 ]; then
    echo "[$(date -u +%FT%TZ)] ⚠️ VẪN ${AFTER}% SAU KHI DỌN — cần người xử lý (kho ảnh/backup lớn)" >> $LOG
  fi
fi

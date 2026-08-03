FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
# Copy prebuilt better-sqlite3 binary for alpine
RUN npm rebuild better-sqlite3 2>/dev/null || true
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# 3202 = cổng prod thật (docker run -p 3202:3202). Mặc định cũ là 3200 nên nếu
# .env quên đặt PORT thì container nghe 3200 còn Docker map 3202 → app "chạy"
# mà không ai gọi tới được. Cho mặc định khớp với thực tế đang dùng.
ENV PORT=3202

# Mã commit đang chạy — /api/health/live và log khởi động in ra, để trả lời được
# câu "prod đang chạy bản nào" mà không phải đoán.
ARG GIT_REV=unknown
ENV GIT_REV=$GIT_REV

# Video Studio: ffmpeg (assembly) + chromium (overlay render) + fonts (VN glyphs)
# + yt-dlp (Nguồn học: tải video công khai IG/FB/TikTok/YouTube để phân tích)
# + edge-tts (voiceover FREE Microsoft neural + SRT word timestamps cho karaoke)
RUN apk add --no-cache ffmpeg chromium nss freetype harfbuzz ca-certificates ttf-freefont font-noto fontconfig yt-dlp python3 py3-pip \
  && pip3 install --no-cache-dir --break-system-packages edge-tts
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# SQLite data dir
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs

EXPOSE 3202

# Máy dò sức khoẻ ngay trong Docker: container "up" mà app chết bên trong là
# trạng thái nói dối — HEALTHCHECK biến nó thành `unhealthy` nhìn thấy được.
HEALTHCHECK --interval=60s --timeout=10s --start-period=90s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health/live" >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]

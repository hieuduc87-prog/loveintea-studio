FROM node:20-alpine AS builder
WORKDIR /app
# Build tools cho native module (better-sqlite3) — alpine không có sẵn gcc/make/python.
# TRƯỚC đây dựa vào prebuild-install (download binary) + cache layer; khi cache bị
# `docker builder prune` xoá giữa deploy, rebuild fail âm thầm (`2>/dev/null || true`)
# → image THIẾU .node → mọi truy cập DB văng, login/publish gãy (sự cố 10/08).
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --ignore-scripts
# Compile better-sqlite3 từ nguồn — FAIL-LOUD: thiếu .node thì DỪNG build, KHÔNG ship image hỏng.
RUN npm rebuild better-sqlite3 --build-from-source \
 && test -f node_modules/better-sqlite3/build/Release/better_sqlite3.node
COPY . .
RUN npm run build:nogurad

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3200

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

EXPOSE 3200

CMD ["node", "server.js"]

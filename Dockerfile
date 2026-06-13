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
ENV PORT=3200

# Video Studio: ffmpeg (assembly) + chromium (overlay render) + fonts (VN glyphs)
RUN apk add --no-cache ffmpeg chromium nss freetype harfbuzz ca-certificates ttf-freefont font-noto fontconfig
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

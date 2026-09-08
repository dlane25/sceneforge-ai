# syntax=docker/dockerfile:1
FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    AUTH_MODE=mock \
    MEDIA_PROVIDER=mock \
    IMAGE_PROVIDER=mock \
    VIDEO_PROVIDER=mock \
    AUDIO_PROVIDER=mock \
    EXPORT_ENGINE=mock
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    FFMPEG_PATH=/usr/bin/ffmpeg \
    EXPORT_MEDIA_ROOT=/app/media \
    EXPORT_OUTPUT_ROOT=/app/exports
RUN apk add --no-cache ffmpeg && addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs && mkdir -p /app/media /app/exports && chown -R nextjs:nodejs /app/media /app/exports
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:3000/api/health/live || exit 1
CMD ["sh", "-c", "node scripts/startup-check.mjs && node server.js"]

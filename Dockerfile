# Image de production (le développement local reste `npm run start:dev`).
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build && npm prune --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl \
  && addgroup -S pullup && adduser -S pullup -G pullup
ENV NODE_ENV=production DEMO_MODE=false
COPY --from=build --chown=pullup:pullup /app/node_modules ./node_modules
COPY --from=build --chown=pullup:pullup /app/dist ./dist
COPY --from=build --chown=pullup:pullup /app/prisma ./prisma
COPY --from=build --chown=pullup:pullup /app/docs ./docs
COPY --from=build --chown=pullup:pullup /app/package.json ./
COPY --from=build --chown=pullup:pullup /app/prisma.config.ts ./
USER pullup
EXPOSE 4000
# Les migrations (`prisma migrate deploy`) s’exécutent au déploiement, jamais `db push`.
CMD ["node", "dist/main.js"]

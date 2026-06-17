# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/
COPY packages/config/package.json packages/config/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
COPY packages/utils/package.json packages/utils/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/web apps/web
COPY packages packages
COPY tsconfig.json ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo build --filter=@pipewatch/web...

FROM base AS runner
RUN addgroup -g 1001 pipewatch && adduser -u 1001 -G pipewatch -D pipewatch
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static

USER pipewatch
EXPOSE 3001
CMD ["node", "apps/web/server.js"]

# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/admin/package.json apps/admin/
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/db-admin/package.json packages/db-admin/
COPY packages/github-app-auth/package.json packages/github-app-auth/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
COPY packages/utils/package.json packages/utils/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/admin apps/admin
COPY packages packages
COPY tsconfig.json ./
RUN pnpm turbo build --filter=@pipewatch/admin...

FROM base AS runner
RUN addgroup -g 1001 pipewatch && adduser -u 1001 -G pipewatch -D pipewatch
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/admin/dist ./apps/admin/dist
COPY --from=build /app/apps/admin/web/dist ./apps/admin/web/dist
COPY --from=build /app/apps/admin/package.json ./apps/admin/
COPY --from=build /app/apps/admin/node_modules ./apps/admin/node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/packages/db/node_modules ./packages/db/node_modules

USER pipewatch
EXPOSE 3002
CMD ["node", "apps/admin/dist/index.js"]

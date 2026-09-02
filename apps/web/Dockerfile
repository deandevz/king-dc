# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.10.0 --activate
WORKDIR /app

FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
# O destino dos rewrites é resolvido no `next build`, não em runtime: por isso o
# alvo interno da API entra como build arg (decisão D16).
ARG API_INTERNAL_URL=http://api:3000
ENV API_INTERNAL_URL=$API_INTERNAL_URL
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json eslint.base.mjs ./
COPY packages/contracts ./packages/contracts
COPY apps/web ./apps/web
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "web..." --filter "@kingdc/contracts..."
RUN pnpm --filter @kingdc/contracts build && pnpm --filter web build

FROM base AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# `output: standalone` não inclui public/ nem .next/static: os dois são copiados à mão.
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]

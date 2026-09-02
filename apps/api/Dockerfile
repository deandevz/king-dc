# syntax=docker/dockerfile:1

# Node 24 LTS. Os módulos nativos (sharp, @node-rs/argon2) são instalados DENTRO da
# imagem para pegar os binários musl do Alpine — nunca copiar node_modules do host.
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.10.0 --activate
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json eslint.base.mjs ./
COPY packages/contracts ./packages/contracts
COPY apps/api ./apps/api
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "api..." --filter "@kingdc/contracts..."
RUN pnpm --filter @kingdc/contracts build \
 && pnpm --filter api exec prisma generate \
 && pnpm --filter api build
# Pasta de produção só com `dependencies`; sem isto a imagem carregava vitest,
# testcontainers, tsx e eslint (964 MB). O CLI do prisma vem como peer do client e é
# podado pelo docker-prune.mjs: as migrações rodam por dist/migrate.js, sem ele.
# `deploy` respeita o .gitignore, então `dist/` entra à parte, abaixo.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter api deploy --prod --legacy /app/deploy \
 && node apps/api/docker-prune.mjs /app/deploy

FROM base AS runtime
ENV NODE_ENV=production
RUN mkdir -p /data/avatars && chown -R node:node /data
WORKDIR /app/apps/api
COPY --from=build --chown=node:node /app/deploy ./
COPY --from=build --chown=node:node /app/apps/api/dist ./dist
USER node
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]

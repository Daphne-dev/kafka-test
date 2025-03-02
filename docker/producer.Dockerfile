FROM node:22-alpine AS base
RUN apk update
RUN npm install -g pnpm

ENV PNPM_HOME=/app/.pnpm
ENV PATH=$PNPM_HOME:$PATH
 
FROM base AS builder

WORKDIR /app

RUN pnpm add -g turbo@2.4.4
COPY . .
 
RUN turbo prune producer --docker

FROM base AS installer

WORKDIR /app

COPY --from=builder /app/out/json/ .
RUN pnpm install --frozen-lockfile
 
COPY --from=builder /app/out/full/ .
RUN pnpm turbo build --filter=producer

FROM base AS runner
WORKDIR /app

COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/packages ./packages

COPY --from=installer /app/apps/producer/package.json ./apps/producer/package.json
COPY --from=installer /app/apps/producer/tsconfig.json ./apps/producer/tsconfig.json
COPY --from=installer /app/apps/producer/node_modules ./apps/producer/node_modules

WORKDIR /app/apps/producer

EXPOSE 3000

ENV NODE_ENV=development

CMD ["pnpm", "run", "dev"]

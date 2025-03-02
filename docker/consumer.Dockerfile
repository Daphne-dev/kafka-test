FROM node:22-alpine AS base
RUN apk update
RUN npm install -g pnpm

ENV PNPM_HOME=/app/.pnpm
ENV PATH=$PNPM_HOME:$PATH
 
FROM base AS builder

WORKDIR /app

RUN pnpm add -g turbo@2.4.4
COPY . .
 
RUN turbo prune consumer --docker

FROM base AS installer

WORKDIR /app

COPY --from=builder /app/out/json/ .
RUN pnpm install --frozen-lockfile
 
COPY --from=builder /app/out/full/ .
RUN pnpm turbo build --filter=consumer

FROM base AS runner
WORKDIR /app

COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/packages ./packages

COPY --from=installer /app/apps/consumer/package.json ./apps/consumer/package.json
COPY --from=installer /app/apps/consumer/tsconfig.json ./apps/consumer/tsconfig.json
COPY --from=installer /app/apps/consumer/node_modules ./apps/consumer/node_modules

WORKDIR /app/apps/consumer

EXPOSE 3000

ENV NODE_ENV=development

CMD ["pnpm", "run", "dev"]

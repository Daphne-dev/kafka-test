FROM node:22-alpine AS base
RUN apk update
RUN npm install -g pnpm@8.14.0

ENV PNPM_HOME=/app/.pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN pnpm add -g turbo@2.4.4 

FROM base AS runner

WORKDIR /app

COPY . .
 
RUN pnpm install --frozen-lockfile

EXPOSE 3000

ENV NODE_ENV=development

CMD ["pnpm", "turbo","run", "dev", "--filter=consumer"]

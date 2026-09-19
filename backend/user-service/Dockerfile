FROM node:22.20.0-alpine

RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/service-kit/package.json packages/service-kit/package.json
COPY packages/app-client/package.json packages/app-client/package.json
COPY backend/auth-service/package.json backend/auth-service/package.json
COPY backend/user-service/package.json backend/user-service/package.json
COPY backend/books-service/package.json backend/books-service/package.json
COPY backend/sales-service/package.json backend/sales-service/package.json
COPY backend/payment-service/package.json backend/payment-service/package.json
COPY backend/api-key-service/package.json backend/api-key-service/package.json
COPY backend/cart-service/package.json backend/cart-service/package.json
COPY frontend/web/package.json frontend/web/package.json
COPY frontend/admin/package.json frontend/admin/package.json

RUN pnpm install --frozen-lockfile --filter @rwa/user-service...

COPY packages ./packages
COPY backend/user-service ./backend/user-service

ENV DATABASE_URL="postgresql://rwa:rwa@db:5432/rwa"
RUN pnpm --filter @rwa/db db:generate

EXPOSE 3005
CMD ["pnpm", "--filter", "@rwa/user-service", "start"]

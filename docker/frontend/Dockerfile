FROM node:22.20.0-alpine AS build

RUN apk add --no-cache libc6-compat
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
COPY backend/catalog-service/package.json backend/catalog-service/package.json
COPY backend/order-service/package.json backend/order-service/package.json
COPY backend/payment-service/package.json backend/payment-service/package.json
COPY backend/store-service/package.json backend/store-service/package.json
COPY backend/inventory-service/package.json backend/inventory-service/package.json
COPY frontend/web/package.json frontend/web/package.json
COPY frontend/admin/package.json frontend/admin/package.json

RUN pnpm install --frozen-lockfile --filter @rwa/web... --filter @rwa/admin...

COPY packages/shared ./packages/shared
COPY packages/app-client ./packages/app-client
COPY frontend ./frontend

ARG VITE_UNLEASH_URL=http://localhost:4242/api/frontend
ARG VITE_UNLEASH_CLIENT_KEY=
ARG VITE_OPENPANEL_API_URL=http://localhost:3350/api
ARG VITE_OPENPANEL_ENABLED=
ARG VITE_OPENPANEL_CLIENT_ID=
ENV VITE_UNLEASH_URL=$VITE_UNLEASH_URL \
    VITE_UNLEASH_CLIENT_KEY=$VITE_UNLEASH_CLIENT_KEY \
    VITE_OPENPANEL_API_URL=$VITE_OPENPANEL_API_URL \
    VITE_OPENPANEL_ENABLED=$VITE_OPENPANEL_ENABLED \
    VITE_OPENPANEL_CLIENT_ID=$VITE_OPENPANEL_CLIENT_ID

RUN pnpm --filter @rwa/web build && pnpm --filter @rwa/admin build

FROM nginx:1.27-alpine

RUN apk add --no-cache openssl curl \
  && rm -f /etc/nginx/conf.d/default.conf \
  && mkdir -p /etc/nginx/certs \
  && openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout /etc/nginx/certs/localhost.key \
    -out /etc/nginx/certs/localhost.crt \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
COPY docker/frontend/nginx.conf /etc/nginx/nginx.conf
COPY docker/frontend/api-split.conf /etc/nginx/rwa/api-split.conf
COPY docker/frontend/api-gateway.conf /etc/nginx/rwa/api-gateway.conf
COPY docker/frontend/media.conf /etc/nginx/rwa/media.conf
COPY docker/frontend/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && cp /etc/nginx/rwa/api-split.conf /etc/nginx/rwa/api.conf

COPY --from=build /app/frontend/web/dist /usr/share/nginx/html/web
COPY --from=build /app/frontend/admin/dist /usr/share/nginx/html/admin

EXPOSE 3000 3004
ENTRYPOINT ["/entrypoint.sh"]

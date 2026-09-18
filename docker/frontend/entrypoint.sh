#!/bin/sh
set -eu

mkdir -p /etc/nginx/certs
if [ ! -f /etc/nginx/certs/localhost.crt ]; then
  echo "Generating self-signed TLS cert for localhost"
  openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout /etc/nginx/certs/localhost.key \
    -out /etc/nginx/certs/localhost.crt \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
fi

if [ -n "${NGINX_GATEWAY:-}" ]; then
  echo "nginx API proxy → ${NGINX_GATEWAY}"
  sed "s|__GATEWAY__|${NGINX_GATEWAY}|g" /etc/nginx/rwa/api-gateway.conf > /etc/nginx/rwa/api.conf
else
  echo "nginx API proxy → Docker service ports"
  cp /etc/nginx/rwa/api-split.conf /etc/nginx/rwa/api.conf
fi

exec nginx -g "daemon off;"

COMPOSE  ?= docker compose
PROFILE  ?= --profile backend --profile openpanel --profile elasticsearch --profile gateway --profile observability --profile frontend --profile minio --profile mail
BACKENDS := auth-service user-service books-service sales-service payment-service api-key-service cart-service unleash
OPENPANEL := op-proxy op-db op-kv op-ch op-api op-dashboard op-worker
ELASTIC := elasticsearch kibana filebeat
GATEWAY := kong
OBSERVABILITY := otel-collector jaeger prometheus grafana
FRONTEND := frontend
MINIO := minio minio-init
MAIL := mailpit
CORE := $(BACKENDS) $(FRONTEND) $(MINIO) $(MAIL)
STACK := $(CORE) $(OPENPANEL) $(ELASTIC) $(GATEWAY) $(OBSERVABILITY)

# make up services=user,payment,books
# make up all
services ?=
WANT_ALL := $(filter all,$(MAKECMDGOALS))

.DEFAULT_GOAL := help

.PHONY: help up down on off ps logs build db restart all up-all down-all

help:
	@echo "Docker Compose backends (Postgres stays up unless you stop db)"
	@echo ""
	@echo "  make up                                 Build and start db + backends + Unleash + nginx (HTTPS) + MinIO + Mailpit"
	@echo "  make up all                             Build and start every Compose service"
	@echo "  make up services=user,payment,books     Build and start those backends"
	@echo "  make up services=openpanel              Start OpenPanel (ClickHouse + dashboard)"
	@echo "  make up services=elasticsearch          Start Elasticsearch, Kibana, Filebeat"
	@echo "  make up services=gateway                Start Kong in front of the app APIs"
	@echo "  make up services=observability          Start collector, Jaeger, Prometheus, Grafana"
	@echo "  make down                               Stop app backends, nginx, MinIO, and Mailpit (keep Postgres)"
	@echo "  make down all                           Stop every Compose service except Postgres"
	@echo "  make down services=payment              Stop those backends"
	@echo "  make on services=auth,books             Start without rebuilding"
	@echo "  make off services=sales                 Stop those backends"
	@echo "  make restart services=user              Restart those backends"
	@echo "  make ps                                 Show container status"
	@echo "  make logs                               Tail backend and nginx logs"
	@echo "  make logs services=books                Tail those services"
	@echo "  make db                                 Start Postgres only"
	@echo "  make build                              Rebuild default images (backends + nginx)"
	@echo "  make build services=auth                Rebuild those images"
	@echo ""
	@echo "Short names: auth, user, books, sales, payment, api-key, cart, unleash, openpanel, elasticsearch, gateway, observability, frontend, minio, mail"
	@echo "Full names:  $(BACKENDS)"

# Resolve services=user,payment,books -> user-service payment-service books-service
# Empty services= means db (on up) + app backends + Unleash + nginx + MinIO + Mailpit. "all" means every optional stack too.
define resolve
	if [ -n "$(WANT_ALL)" ] && [ -z "$(services)" ]; then \
	  echo $(STACK); \
	elif [ -z "$(services)" ]; then \
	  echo $(CORE); \
	else \
	  echo "$(services)" | awk -F, '{ \
	    for (i = 1; i <= NF; i++) { \
	      s = $$i; \
	      gsub(/^[ \t]+|[ \t]+$$/, "", s); \
	      if (s == "") continue; \
	      k = tolower(s); \
	      if (k == "all") { \
	        n = split("$(STACK)", arr, " "); \
	        for (j = 1; j <= n; j++) print arr[j]; \
	      } \
	      else if (k == "auth" || k == "auth-service") print "auth-service"; \
	      else if (k == "user" || k == "user-service") print "user-service"; \
	      else if (k == "books" || k == "book" || k == "books-service") print "books-service"; \
	      else if (k == "sales" || k == "sale" || k == "sales-service") print "sales-service"; \
	      else if (k == "payment" || k == "payments" || k == "payment-service") print "payment-service"; \
	      else if (k == "api-key" || k == "apikey" || k == "api_key" || k == "api-key-service" || k == "keys") print "api-key-service"; \
	      else if (k == "cart" || k == "carts" || k == "cart-service") print "cart-service"; \
	      else if (k == "unleash" || k == "flags" || k == "feature-flags") print "unleash"; \
	      else if (k == "openpanel" || k == "op" || k == "analytics") { \
	        n = split("$(OPENPANEL)", arr, " "); \
	        for (j = 1; j <= n; j++) print arr[j]; \
	      } \
	      else if (k == "elasticsearch" || k == "elastic" || k == "es" || k == "elk" || k == "kibana") { \
	        n = split("$(ELASTIC)", arr, " "); \
	        for (j = 1; j <= n; j++) print arr[j]; \
	      } \
	      else if (k == "gateway" || k == "api-gateway" || k == "apigateway" || k == "kong") print "$(GATEWAY)"; \
	      else if (k == "observability" || k == "otel" || k == "perf" || k == "prometheus" || k == "grafana" || k == "jaeger") { \
	        n = split("$(OBSERVABILITY)", arr, " "); \
	        for (j = 1; j <= n; j++) print arr[j]; \
	      } \
	      else if (k == "frontend" || k == "frontends" || k == "web" || k == "admin" || k == "nginx" || k == "ui") print "$(FRONTEND)"; \
	      else if (k == "minio" || k == "s3" || k == "storage" || k == "object-storage") { \
	        n = split("$(MINIO)", arr, " "); \
	        for (j = 1; j <= n; j++) print arr[j]; \
	      } \
	      else if (k == "mail" || k == "mailpit" || k == "smtp") print "$(MAIL)"; \
	      else if (k == "db" || k == "postgres") print "db"; \
	      else { print "Unknown service: " s > "/dev/stderr"; exit 1 } \
	    } \
	  }' | tr '\n' ' '; \
	  echo; \
	fi
endef

guard = if [ -n "$(services)" ] && [ -z "$$names" ]; then exit 1; fi

# Default `make up` / `make up all` always bring Postgres with the chosen apps.
with_db = \
	if [ -z "$(services)" ] || [ "$(services)" = "all" ] || [ -n "$(WANT_ALL)" ]; then \
	  names="db $$names"; \
	fi

up:
	@names="$$($(resolve))" || exit 1; \
	$(guard); \
	$(with_db); \
	echo "Starting $$names"; \
	$(COMPOSE) $(PROFILE) up -d --build $$names

down:
	@names="$$($(resolve))" || exit 1; \
	$(guard); \
	echo "Stopping $$names"; \
	$(COMPOSE) stop $$names

on:
	@names="$$($(resolve))" || exit 1; \
	$(guard); \
	$(with_db); \
	echo "Starting $$names"; \
	$(COMPOSE) $(PROFILE) up -d --no-deps $$names

off:
	@names="$$($(resolve))" || exit 1; \
	$(guard); \
	echo "Stopping $$names"; \
	$(COMPOSE) stop $$names

restart:
	@names="$$($(resolve))" || exit 1; \
	$(guard); \
	echo "Restarting $$names"; \
	$(COMPOSE) restart $$names

ps:
	$(COMPOSE) $(PROFILE) ps

logs:
	@names="$$($(resolve))" || exit 1; \
	$(guard); \
	$(COMPOSE) logs -f --tail=100 $$names

db:
	$(COMPOSE) up -d db

build:
	@names="$$($(resolve))" || exit 1; \
	$(guard); \
	echo "Building $$names"; \
	$(COMPOSE) $(PROFILE) build $$names

# `make all` and `make up-all` are the full stack. `make up all` uses WANT_ALL on `up`; this target is then a no-op.
all:
ifneq ($(filter-out all,$(MAKECMDGOALS)),)
	@:
else
	@$(MAKE) up services=all
endif

up-all:
	@$(MAKE) up services=all

down-all:
	@$(MAKE) down services=all

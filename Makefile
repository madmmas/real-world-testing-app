COMPOSE  ?= docker compose
PROFILE  ?= --profile backend --profile openpanel
BACKENDS := auth-service user-service books-service sales-service payment-service api-key-service unleash
OPENPANEL := op-proxy op-db op-kv op-ch op-api op-dashboard op-worker

# make up services=user,payment,books
services ?=

.DEFAULT_GOAL := help

.PHONY: help up down on off ps logs build db restart

help:
	@echo "Docker Compose backends (Postgres stays up unless you stop db)"
	@echo ""
	@echo "  make up                                 Build and start every backend"
	@echo "  make up services=user,payment,books     Build and start those backends"
	@echo "  make up services=openpanel              Start OpenPanel (ClickHouse + dashboard)"
	@echo "  make down                               Stop every backend (keep Postgres)"
	@echo "  make down services=payment              Stop those backends"
	@echo "  make on services=auth,books             Start without rebuilding"
	@echo "  make off services=sales                 Stop those backends"
	@echo "  make restart services=user              Restart those backends"
	@echo "  make ps                                 Show container status"
	@echo "  make logs                               Tail all backend logs"
	@echo "  make logs services=books                Tail those backends"
	@echo "  make db                                 Start Postgres only"
	@echo "  make build                              Rebuild every backend image"
	@echo "  make build services=auth                Rebuild those images"
	@echo ""
	@echo "Short names: auth, user, books, sales, payment, api-key, unleash, openpanel"
	@echo "Full names:  $(BACKENDS)"

# Resolve services=user,payment,books -> user-service payment-service books-service
# Empty services= means every backend.
define resolve
	if [ -z "$(services)" ]; then \
	  echo $(BACKENDS); \
	else \
	  echo "$(services)" | awk -F, '{ \
	    for (i = 1; i <= NF; i++) { \
	      s = $$i; \
	      gsub(/^[ \t]+|[ \t]+$$/, "", s); \
	      if (s == "") continue; \
	      k = tolower(s); \
	      if (k == "auth" || k == "auth-service") print "auth-service"; \
	      else if (k == "user" || k == "user-service") print "user-service"; \
	      else if (k == "books" || k == "book" || k == "books-service") print "books-service"; \
	      else if (k == "sales" || k == "sale" || k == "sales-service") print "sales-service"; \
	      else if (k == "payment" || k == "payments" || k == "payment-service") print "payment-service"; \
	      else if (k == "api-key" || k == "apikey" || k == "api_key" || k == "api-key-service" || k == "keys") print "api-key-service"; \
	      else if (k == "unleash" || k == "flags" || k == "feature-flags") print "unleash"; \
	      else if (k == "openpanel" || k == "op" || k == "analytics") { \
	        n = split("$(OPENPANEL)", arr, " "); \
	        for (j = 1; j <= n; j++) print arr[j]; \
	      } \
	      else if (k == "db" || k == "postgres") print "db"; \
	      else { print "Unknown service: " s > "/dev/stderr"; exit 1 } \
	    } \
	  }' | tr '\n' ' '; \
	  echo; \
	fi
endef

guard = if [ -n "$(services)" ] && [ -z "$$names" ]; then exit 1; fi

up:
	@names="$$($(resolve))" || exit 1; \
	$(guard); \
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
	$(COMPOSE) ps

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

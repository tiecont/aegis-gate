SHELL := /bin/bash
.SHELLFLAGS := -euo pipefail -c
GO := GOTOOLCHAIN=go1.27.4 go
COMPOSE := docker compose --env-file .local/compose.env --env-file .local/fixture-images.env -f infra/compose/compose.yaml
GO_PACKAGES := ./apps/control-api/... ./apps/config-publisher/... ./internal/... ./packages/test-fixtures/...
NODE_CMD = $$(scripts/node-path.sh)
NODE_PATH = $$(dirname "$(NODE_CMD)")
export GOTOOLCHAIN := go1.27.4

.PHONY: bootstrap fmt fmt-check lint unit integration security-negative build check dev-up dev-down fixtures contracts-generate security-scan gate-selftest fixture-images
bootstrap:
	python3 scripts/bootstrap.py
	PATH="$(NODE_PATH):$$PATH" npm ci --ignore-scripts
	PATH="$(NODE_PATH):$$PATH" npm --prefix apps/dashboard ci --ignore-scripts
	$(GO) mod download
	cargo +1.99.1 fetch --locked --manifest-path apps/edge/Cargo.toml

contracts-generate:
	PATH="$(NODE_PATH):$$PATH" npm run contracts:generate

fmt:
	gofmt -w apps/control-api apps/config-publisher internal packages/test-fixtures
	cargo +1.99.1 fmt --all --manifest-path apps/edge/Cargo.toml
	PATH="$(NODE_PATH):$$PATH" npm run format
	PATH="$(NODE_PATH):$$PATH" npm --prefix apps/dashboard run fmt

fmt-check:
	test -z "$$(gofmt -l apps/control-api apps/config-publisher internal packages/test-fixtures)"
	cargo +1.99.1 fmt --all --check --manifest-path apps/edge/Cargo.toml
	PATH="$(NODE_PATH):$$PATH" npm run format:check
	PATH="$(NODE_PATH):$$PATH" npm --prefix apps/dashboard run fmt:check

lint:
	$(GO) vet $(GO_PACKAGES)
	cargo +1.99.1 clippy --workspace --all-targets --locked --manifest-path apps/edge/Cargo.toml -- -D warnings
	PATH="$(NODE_PATH):$$PATH" npm run contracts:check
	PATH="$(NODE_PATH):$$PATH" npm --prefix apps/dashboard run lint
	PATH="$(NODE_PATH):$$PATH" npm --prefix apps/dashboard run typecheck

unit:
	python3 scripts/dev-secrets.test.py
	python3 scripts/git_history_preflight_test.py
	python3 scripts/image_identity_test.py
	"$(NODE_CMD)" --test spikes/edge-comparison/*.test.mjs
	"$(NODE_CMD)" spikes/edge-comparison/extract-baseline.mjs --check
	$(GO) test -race $(GO_PACKAGES)
	cargo +1.99.1 test --workspace --locked --manifest-path apps/edge/Cargo.toml
	PATH="$(NODE_PATH):$$PATH" npm run contracts:test
	PATH="$(NODE_PATH):$$PATH" npm --prefix apps/dashboard test

fixtures:
	python3 scripts/dev-secrets.py
	@if ! test -d .local/pki; then $(GO) run ./packages/test-fixtures/cmd/fixtures --out .local/pki; fi

fixture-images: fixtures
	python3 scripts/build-fixture-images.py

dev-up: fixture-images
	$(COMPOSE) up -d --wait --wait-timeout 90

dev-down:
	$(COMPOSE) down

integration: dev-up
	AEGIS_TENANCY_INTEGRATION=1 $(GO) test -race $(GO_PACKAGES) -run Integration -count=1
	PATH="$(NODE_PATH):$$PATH" "$(NODE_CMD)" scripts/contract-integration.mjs
	python3 scripts/integration.py
	python3 scripts/fixture-image-integration.py
	PATH="$(NODE_PATH):$$PATH" npm --prefix apps/dashboard run integration

security-negative:
	python3 scripts/dev-secrets.test.py
	python3 scripts/image_identity_test.py
	$(GO) test -race $(GO_PACKAGES) -run 'Negative|IntegrationLocalPKI' -count=1
	cargo +1.99.1 test --workspace --locked --manifest-path apps/edge/Cargo.toml negative_
	PATH="$(NODE_PATH):$$PATH" "$(NODE_CMD)" --test --test-name-pattern='negative' scripts/contracts.test.mjs

build:
	mkdir -p .local/bin
	$(GO) build -o .local/bin/control-api ./apps/control-api/cmd/control-api
	$(GO) build -o .local/bin/config-publisher ./apps/config-publisher/cmd/config-publisher
	$(GO) build -o .local/bin/fixtures ./packages/test-fixtures/cmd/fixtures
	cargo +1.99.1 build --workspace --locked --manifest-path apps/edge/Cargo.toml
	PATH="$(NODE_PATH):$$PATH" npm --prefix apps/dashboard run build

gate-selftest:
	PATH="$(NODE_PATH):$$PATH" "$(NODE_CMD)" scripts/gate-selftest.mjs

security-scan:
	PATH="$(NODE_PATH):$$PATH" bash scripts/security-scan.sh

check: fmt-check lint unit build integration security-negative gate-selftest

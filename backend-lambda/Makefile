# Makefile for SAM build integration
# SAM calls `make build-UnblockAgentFunction` during `sam build`

build-UnblockAgentFunction:
	npm ci
	npm run build
	cp -r dist $(ARTIFACTS_DIR)/
	cp package.json $(ARTIFACTS_DIR)/
	cp package-lock.json $(ARTIFACTS_DIR)/ 2>/dev/null || true
	cd $(ARTIFACTS_DIR) && npm ci --production

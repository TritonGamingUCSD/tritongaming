.PHONY: dev build start install clean lint type-check help

# Default target
.DEFAULT_GOAL := help

## dev: Start the development server with Turbopack
dev:
	npm run dev

## build: Build the production bundle
build:
	npm run build

## start: Start the production server (requires build first)
start:
	npm run start

## install: Install all dependencies
install:
	npm install

## clean: Remove build artifacts and node_modules
clean:
	rm -rf .next node_modules

## clean-build: Remove only the .next build directory
clean-build:
	rm -rf .next

## lint: Run ESLint
lint:
	npm run lint

## type-check: Run TypeScript type checking
type-check:
	npm run type-check

## fresh: Clean, install, and start dev server
fresh: clean install dev

## help: Show this help message
help:
	@echo "Triton Gaming Website — Available commands:"
	@echo ""
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## /  make /' | column -t -s ':'

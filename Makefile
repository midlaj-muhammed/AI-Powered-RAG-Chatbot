.PHONY: help build up down restart logs shell migrate makemigrations createsuperuser test lint frontend-install

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

build: ## Build all Docker images
	docker compose build

up: ## Start all services
	docker compose up -d

down: ## Stop all services
	docker compose down

restart: ## Restart all services
	docker compose restart

logs: ## Tail logs from all services
	docker compose logs -f

logs-backend: ## Tail backend logs
	docker compose logs -f backend

logs-frontend: ## Tail frontend logs
	docker compose logs -f frontend

shell: ## Open Django shell
	docker compose exec backend python manage.py shell

dbshell: ## Open PostgreSQL shell
	docker compose exec db psql -U raguser -d ragchatbot

migrate: ## Run Django migrations
	docker compose exec backend python manage.py migrate

makemigrations: ## Create new migrations
	docker compose exec backend python manage.py makemigrations

createsuperuser: ## Create admin superuser
	docker compose exec backend python manage.py createsuperuser

test-backend: ## Run backend tests
	docker compose exec backend pytest -v --tb=short

test-frontend: ## Run frontend tests
	docker compose exec frontend npm run test

lint-backend: ## Lint backend code
	docker compose exec backend ruff check .

lint-frontend: ## Lint frontend code
	docker compose exec frontend npm run lint

format: ## Format all code
	docker compose exec backend ruff format .
	docker compose exec frontend npm run format

clean: ## Remove all containers, volumes, and images
	docker compose down -v --rmi local

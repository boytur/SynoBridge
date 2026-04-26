.PHONY: dev build stop clean

dev:
	docker compose up --build

prod:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d

stop:
	docker compose down

clean:
	rm -rf backend/bin frontend/dist

reset-db:
	docker compose down -v

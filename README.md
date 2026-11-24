# Trip Expenses

Split shared trip expenses between travelers and see who owes whom.

Each expense has a description, the traveler who paid it, and the share that
falls on each traveler. Every traveler owes the payer their share; the app
shows those debts per pair and then offsets each pair into a final settlement.

## Stack

- **frontend/**: React + TypeScript (Vite)
- **backend/**: Go HTTP server with [Connect](https://connectrpc.com), GORM with PostgreSQL
- **proto/**: API definitions (protobuf), generated with `buf`
- `docker-compose.yml` runs the production stack: Postgres, the backend, and the
  frontend (built and served by nginx, which proxies API calls to the backend)
- `docker-compose.dev.yml` runs the development stack with hot reload: Postgres,
  the backend under [Air](https://github.com/air-verse/air), and the Vite dev server

## Running with Docker (production)

Both compose files read the database credentials and the backend's
`DATABASE_URL` from `.docker.env` (gitignored). Create it once from the example
and set a password in both places:

```sh
cp .docker.env.example .docker.env
```

```sh
docker compose up --build
```

Then open http://localhost:1604. The backend is also exposed on
http://localhost:8080/healthz and Postgres on `localhost:5435`
(5435 on the host so it does not clash with a native Postgres on 5432 or other
projects).
Stop with `docker compose down` (add `-v` to also delete the database volume).

## Developing with Docker (hot reload)

```sh
docker compose -f docker-compose.dev.yml up --build
```

In GoLand, the **Dev watch** run configuration runs the same command.

This starts the Vite dev server on http://localhost:1604, the backend on
http://localhost:8080 and Postgres on `localhost:5435`. `backend/` and
`frontend/` are bind-mounted into the containers: Air rebuilds and restarts the
Go server on every change, and Vite hot-reloads the page. After changing
`package.json`, add `-V` to the command so the container's `node_modules`
volume is recreated.

The dev and production stacks use the same ports and share the database volume,
so run one at a time (`docker compose down` before starting the other).
Stop the dev stack with `docker compose -f docker-compose.dev.yml down`.

## Local development

To run the backend and frontend natively instead, start only the database in Docker:

```sh
# Database (needed by the backend)
docker compose up -d db

# Backend (http://localhost:8080/healthz), reads DATABASE_URL from backend/.env (copy .env.example)
cd backend && go run ./cmd/server

# Frontend (http://localhost:1604), proxies API calls to the backend
cd frontend && npm install && npm run dev
```

## Regenerating API code

Generated code is checked in under `backend/gen` and `frontend/src/gen`.
After changing `proto/`, run from the repo root (needs `protoc-gen-go` and
`protoc-gen-connect-go` on `PATH`, and `npm install` in `frontend/`):

```sh
buf generate
```

## Tests

```sh
cd backend && go test ./...
```

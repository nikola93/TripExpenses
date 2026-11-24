# Trip Expenses

Split shared trip expenses between travelers and see who owes whom.

Each expense has a description, the traveler who paid it, and the share that
falls on each traveler. Every traveler owes the payer their share; the app
shows those debts per pair and then offsets each pair into a final settlement.

## Stack

- **frontend/**: React + TypeScript (Vite)
- **backend/**: Go HTTP server with [Connect](https://connectrpc.com), GORM with PostgreSQL
- **proto/**: API definitions (protobuf), generated with `buf`
- `docker-compose.yml` runs the whole app: Postgres, the backend, and the
  frontend (built and served by nginx, which proxies API calls to the backend)

## Running with Docker

```sh
docker compose up --build
```

Then open http://localhost:1604. The backend is also exposed on
http://localhost:8080/healthz and Postgres on `localhost:5434`
(5434 on the host so it does not clash with a native Postgres on 5432).
Stop with `docker compose down` (add `-v` to also delete the database volume).

To rebuild and restart the backend and frontend automatically whenever their code changes,
run `docker compose watch` instead (or alongside `docker compose up -d`).

For frontend hot module reload inside Docker, add the `dev` profile:

```sh
docker compose --profile dev watch
```

This also starts the Vite dev server on http://localhost:1605. Edits in
`frontend/src` are synced into the container and hot-reloaded without a rebuild.

## Local development

For hot reload, run only the database in Docker and the rest natively:

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

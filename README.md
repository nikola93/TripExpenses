# Trip Expenses

Split shared trip expenses between travelers and see who owes whom.

Each expense has a description, the traveler who paid it, and the share that
falls on each traveler. Every traveler owes the payer their share; the app
shows those debts per pair and then offsets each pair into a final settlement.

## Stack

- **frontend/**: React + TypeScript (Vite)
- **backend/**: Go HTTP server with [Connect](https://connectrpc.com), GORM with PostgreSQL
- **proto/**: API definitions (protobuf), generated with `buf`
- `docker-compose.yml` runs a local Postgres

## Getting started

```sh
# Database (needed by the backend)
docker compose up -d db

# Backend (http://localhost:8080/healthz), DATABASE_URL defaults to the compose database
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

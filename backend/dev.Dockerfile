# Development image: runs the server under Air, which rebuilds and restarts it
# on every Go source change. docker-compose.dev.yml bind-mounts ./backend over
# /workspace, so the copied source is only a fallback.
FROM golang:1.26-alpine

RUN apk add --no-cache git

WORKDIR /workspace

RUN go install github.com/air-verse/air@latest
ENV PATH="/go/bin:${PATH}"

# Cache modules in their own layer.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

EXPOSE 8080
CMD ["air", "-c", ".air.toml"]

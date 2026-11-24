# Development image: runs the Vite dev server with hot module reload.
# Source files are synced in by `docker compose watch` (see docker-compose.yml).
FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
EXPOSE 1604
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

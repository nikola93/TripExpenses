# Development image: runs the Vite dev server with hot module reload.
# docker-compose.dev.yml bind-mounts ./frontend over /app.
FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
EXPOSE 1604
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

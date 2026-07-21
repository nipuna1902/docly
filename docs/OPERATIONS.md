# Setup, operations, and troubleshooting

## Prerequisites

- Node.js 20 or newer (the server Dockerfile uses Node 20)
- PostgreSQL 15+ and Redis 7+ for manual execution, or Docker Compose
- npm (lockfiles are committed separately in `client/` and `server/`)

## Local development

1. Start PostgreSQL and Redis. Docker is convenient even when running app processes locally:

   ```bash
   docker compose up -d postgres redis
   ```

2. Configure `server/.env` and `client/.env` as described in the [server](./SERVER.md) and [client](./CLIENT.md) guides.

3. Install and migrate the API:

   ```bash
   cd server
   npm install
   npx prisma generate
   npx prisma migrate deploy
   npm run dev
   ```

4. In another terminal, install and start the client:

   ```bash
   cd client
   npm install
   npm run dev
   ```

Open the Vite URL (normally `http://localhost:5173`). The API listens on port 5000.

## Compose environment

`docker-compose.yml` starts `postgres`, `redis`, and `server`. It does **not** define a client container. After `docker compose up --build`, still run the Vite client locally (or serve a separately built client) and point it at `http://localhost:5000`.

Compose uses a named `postgres_data` volume, so `docker compose down` keeps the database. `docker compose down -v` removes that persistent volume and destroys local database data; use it only when a clean database is intended.

The current Compose `JWT_SECRET` is a development placeholder and must be replaced with a secret managed outside source control before deployment.

## Database commands

Run these from `server/`:

```bash
npx prisma generate                 # regenerate client after schema changes
npx prisma migrate dev --name name  # create/apply local migration
npx prisma migrate deploy           # apply committed migrations
npx prisma studio                   # inspect data in a local browser UI
```

## Production deployment checklist

- Set strong, managed `JWT_SECRET`, production `DATABASE_URL`, and `REDIS_URL`.
- Set `ALLOWED_ORIGINS` to explicit HTTPS frontend origins.
- Host the client build and configure `VITE_API_URL` / `VITE_SOCKET_URL` at build time.
- Use TLS and a reverse proxy/load balancer that supports WebSocket upgrades.
- Run migrations as a controlled deployment step; take backups before schema changes.
- Add health checks, structured logs, error reporting, and Redis/PostgreSQL monitoring.
- Address all items in [Security notes](./SECURITY.md) before exposing the service publicly.

## Known verification status

There are no automated unit, integration, or end-to-end tests currently configured. The server's `npm test` script intentionally exits with an error. Client lint is available as `npm run lint`; client build is `npm run build`; server compilation is `npm run build`.

In this workspace, the client build could not be completed because its installed Vite/Rolldown optional native binding for Linux is missing. Reinstall dependencies in the client directory (`npm install`) to restore the platform binding; do not delete lockfiles merely to work around it.

## Troubleshooting

| Symptom | Check |
|---|---|
| Browser calls `undefined/api/...` | Set `VITE_API_URL`, then restart Vite because environment is read at startup/build time. |
| Socket does not connect | Verify `VITE_SOCKET_URL`, API port 5000, CORS origin, reverse-proxy WebSocket upgrade, and Redis availability. |
| API never listens | The API waits for Redis; check `REDIS_URL` and Redis logs. |
| Prisma errors | Verify `DATABASE_URL`, database availability, run `npx prisma generate`, and apply migrations. |
| Saved document appears old | Redis keys can be stale for 60 seconds, particularly for another collaborator. Reload after TTL or inspect PostgreSQL. |
| Reconnect shows conflict | This is expected if the offline draft's `baseVersion` differs from the server. Choose a version in the dialog. |

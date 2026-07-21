# Server guide

The server is an ESM TypeScript Express application. `index.ts` builds Express, creates the HTTP server, connects Redis, configures Socket.IO, and starts listening on fixed port `5000` only after both Redis clients connect.

## Module layout

| Path | Role |
|---|---|
| `index.ts` | Process bootstrap, permissive Express CORS plus configured CORS, Socket.IO and Redis adapter |
| `middleware/auth.ts` | JWT verification and `AuthRequest.userId` |
| `routes/auth.ts` | Signup/login and password hashing |
| `routes/documents.ts` | Authenticated CRUD, access checks, caching, versions |
| `routes/shares.ts` | Owner-only invitation/list/revocation |
| `prisma/client.ts` | Singleton Prisma client using `DATABASE_URL` |

## ESM build model

Local imports use `.js` extensions even though source files are `.ts`. TypeScript resolves them while compiling and produces matching JavaScript imports. Development uses the ts-node ESM loader; production compiles with `tsconfig.build.json` and runs `dist/index.js`.

```bash
cd server
npm run dev       # ts-node/esm
npm run build     # TypeScript compilation
npm run start     # compiled application
```

## Environment variables

Create `server/.env` for manual local execution:

```dotenv
DATABASE_URL=postgresql://postgres:password@localhost:5432/docly?schema=public
JWT_SECRET=replace-with-a-long-random-secret
REDIS_URL=redis://localhost:6379
ALLOWED_ORIGINS=http://localhost:5173
```

`ALLOWED_ORIGINS` is comma-separated when multiple browser origins are needed. `PORT` is not currently configurable; the server is hard-coded to 5000.

## Cache behavior

Document lists and individual document reads use a cache-aside pattern. Entries are keyed by requesting user. Writes invalidate keys only for the acting user, which can leave another collaborator's cached list or document stale for up to 60 seconds. This matters especially after sharing, revocation, or collaborative writes.

```mermaid
flowchart LR
  Q[Authenticated GET] --> K[Build user-scoped cache key]
  K --> R{Redis hit?}
  R -- Yes --> J[Parse cached JSON and return]
  R -- No --> P[Query PostgreSQL]
  P --> C[SETEX key 60 seconds]
  C --> J
```

The user ID in the key is an isolation aid: an authorized result cached for one user is not directly returned to another. It does not remove the need for authorization before a cache fill, and it does not make invalidation complete.

## Interview-relevant implementation details

- `import 'dotenv/config'` appears in the auth middleware and Prisma client, so environment loading occurs in imported modules rather than only the entry point. This works, but a single explicit bootstrap location is easier to audit.
- The Prisma client is a module singleton. That prevents excessive connection creation inside one Node process; in hot-reload/serverless contexts, global singleton handling may need further care.
- Redis requires separate publisher and subscriber connections because Redis clients in subscriber mode cannot issue normal commands. `pubClient.duplicate()` provides the second connection for the Socket.IO adapter.
- The server starts only after both Redis clients connect. This ensures Socket.IO adapter setup is ready but makes Redis an availability dependency for every API request as currently structured.

## Startup and failure behavior

Redis must be reachable before the process begins listening. The bootstrap uses a promise without a catch handler, so a Redis connection failure rejects rather than producing controlled retry/shutdown logging. Routes likewise rely on Express's default unhandled-error behavior; there is no request schema validation or central error middleware.

`cors()` is registered once with defaults and then again with `ALLOWED_ORIGINS`; review and consolidate this before production because the earlier middleware may already set permissive headers.

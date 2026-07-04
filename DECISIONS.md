# Engineering Decisions & Problem Solving

This document explains the key technical decisions made during the build of Docly, and how complex problems were tackled. Useful for interviews, code reviews, or revisiting the project.

---

## 1. Why PERN instead of MERN?

PostgreSQL was chosen over MongoDB for two reasons: SQL skills transfer more universally across jobs, and a document editor's data (users owning documents, documents shared with users) is inherently relational. MongoDB's flexible schema would have made enforcing referential integrity (e.g. "you can't delete a user who still has documents") harder.

---

## 2. Why Prisma over raw SQL?

Prisma was chosen as the ORM to avoid writing raw SQL while still learning relational concepts (foreign keys, migrations, schemas). The tradeoff: Prisma's abstractions sometimes hide what SQL is actually executing. The migration files (`prisma/migrations/`) are always worth reading — they show the exact SQL Prisma generates and make the database behaviour explicit.

---

## 3. ESM vs CommonJS — the hardest setup problem

The biggest setup challenge in the project was a three-way conflict between:
- Prisma 6 generating ESM-only TypeScript client code
- `ts-node` needing specific configuration to run ESM TypeScript
- Node's module resolution requiring `.js` extensions in import paths even for `.ts` source files

**Resolution:** Set `"type": "module"` in `package.json`, use `node --loader ts-node/esm` for development, and write `.js` extensions in all local imports (TypeScript resolves them to `.ts` at compile time, outputs `.js` at runtime). A separate `tsconfig.build.json` handles production compilation with `noEmit: false`.

**Lesson:** When a library generates code in a specific module format, the entire project needs to match. Mixing module systems causes cascading errors that look unrelated.

---

## 4. Real-time collaboration — Socket.io rooms

Each document gets its own Socket.io room named after its ID. When a user opens a document, they join that room via `socket.join(documentId)`. When they type, the server broadcasts to everyone else in the room via `socket.to(documentId).emit(...)` — the `.to()` call specifically excludes the sender, preventing echo loops.

The Redis adapter (`@socket.io/redis-adapter`) means this works across multiple server instances — broadcasts are published through Redis pub/sub so all instances receive and forward them to their connected clients.

---

## 5. Offline conflict detection — the standout feature

**The problem Google Docs has:** If you edit offline and someone else edits online, one version silently overwrites the other.

**Docly's solution:** Every document has an integer `version` field that increments atomically on every save (`version: { increment: 1 }` in Prisma, which compiles to `SET version = version + 1` in SQL — a single atomic operation). When a client saves, it sends its `baseVersion` (the version it started editing from). The server compares: if `baseVersion !== current.version`, someone else saved first — the server returns HTTP 409 with both the client's changes and the server's current content. The client then shows a side-by-side resolution UI.

This is called **optimistic concurrency control** — the same pattern Git uses for merge conflicts, and the same pattern used in production databases for concurrent write handling.

**TipTap integration challenge:** After switching from a plain textarea to TipTap, `editor.commands.setContent()` triggered the `onUpdate` callback, which fired a save, which caused false 409s on every page load. Fixed with an `isRemoteUpdate` ref flag that suppresses the `onUpdate` callback during programmatic content changes (initial load, remote updates, conflict resolution).

---

## 6. Redis caching — cache-aside pattern

Document reads are cached in Redis with a 60-second TTL using the cache-aside pattern:
1. Check Redis first
2. If found (cache hit), return immediately — no database query
3. If not found (cache miss), query Postgres, store result in Redis, return result

Cache keys are namespaced by user ID (`documents:user:1`, `document:5:user:1`) so users never see each other's cached data. Cache is explicitly invalidated on every write (POST, PUT, DELETE) to ensure consistency.

---

## 7. Docker — why three containers

Each service runs in its own container because they're independent processes with different runtimes and lifecycles:
- `docly_postgres` — the database engine
- `docly_redis` — the in-memory store
- `docly_server` — the Node application

This mirrors production deployments where each service is independently scalable and replaceable. The `depends_on` field in `docker-compose.yml` ensures startup order, and the CMD in the Dockerfile runs `prisma migrate deploy` before starting the server — so schema migrations apply automatically on every deploy.

---

## 8. Document sharing — upsert pattern

Sharing uses `prisma.documentShare.upsert()` — "insert or do nothing if already exists." This prevents duplicate share errors if an owner accidentally tries to share with the same person twice. The `@@unique([documentId, userId])` constraint in the schema enforces this at the database level too, making the application-level upsert and the database constraint two independent lines of defence.

---

## 9. JWT auth — stateless by design

JWTs are stateless — the server never stores sessions. Every request carries a signed token containing `userId`. The server verifies the signature using `JWT_SECRET` and reads the user from the token directly, with no database lookup for auth. This makes the API horizontally scalable (any server instance can verify any token) but means tokens can't be invalidated before expiry — a known tradeoff acceptable for this project's scope.

---

## 10. Auto-save debouncing — stale closure problem

The debounce uses `setTimeout` + `clearTimeout`. Each keystroke cancels the previous timer and starts a fresh 1-second countdown. A subtle React bug appeared here: the `setTimeout` callback closed over stale `title` and `content` state values from when it was created, not from when it fired. Fixed by passing the latest values as explicit parameters to `syncToServer()` rather than relying on state values inside the closure.

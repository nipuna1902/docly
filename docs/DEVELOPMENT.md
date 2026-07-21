# Development and revision guide

## Where to answer common questions

| Question | Start with |
|---|---|
| Where is a UI route defined? | `client/src/App.jsx` |
| Why is the API header present? | `client/src/api/axios.js` |
| How does offline work? | `client/src/utils/offlineStorage.js`, then `pages/Editor.jsx` |
| Why does a save conflict? | `server/routes/documents.ts` and [API](./API.md) |
| Who may access a document? | `server/routes/documents.ts` / `shares.ts` |
| What database constraint enforces this? | `server/prisma/schema.prisma` and migrations |
| How are live updates sent? | `client/src/pages/Editor.jsx`, `server/index.ts` |
| Why is Redis needed twice? | Cache in document routes; Socket.IO cross-instance pub/sub in `index.ts` |

## Safe change paths

### Add a document field

1. Edit `server/prisma/schema.prisma`.
2. Create a migration with `npx prisma migrate dev --name add_<field>`.
3. Regenerate Prisma and update route payload handling.
4. Update the client component, API reference, and any cache assumptions.
5. Add tests before relying on the behavior.

### Add a new REST endpoint

1. Put it in the responsible route module, or create a focused new router.
2. Apply `authenticate` if it accesses user data; make ownership/share checks explicit.
3. Validate parameters and body before Prisma calls.
4. Decide which Redis keys become invalid and document the response/error shape.
5. Mount the router in `server/index.ts` and add tests.

### Alter editor collaboration

The app has two independent paths: Socket.IO supplies immediate peer feedback and HTTP supplies durable, versioned saves. Do not treat a socket emission as a save. Programmatic TipTap changes must set `isRemoteUpdate.current` so `on('update')` does not rebroadcast and resave them. Any new socket event needs server-side authorization before it is trusted.

## Recommended test plan

No test runner is installed, so this is a roadmap rather than a claimed suite.

- Unit: JWT middleware; `extractPlainText`; offline storage parsing; conflict decision logic.
- API integration: signup/login, unauthenticated rejection, owner vs shared permissions, 409 behavior, cache invalidation.
- Browser E2E: create/edit/reload, two collaborators, offline/reconnect conflict, sharing and revocation.
- Load/concurrency: simultaneous PUTs to prove the version update is an atomic compare-and-swap after hardening.

## Code conventions already in use

- Backend source is TypeScript ESM and uses `.js` in relative import specifiers.
- Client source is JSX and imports include extensions.
- Persistent content is stored as a stringified TipTap tree, not HTML.
- Generated Prisma code under `server/generated/` or build output under `server/dist/` is not a hand-editing surface.
- Keep credentials out of `.env` commits and documentation examples.
